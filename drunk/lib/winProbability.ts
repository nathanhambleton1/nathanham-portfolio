/**
 * Advanced Win Probability Algorithm for Drunkopoly
 * 
 * This algorithm calculates each player's probability of winning based on:
 * - Current assets (cash + property values + house/hotel values)
 * - Strategic position (monopolies, railroads, utilities)
 * - Game phase (early/mid/late game)
 * - Luck factors (passing go, jail, taxes, property landings)
 * - Sip handicap (if sips are enabled)
 * 
 * All probabilities sum to 100%
 */

import { MonopolyProperty, MONOPOLY_PROPERTIES, calculatePropertyValue } from './monopoly-properties';

export interface PlayerStats {
  times_passed_go: number;
  times_went_to_jail: number;
  times_landed_free_parking: number;
  total_tax_paid: number;
  total_rent_paid: number;
  total_rent_received: number;
  times_others_landed_on_properties: number;
  current_luck_score: number;
}

export interface PropertyOwnership {
  property_id: string;
  player_id: string | null;
  houses: number;
  is_mortgaged: boolean;
}

export interface Player {
  id: string;
  name: string;
  balance: number;
  total_sips?: number;
}

export interface GameInfo {
  created_at: string;
  sips_enabled: boolean;
}

export interface WinProbabilityResult {
  playerId: string;
  winProbability: number; // 0-100
  breakdown: {
    assetScore: number;
    strategyScore: number;
    gamePhaseScore: number;
    luckScore: number;
    sipPenalty: number;
    totalScore: number;
  };
}

// Game phase detection
enum GamePhase {
  EARLY = 'early',
  MID = 'mid',
  LATE = 'late'
}

function getGamePhase(gameCreatedAt: string, totalPropertiesOwned: number): GamePhase {
  const now = new Date();
  const created = new Date(gameCreatedAt);
  const hoursElapsed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
  
  const totalProperties = MONOPOLY_PROPERTIES.length;
  const ownershipPercentage = totalPropertiesOwned / totalProperties;
  
  // Early game: < 1 hour OR < 30% properties owned
  if (hoursElapsed < 1 || ownershipPercentage < 0.3) {
    return GamePhase.EARLY;
  }
  
  // Late game: > 3 hours OR > 70% properties owned
  if (hoursElapsed > 3 || ownershipPercentage > 0.7) {
    return GamePhase.LATE;
  }
  
  return GamePhase.MID;
}

// Calculate asset value with non-linear house valuation
function calculateAssetScore(
  player: Player,
  ownerships: PropertyOwnership[],
  gamePhase: GamePhase
): number {
  let totalValue = player.balance;
  
  ownerships.forEach(ownership => {
    const property = MONOPOLY_PROPERTIES.find(p => p.id === ownership.property_id);
    if (!property) return;
    
    // Base property value
    let propertyValue = property.price;
    
    // Subtract mortgage if mortgaged
    if (ownership.is_mortgaged) {
      propertyValue = -property.mortgageValue; // negative value for mortgaged
    } else if (property.type === 'street') {
      // Non-linear house/hotel valuation - each house is progressively more valuable
      // because rent increases exponentially
      const houses = ownership.houses;
      
      if (houses > 0) {
        // Calculate actual rent value at this level
        const rentMultiplier = houses === 1 ? 5 :
                             houses === 2 ? 15 :
                             houses === 3 ? 45 : // BIG jump here
                             houses === 4 ? 80 :
                             150; // hotel
        
        // Value = base property + (house cost * houses * rent multiplier weight)
        propertyValue = property.price + (property.houseCost! * houses * (rentMultiplier / 10));
      }
    }
    
    totalValue += propertyValue;
  });
  
  return totalValue;
}

// Calculate strategic position score
function calculateStrategyScore(
  ownerships: PropertyOwnership[],
  allOwnerships: PropertyOwnership[],
  gamePhase: GamePhase
): number {
  let score = 0;
  
  // Group properties by color
  const colorGroups: { [key: string]: PropertyOwnership[] } = {};
  ownerships.forEach(ownership => {
    const property = MONOPOLY_PROPERTIES.find(p => p.id === ownership.property_id);
    if (!property) return;
    
    if (!colorGroups[property.color]) {
      colorGroups[property.color] = [];
    }
    colorGroups[property.color].push(ownership);
  });
  
  // Check for monopolies
  Object.entries(colorGroups).forEach(([color, props]) => {
    const totalInColor = MONOPOLY_PROPERTIES.filter(p => p.color === color).length;
    
    if (props.length === totalInColor) {
      // Complete monopoly!
      let monopolyValue = 1000; // base monopoly bonus
      
      // Adjust based on color and game phase
      if (gamePhase === GamePhase.EARLY) {
        // Light blue, brown, pink more valuable early
        if (color === 'light-blue' || color === 'brown' || color === 'pink') {
          monopolyValue *= 1.5;
        }
        // Expensive properties less valuable early
        if (color === 'dark-blue' || color === 'green') {
          monopolyValue *= 0.6;
        }
      } else if (gamePhase === GamePhase.LATE) {
        // Expensive properties more valuable late
        if (color === 'dark-blue' || color === 'green') {
          monopolyValue *= 1.8;
        }
        // Cheap properties less valuable late
        if (color === 'brown') {
          monopolyValue *= 0.7;
        }
      }
      
      // Add bonus for houses on monopoly
      const totalHouses = props.reduce((sum, p) => sum + p.houses, 0);
      monopolyValue += totalHouses * 500; // each house on monopoly is worth a lot
      
      score += monopolyValue;
    }
  });
  
  // Railroad bonus (exponential value)
  const railroads = ownerships.filter(o => {
    const prop = MONOPOLY_PROPERTIES.find(p => p.id === o.property_id);
    return prop?.type === 'railroad';
  }).length;
  
  if (railroads === 4) {
    score += 1200; // all 4 railroads is very strong
  } else if (railroads === 3) {
    score += 600;
  } else if (railroads === 2) {
    score += 200;
  } else if (railroads === 1) {
    score += 50;
  }
  
  // Utility bonus (only valuable as a pair)
  const utilities = ownerships.filter(o => {
    const prop = MONOPOLY_PROPERTIES.find(p => p.id === o.property_id);
    return prop?.type === 'utility';
  }).length;
  
  if (utilities === 2) {
    score += 400; // utility pair
  } else if (utilities === 1) {
    score += 50; // single utility not very valuable
  }
  
  return score;
}

// Calculate luck score based on game events
function calculateLuckScore(stats: PlayerStats): number {
  let luckScore = 0;
  
  // Passing Go is good
  luckScore += stats.times_passed_go * 50;
  
  // Going to jail is bad (missed opportunities)
  luckScore -= stats.times_went_to_jail * 100;
  
  // Landing on Free Parking is lucky
  luckScore += stats.times_landed_free_parking * 80;
  
  // Paying taxes is unlucky
  luckScore -= stats.total_tax_paid * 0.2; // small penalty per dollar
  
  // Receiving rent is good (hot properties)
  luckScore += stats.total_rent_received * 0.3;
  
  // Paying rent is bad
  luckScore -= stats.total_rent_paid * 0.3;
  
  // Property landing frequency (are people landing on your properties?)
  luckScore += stats.times_others_landed_on_properties * 150;
  
  // Use stored luck score from recent patterns
  luckScore += stats.current_luck_score * 200;
  
  return luckScore;
}

// Calculate sip penalty (if enabled)
function calculateSipPenalty(player: Player, sipsEnabled: boolean): number {
  if (!sipsEnabled || !player.total_sips) return 0;
  
  // Each sip slightly reduces win probability
  // Diminishing returns: first 10 sips matter more than later ones
  const sipImpact = Math.min(player.total_sips * 0.1, 1.0);
  return -sipImpact * 300; // max penalty of -300
}

// Main win probability calculation
export function calculateWinProbabilities(
  players: Player[],
  allOwnerships: PropertyOwnership[],
  playerStats: Map<string, PlayerStats>,
  gameInfo: GameInfo
): WinProbabilityResult[] {
  if (players.length === 0) return [];
  
  // Determine game phase
  const totalPropertiesOwned = allOwnerships.filter(o => o.property_id !== null).length;
  const gamePhase = getGamePhase(gameInfo.created_at, totalPropertiesOwned);
  
  // Calculate scores for each player
  const playerScores = players.map(player => {
    const ownerships = allOwnerships.filter(o => o.player_id === player.id);
    const stats = playerStats.get(player.id) || {
      times_passed_go: 0,
      times_went_to_jail: 0,
      times_landed_free_parking: 0,
      total_tax_paid: 0,
      total_rent_paid: 0,
      total_rent_received: 0,
      times_others_landed_on_properties: 0,
      current_luck_score: 0
    };
    
    const assetScore = calculateAssetScore(player, ownerships, gamePhase);
    const strategyScore = calculateStrategyScore(ownerships, allOwnerships, gamePhase);
    const luckScore = calculateLuckScore(stats);
    const sipPenalty = calculateSipPenalty(player, gameInfo.sips_enabled);
    
    // Weight the components (adjust these weights to tune the algorithm)
    const totalScore = 
      assetScore * 1.0 +      // Asset value is most important
      strategyScore * 0.8 +   // Strategic position is very important
      luckScore * 0.3 +       // Luck has some impact
      sipPenalty * 0.5;       // Sip penalty has moderate impact
    
    return {
      playerId: player.id,
      breakdown: {
        assetScore,
        strategyScore,
        gamePhaseScore: gamePhase === GamePhase.EARLY ? 0 : gamePhase === GamePhase.MID ? 1 : 2,
        luckScore,
        sipPenalty,
        totalScore: Math.max(totalScore, 0) // ensure non-negative
      }
    };
  });
  
  // Convert scores to probabilities (softmax with temperature)
  const temperature = 0.5; // Lower = more confident, higher = more uniform
  const maxScore = Math.max(...playerScores.map(p => p.breakdown.totalScore), 1);
  
  // Normalize scores to prevent overflow
  const normalizedScores = playerScores.map(p => ({
    ...p,
    normalizedScore: p.breakdown.totalScore / maxScore
  }));
  
  // Apply softmax
  const expScores = normalizedScores.map(p => Math.exp(p.normalizedScore / temperature));
  const sumExpScores = expScores.reduce((sum, score) => sum + score, 0);
  
  const results: WinProbabilityResult[] = normalizedScores.map((p, i) => ({
    playerId: p.playerId,
    winProbability: (expScores[i] / sumExpScores) * 100,
    breakdown: p.breakdown
  }));
  
  // Ensure probabilities sum to exactly 100%
  const totalProb = results.reduce((sum, r) => sum + r.winProbability, 0);
  results.forEach(r => {
    r.winProbability = (r.winProbability / totalProb) * 100;
  });

  // If any players are marked bankrupt, force their probability to 0 and
  // renormalize the remaining players so totals still sum to 100%.
  try {
    const bankruptIds = players.filter(p => (p as any).is_bankrupt).map(p => p.id);
    if (bankruptIds.length) {
      results.forEach(r => {
        if (bankruptIds.includes(r.playerId)) r.winProbability = 0;
      });

      const remainingTotal = results.reduce((s, r) => s + r.winProbability, 0);
      if (remainingTotal > 0) {
        results.forEach(r => {
          r.winProbability = (r.winProbability / remainingTotal) * 100;
        });
      }
    }
  } catch (e) {
    // non-fatal, just ensure function remains robust
    console.warn('Failed to adjust for bankrupt players in win probability calc', e);
  }
  
  return results;
}
