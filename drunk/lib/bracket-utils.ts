// Bracket utilities for single and double elimination tournaments
// Rewritten to properly handle odd teams, byes, and accurate bracket progression

export type Team = {
  id: string;
  name: string;
  players: string[];
  seed?: number; // Optional seed for positioning
};

export type BracketType = "single-elimination" | "double-elimination";

export type BracketMatch = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  teamA: Team | null;
  teamB: Team | null;
  winner: Team | null;
  loser?: Team | null; // Track loser for double elimination
  // For double elimination
  isLowerBracket?: boolean;
  isGrandFinal?: boolean;
  isGrandFinalReset?: boolean;
  // Track if this is a bye match
  isBye?: boolean;
  // Source match IDs for tracking advancement
  sourceMatchA?: string;
  sourceMatchB?: string;
  // Next match IDs
  nextMatchId?: string;
  nextMatchSlot?: "A" | "B";
  loserNextMatchId?: string; // For double elimination
  loserNextMatchSlot?: "A" | "B";
  // Round info
  roundName: string;
};

export type BracketRound = {
  roundIndex: number;
  roundName: string;
  matches: BracketMatch[];
  isLowerBracket?: boolean;
  teamsRemaining: number;
  isGrandFinal?: boolean;
};

export type TournamentSettings = {
  bracketType: BracketType;
  allowByes: boolean;
  reseedAfterRound: boolean;
  thirdPlaceMatch: boolean;
  byeStrategy: "top-seeds" | "random" | "bottom-seeds" | "none";
  grandFinalReset: boolean;
  seedingStrategy: "random" | "snake" | "manual";
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the next power of 2 greater than or equal to n
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Check if a number is a power of 2
 */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Calculate number of rounds needed for bracket size
 */
export function getNumRounds(bracketSize: number): number {
  if (bracketSize <= 1) return 0;
  return Math.ceil(Math.log2(bracketSize));
}

/**
 * Generate proper tournament seeding order for a bracket of size N
 * Standard tournament seeding: 1vN, 2vN-1, etc.
 */
export function generateSeedOrder(bracketSize: number): number[] {
  if (bracketSize <= 1) return [1];
  
  const seeds: number[] = [1];
  
  for (let round = 1; round <= Math.ceil(Math.log2(bracketSize)); round++) {
    const roundSize = Math.pow(2, round);
    const newSeeds: number[] = [];
    
    for (const seed of seeds) {
      newSeeds.push(seed);
      newSeeds.push(roundSize + 1 - seed);
    }
    seeds.splice(0, seeds.length, ...newSeeds);
  }
  
  return seeds.slice(0, bracketSize);
}

/**
 * Get human-readable round name
 */
export function getRoundName(teamsRemaining: number, roundIndex: number, totalRounds: number, isLower: boolean = false): string {
  const prefix = isLower ? "Lower " : "";
  
  if (teamsRemaining === 2) return prefix + "Finals";
  if (teamsRemaining === 4) return prefix + "Semi-Finals";
  if (teamsRemaining === 8) return prefix + "Quarter-Finals";
  if (teamsRemaining === 16) return prefix + "Round of 16";
  if (teamsRemaining === 32) return prefix + "Round of 32";
  
  // For specific round positions
  const roundsFromEnd = totalRounds - roundIndex;
  if (roundsFromEnd === 1) return prefix + "Finals";
  if (roundsFromEnd === 2) return prefix + "Semi-Finals";
  if (roundsFromEnd === 3) return prefix + "Quarter-Finals";
  
  return prefix + `Round ${roundIndex + 1}`;
}

/**
 * Create a unique match ID
 */
function createMatchId(roundIndex: number, matchIndex: number, isLower: boolean = false): string {
  return `${isLower ? 'L' : 'U'}${roundIndex}-M${matchIndex}`;
}

// ============================================================================
// SINGLE ELIMINATION BRACKET GENERATION
// ============================================================================

/**
 * Generate a proper single elimination bracket with accurate handling of odd teams
 */
export function generateSingleEliminationBracket(
  teams: Team[],
  settings: TournamentSettings
): BracketRound[] {
  const numTeams = teams.length;
  if (numTeams < 2) return [];
  
  // Create seeded teams
  let seededTeams = [...teams];
  if (settings.seedingStrategy === "random") {
    seededTeams = seededTeams.sort(() => Math.random() - 0.5);
  }
  // Apply seeds
  seededTeams = seededTeams.map((team, index) => ({
    ...team,
    seed: index + 1
  }));
  
  // Get bracket size (next power of 2)
  const bracketSize = nextPowerOfTwo(numTeams);
  const numByes = bracketSize - numTeams;
  const numRounds = getNumRounds(bracketSize);
  
  const rounds: BracketRound[] = [];
  
  // Initialize match slots for first round
  const firstRoundSlots: (Team | null)[] = new Array(bracketSize).fill(null);
  
  if (settings.allowByes && numByes > 0) {
    // Distribute byes according to strategy
    const seedOrder = generateSeedOrder(bracketSize);
    
    if (settings.byeStrategy === "top-seeds") {
      // Top seeds get byes
      for (let i = 0; i < bracketSize; i++) {
        const seedPosition = seedOrder[i];
        if (seedPosition <= numTeams) {
          firstRoundSlots[i] = seededTeams[seedPosition - 1];
        }
        // else slot remains null (bye)
      }
    } else if (settings.byeStrategy === "bottom-seeds") {
      // Bottom seeds get byes
      for (let i = 0; i < bracketSize; i++) {
        const seedPosition = seedOrder[i];
        if (seedPosition > numByes) {
          firstRoundSlots[i] = seededTeams[seedPosition - numByes - 1];
        }
        // else slot remains null (bye)
      }
    } else if (settings.byeStrategy === "random") {
      // Random byes
      const availableSlots = [...Array(bracketSize).keys()];
      const byeSlots: number[] = [];
      
      // Select random bye slots
      for (let i = 0; i < numByes; i++) {
        const randomIndex = Math.floor(Math.random() * availableSlots.length);
        byeSlots.push(availableSlots[randomIndex]);
        availableSlots.splice(randomIndex, 1);
      }
      
      // Place teams in non-bye slots
      let teamIndex = 0;
      for (let i = 0; i < bracketSize; i++) {
        if (!byeSlots.includes(i)) {
          firstRoundSlots[i] = seededTeams[teamIndex];
          teamIndex++;
        }
      }
    }
  } else {
    // No byes allowed, but we still need to handle odd numbers
    // For odd teams without byes, we'll need to have some teams play more games
    // Simple approach: give one team a "bye" but mark it as playing
    const seedOrder = generateSeedOrder(bracketSize);
    for (let i = 0; i < bracketSize; i++) {
      const seedPosition = seedOrder[i];
      if (seedPosition <= numTeams) {
        firstRoundSlots[i] = seededTeams[seedPosition - 1];
      } else {
        // This shouldn't happen if we disallow byes, but handle it
        firstRoundSlots[i] = null;
      }
    }
  }
  
  // Create first round matches
  const firstRoundMatches: BracketMatch[] = [];
  const numFirstRoundMatches = bracketSize / 2;
  
  for (let i = 0; i < numFirstRoundMatches; i++) {
    const teamA = firstRoundSlots[i * 2];
    const teamB = firstRoundSlots[i * 2 + 1];
    
    const isByeMatch = (teamA === null) !== (teamB === null);
    let winner: Team | null = null;
    
    // Auto-advance if it's a bye match
    if (isByeMatch && settings.allowByes) {
      winner = teamA || teamB;
    }
    
    firstRoundMatches.push({
      id: createMatchId(0, i),
      roundIndex: 0,
      matchIndex: i,
      teamA,
      teamB,
      winner,
      isBye: isByeMatch,
      roundName: getRoundName(bracketSize, 0, numRounds)
    });
  }
  
  rounds.push({
    roundIndex: 0,
    roundName: getRoundName(bracketSize, 0, numRounds),
    matches: firstRoundMatches,
    teamsRemaining: bracketSize
  });
  
  // Generate subsequent rounds
  let currentRoundIndex = 1;
  let currentMatches = firstRoundMatches;
  let teamsInRound = bracketSize;
  
  while (currentMatches.length > 1) {
    teamsInRound = Math.ceil(teamsInRound / 2);
    const numMatches = Math.ceil(teamsInRound / 2);
    const nextMatches: BracketMatch[] = [];
    
    for (let i = 0; i < numMatches; i++) {
      // Calculate source match indices
      const sourceAIndex = i * 2;
      const sourceBIndex = i * 2 + 1;
      
      const sourceA = sourceAIndex < currentMatches.length ? currentMatches[sourceAIndex] : null;
      const sourceB = sourceBIndex < currentMatches.length ? currentMatches[sourceBIndex] : null;
      
      const matchId = createMatchId(currentRoundIndex, i);
      
      // Create match with source links
      const match: BracketMatch = {
        id: matchId,
        roundIndex: currentRoundIndex,
        matchIndex: i,
        teamA: null,
        teamB: null,
        winner: null,
        roundName: getRoundName(teamsInRound, currentRoundIndex, numRounds)
      };
      
      // Set source match IDs
      if (sourceA) {
        match.sourceMatchA = sourceA.id;
        match.teamA = sourceA.winner;
        
        // Update source match with next match info
        if (sourceA) {
          sourceA.nextMatchId = matchId;
          sourceA.nextMatchSlot = "A";
        }
      }
      
      if (sourceB) {
        match.sourceMatchB = sourceB.id;
        match.teamB = sourceB.winner;
        
        // Update source match with next match info
        if (sourceB) {
          sourceB.nextMatchId = matchId;
          sourceB.nextMatchSlot = "B";
        }
      }
      
      // Handle odd number of matches in round
      if (!sourceB && sourceA) {
        // Only one source match, this is essentially a bye to next round
        match.teamB = null;
        // Auto-advance if we have a winner from sourceA
        if (sourceA.winner) {
          match.winner = sourceA.winner;
        }
      }
      
      nextMatches.push(match);
    }
    
    rounds.push({
      roundIndex: currentRoundIndex,
      roundName: getRoundName(teamsInRound, currentRoundIndex, numRounds),
      matches: nextMatches,
      teamsRemaining: teamsInRound
    });
    
    currentMatches = nextMatches;
    currentRoundIndex++;
  }
  
  // Add third place match if enabled and we have at least 4 teams
  if (settings.thirdPlaceMatch && numTeams >= 4) {
    const thirdPlaceMatch: BracketMatch = {
      id: "third-place",
      roundIndex: rounds.length,
      matchIndex: 0,
      teamA: null,
      teamB: null,
      winner: null,
      roundName: "Third Place Match"
    };
    
    rounds.push({
      roundIndex: rounds.length,
      roundName: "Third Place",
      matches: [thirdPlaceMatch],
      teamsRemaining: 2
    });
  }
  
  return rounds;
}

// ============================================================================
// DOUBLE ELIMINATION BRACKET GENERATION
// ============================================================================

/**
 * Generate a proper double elimination bracket
 */
export function generateDoubleEliminationBracket(
  teams: Team[],
  settings: TournamentSettings
): BracketRound[] {
  const numTeams = teams.length;
  if (numTeams < 2) return [];
  
  // Create seeded teams
  let seededTeams = [...teams];
  if (settings.seedingStrategy === "random") {
    seededTeams = seededTeams.sort(() => Math.random() - 0.5);
  }
  seededTeams = seededTeams.map((team, index) => ({
    ...team,
    seed: index + 1
  }));
  
  const bracketSize = nextPowerOfTwo(numTeams);
  const numByes = bracketSize - numTeams;
  const numUpperRounds = getNumRounds(bracketSize);
  
  const allRounds: BracketRound[] = [];
  
  // Generate upper bracket (similar to single elimination)
  const upperBracket = generateSingleEliminationBracket(teams, {
    ...settings,
    thirdPlaceMatch: false, // Don't add third place match here
    grandFinalReset: false
  });
  
  // Rename upper bracket rounds
  upperBracket.forEach((round, index) => {
    round.roundName = `Upper ${round.roundName}`;
    round.matches.forEach(match => {
      match.id = `U${match.roundIndex}-M${match.matchIndex}`;
    });
  });
  
  allRounds.push(...upperBracket);
  
  // Generate lower bracket
  const lowerRounds: BracketRound[] = [];
  let lowerRoundIndex = 0;
  
  // First lower round: losers from first upper round
  const firstUpperRound = upperBracket[0];
  const numFirstLowerMatches = Math.ceil(firstUpperRound.matches.length / 2);
  
  const firstLowerMatches: BracketMatch[] = [];
  for (let i = 0; i < numFirstLowerMatches; i++) {
    const upperMatchA = firstUpperRound.matches[i * 2];
    const upperMatchB = firstUpperRound.matches[i * 2 + 1] || null;
    
    firstLowerMatches.push({
      id: createMatchId(lowerRoundIndex, i, true),
      roundIndex: lowerRoundIndex,
      matchIndex: i,
      teamA: null, // Will be loser from upperMatchA
      teamB: upperMatchB ? null : null, // Will be loser from upperMatchB if exists
      winner: null,
      isLowerBracket: true,
      roundName: "Lower Round 1",
      sourceMatchA: upperMatchA.id,
      sourceMatchB: upperMatchB?.id
    });
    
    // Set loser destination in upper matches
    upperMatchA.loserNextMatchId = createMatchId(lowerRoundIndex, i, true);
    upperMatchA.loserNextMatchSlot = "A";
    
    if (upperMatchB) {
      upperMatchB.loserNextMatchId = createMatchId(lowerRoundIndex, i, true);
      upperMatchB.loserNextMatchSlot = "B";
    }
  }
  
  lowerRounds.push({
    roundIndex: lowerRoundIndex,
    roundName: "Lower Round 1",
    matches: firstLowerMatches,
    isLowerBracket: true,
    teamsRemaining: numFirstLowerMatches * 2
  });
  
  lowerRoundIndex++;
  
  // Generate remaining lower bracket rounds
  // Pattern: Each upper round feeds into lower bracket
  // Lower bracket winners play losers from next upper round
  
  for (let upperRoundIdx = 1; upperRoundIdx < upperBracket.length; upperRoundIdx++) {
    const currentUpperRound = upperBracket[upperRoundIdx];
    const previousLowerRound = lowerRounds[lowerRounds.length - 1];
    
    // First part: Lower bracket winners from previous round vs Upper bracket losers
    if (previousLowerRound.matches.length > 0) {
      const numMatches = Math.max(currentUpperRound.matches.length, Math.ceil(previousLowerRound.matches.length / 2));
      
      const lowerMatchesA: BracketMatch[] = [];
      for (let i = 0; i < numMatches; i++) {
        const prevLowerMatch = previousLowerRound.matches[i];
        const upperMatch = currentUpperRound.matches[i];
        
        lowerMatchesA.push({
          id: createMatchId(lowerRoundIndex, i, true),
          roundIndex: lowerRoundIndex,
          matchIndex: i,
          teamA: null, // Will be winner from prevLowerMatch
          teamB: null, // Will be loser from upperMatch
          winner: null,
          isLowerBracket: true,
          roundName: `Lower Round ${lowerRoundIndex + 1}`,
          sourceMatchA: prevLowerMatch?.id,
          sourceMatchB: upperMatch?.id
        });
        
        // Set connections
        if (prevLowerMatch) {
          prevLowerMatch.nextMatchId = createMatchId(lowerRoundIndex, i, true);
          prevLowerMatch.nextMatchSlot = "A";
        }
        
        if (upperMatch) {
          upperMatch.loserNextMatchId = createMatchId(lowerRoundIndex, i, true);
          upperMatch.loserNextMatchSlot = "B";
        }
      }
      
      lowerRounds.push({
        roundIndex: lowerRoundIndex,
        roundName: `Lower Round ${lowerRoundIndex + 1}`,
        matches: lowerMatchesA,
        isLowerBracket: true,
        teamsRemaining: numMatches * 2
      });
      
      lowerRoundIndex++;
    }
    
    // Second part: Consolidation round (winners play each other)
    if (previousLowerRound.matches.length > 1) {
      const numMatches = Math.ceil(previousLowerRound.matches.length / 2);
      
      const lowerMatchesB: BracketMatch[] = [];
      for (let i = 0; i < numMatches; i++) {
        const sourceA = previousLowerRound.matches[i * 2];
        const sourceB = previousLowerRound.matches[i * 2 + 1] || null;
        
        lowerMatchesB.push({
          id: createMatchId(lowerRoundIndex, i, true),
          roundIndex: lowerRoundIndex,
          matchIndex: i,
          teamA: null, // Will be winner from sourceA
          teamB: null, // Will be winner from sourceB
          winner: null,
          isLowerBracket: true,
          roundName: `Lower Round ${lowerRoundIndex + 1}`,
          sourceMatchA: sourceA?.id,
          sourceMatchB: sourceB?.id
        });
        
        // Set connections
        if (sourceA) {
          sourceA.nextMatchId = createMatchId(lowerRoundIndex, i, true);
          sourceA.nextMatchSlot = "A";
        }
        
        if (sourceB) {
          sourceB.nextMatchId = createMatchId(lowerRoundIndex, i, true);
          sourceB.nextMatchSlot = "B";
        }
      }
      
      lowerRounds.push({
        roundIndex: lowerRoundIndex,
        roundName: `Lower Round ${lowerRoundIndex + 1}`,
        matches: lowerMatchesB,
        isLowerBracket: true,
        teamsRemaining: numMatches * 2
      });
      
      lowerRoundIndex++;
    }
  }
  
  // Add lower bracket finals
  const lastLowerRound = lowerRounds[lowerRounds.length - 1];
  if (lastLowerRound.matches.length > 1) {
    const lowerFinalsMatch: BracketMatch = {
      id: "lower-finals",
      roundIndex: lowerRoundIndex,
      matchIndex: 0,
      teamA: null, // Winner of last lower round match 0
      teamB: null, // Winner of last lower round match 1
      winner: null,
      isLowerBracket: true,
      roundName: "Lower Finals",
      sourceMatchA: lastLowerRound.matches[0]?.id,
      sourceMatchB: lastLowerRound.matches[1]?.id
    };
    
    // Set connections
    if (lastLowerRound.matches[0]) {
      lastLowerRound.matches[0].nextMatchId = "lower-finals";
      lastLowerRound.matches[0].nextMatchSlot = "A";
    }
    
    if (lastLowerRound.matches[1]) {
      lastLowerRound.matches[1].nextMatchId = "lower-finals";
      lastLowerRound.matches[1].nextMatchSlot = "B";
    }
    
    lowerRounds.push({
      roundIndex: lowerRoundIndex,
      roundName: "Lower Finals",
      matches: [lowerFinalsMatch],
      isLowerBracket: true,
      teamsRemaining: 2
    });
    
    lowerRoundIndex++;
  }
  
  // Add grand finals
  const upperFinals = upperBracket[upperBracket.length - 1];
  const lowerFinals = lowerRounds[lowerRounds.length - 1];
  
  const grandFinalMatch: BracketMatch = {
    id: "grand-final",
    roundIndex: allRounds.length + lowerRounds.length,
    matchIndex: 0,
    teamA: null, // Winner of upper finals
    teamB: null, // Winner of lower finals
    winner: null,
    isGrandFinal: true,
    roundName: "Grand Final",
    sourceMatchA: upperFinals.matches[0]?.id,
    sourceMatchB: lowerFinals.matches[0]?.id
  };
  
  // Set connections
  if (upperFinals.matches[0]) {
    upperFinals.matches[0].nextMatchId = "grand-final";
    upperFinals.matches[0].nextMatchSlot = "A";
  }
  
  if (lowerFinals.matches[0]) {
    lowerFinals.matches[0].nextMatchId = "grand-final";
    lowerFinals.matches[0].nextMatchSlot = "B";
  }
  
  allRounds.push(...lowerRounds);
  
  // Add grand finals
  allRounds.push({
    roundIndex: allRounds.length,
    roundName: "Grand Final",
    matches: [grandFinalMatch],
    isGrandFinal: true,
    teamsRemaining: 2
  });
  
  // Add grand final reset if enabled
  if (settings.grandFinalReset) {
    const grandFinalResetMatch: BracketMatch = {
      id: "grand-final-reset",
      roundIndex: allRounds.length,
      matchIndex: 0,
      teamA: null,
      teamB: null,
      winner: null,
      isGrandFinalReset: true,
      roundName: "Grand Final Reset",
      sourceMatchA: "grand-final"
    };
    
    allRounds.push({
      roundIndex: allRounds.length,
      roundName: "Grand Final Reset",
      matches: [grandFinalResetMatch],
      teamsRemaining: 2
    });
  }
  
  return allRounds;
}

// ============================================================================
// MATCH ADVANCEMENT LOGIC
// ============================================================================

/**
 * Advance winner (and handle loser for double elimination)
 */
export function advanceWinner(
  rounds: BracketRound[],
  matchId: string,
  winner: Team | null,
  settings: TournamentSettings
): BracketRound[] {
  // Deep clone to avoid mutation
  const newRounds: BracketRound[] = JSON.parse(JSON.stringify(rounds));
  
  // Find the match
  let targetMatch: BracketMatch | null = null;
  let targetRound: BracketRound | null = null;
  
  for (const round of newRounds) {
    for (const match of round.matches) {
      if (match.id === matchId) {
        targetMatch = match;
        targetRound = round;
        break;
      }
    }
    if (targetMatch) break;
  }
  
  if (!targetMatch || !targetRound) return newRounds;
  
  // Set winner
  const oldWinner = targetMatch.winner;
  targetMatch.winner = winner;
  
  // Determine loser
  const loser = winner?.id === targetMatch.teamA?.id ? targetMatch.teamB : targetMatch.teamA;
  targetMatch.loser = loser;
  
  // Handle advancement
  if (targetMatch.nextMatchId) {
    const nextMatch = findMatch(newRounds, targetMatch.nextMatchId);
    if (nextMatch) {
      // Place winner in next match
      if (targetMatch.nextMatchSlot === "A") {
        nextMatch.teamA = winner;
      } else if (targetMatch.nextMatchSlot === "B") {
        nextMatch.teamB = winner;
      }
      
      // Auto-advance if both teams are present and it's not a grand final
      if (nextMatch.teamA && nextMatch.teamB && !nextMatch.winner && !nextMatch.isGrandFinal && !nextMatch.isGrandFinalReset) {
        // Don't auto-advance in finals
      }
    }
  }
  
  // Handle loser advancement for double elimination
  if (targetMatch.loserNextMatchId && loser && settings.bracketType === "double-elimination") {
    const loserNextMatch = findMatch(newRounds, targetMatch.loserNextMatchId);
    if (loserNextMatch) {
      if (targetMatch.loserNextMatchSlot === "A") {
        loserNextMatch.teamA = loser;
      } else if (targetMatch.loserNextMatchSlot === "B") {
        loserNextMatch.teamB = loser;
      }
    }
  }
  
  // Handle third place match for single elimination
  if (settings.bracketType === "single-elimination" && settings.thirdPlaceMatch && loser) {
    const thirdPlaceRound = newRounds.find(r => r.roundName === "Third Place");
    if (thirdPlaceRound && thirdPlaceRound.matches[0]) {
      const thirdPlaceMatch = thirdPlaceRound.matches[0];
      if (!thirdPlaceMatch.teamA) {
        thirdPlaceMatch.teamA = loser;
      } else if (!thirdPlaceMatch.teamB) {
        thirdPlaceMatch.teamB = loser;
      }
    }
  }
  
  // Handle grand final reset
  if (targetMatch.isGrandFinal && loser && settings.grandFinalReset) {
    // If lower bracket winner beats upper bracket winner, need reset
    if (winner?.id === targetMatch.teamB?.id && targetMatch.teamA) {
      const resetRound = newRounds.find(r => r.roundName === "Grand Final Reset");
      if (resetRound && resetRound.matches[0]) {
        const resetMatch = resetRound.matches[0];
        resetMatch.teamA = targetMatch.teamA; // Upper bracket winner
        resetMatch.teamB = winner; // Lower bracket winner
      }
    }
  }
  
  return newRounds;
}

/**
 * Helper to find a match by ID
 */
function findMatch(rounds: BracketRound[], matchId: string): BracketMatch | null {
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.id === matchId) {
        return match;
      }
    }
  }
  return null;
}

// ============================================================================
// TOURNAMENT QUERIES
// ============================================================================

/**
 * Get tournament champion
 */
export function getChampion(rounds: BracketRound[], settings: TournamentSettings): Team | null {
  if (settings.bracketType === "single-elimination") {
    const finalRound = rounds.find(r => 
      r.roundName === "Finals" || r.roundName.includes("Finals")
    );
    return finalRound?.matches[0]?.winner || null;
  } else {
    // Double elimination
    const grandFinalRound = rounds.find(r => r.isGrandFinal);
    if (grandFinalRound?.matches[0]?.winner) {
      return grandFinalRound.matches[0].winner;
    }
    
    // Check reset
    if (settings.grandFinalReset) {
      const resetRound = rounds.find(r => r.roundName === "Grand Final Reset");
      return resetRound?.matches[0]?.winner || null;
    }
    
    return null;
  }
}

/**
 * Calculate team statistics
 */
export function calculateTeamStats(
  rounds: BracketRound[], 
  team: Team,
  settings?: TournamentSettings
): {
  wins: number;
  losses: number;
  isEliminated: boolean;
  placement: string;
} {
  let wins = 0;
  let losses = 0;
  let isEliminated = false;
  
  for (const round of rounds) {
    for (const match of round.matches) {
      const isInMatch = match.teamA?.id === team.id || match.teamB?.id === team.id;
      
      if (isInMatch && match.winner) {
        if (match.winner.id === team.id) {
          wins++;
        } else {
          losses++;
          
          // Check elimination
          if (round.isGrandFinal || round.roundName === "Grand Final Reset") {
            isEliminated = true;
          } else if (settings?.bracketType === "single-elimination") {
            isEliminated = true;
          } else if (settings?.bracketType === "double-elimination" && round.isLowerBracket) {
            isEliminated = true; // Loss in lower bracket eliminates
          }
        }
      }
    }
  }
  
  // Check if champion
  const champion = settings ? getChampion(rounds, settings) : null;
  if (champion?.id === team.id) {
    return {
      wins,
      losses,
      isEliminated: false,
      placement: "🏆 Champion"
    };
  }
  
  // Determine placement
  let placement = "Active";
  if (isEliminated) {
    if (wins === 0) {
      placement = "First Round Exit";
    } else if (wins === 1) {
      placement = "Second Round Exit";
    } else {
      placement = `Eliminated (${wins} wins)`;
    }
  }
  
  return { wins, losses, isEliminated, placement };
}

/**
 * Get all matches a team has played
 */
export function getTeamMatches(rounds: BracketRound[], team: Team): BracketMatch[] {
  const matches: BracketMatch[] = [];
  
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.teamA?.id === team.id || match.teamB?.id === team.id) {
        matches.push(match);
      }
    }
  }
  
  return matches;
}

/**
 * Check if bracket is complete
 */
export function isBracketComplete(rounds: BracketRound[], settings: TournamentSettings): boolean {
  const champion = getChampion(rounds, settings);
  return champion !== null;
}

/**
 * Get next matches to be played (both teams present, no winner yet)
 */
export function getNextMatches(rounds: BracketRound[]): BracketMatch[] {
  const pending: BracketMatch[] = [];
  
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.teamA && match.teamB && !match.winner && !match.isBye) {
        pending.push(match);
      }
    }
  }
  
  return pending;
}

/**
 * Reset a match
 */
export function resetMatch(rounds: BracketRound[], matchId: string): BracketRound[] {
  const newRounds: BracketRound[] = JSON.parse(JSON.stringify(rounds));
  
  const match = findMatch(newRounds, matchId);
  if (match) {
    match.winner = null;
    match.loser = null;
    
    // Also clear any dependent matches
    if (match.nextMatchId) {
      const nextMatch = findMatch(newRounds, match.nextMatchId);
      if (nextMatch) {
        if (match.nextMatchSlot === "A") {
          nextMatch.teamA = null;
        } else if (match.nextMatchSlot === "B") {
          nextMatch.teamB = null;
        }
        nextMatch.winner = null;
        nextMatch.loser = null;
      }
    }
    
    if (match.loserNextMatchId) {
      const loserNextMatch = findMatch(newRounds, match.loserNextMatchId);
      if (loserNextMatch) {
        if (match.loserNextMatchSlot === "A") {
          loserNextMatch.teamA = null;
        } else if (match.loserNextMatchSlot === "B") {
          loserNextMatch.teamB = null;
        }
        loserNextMatch.winner = null;
        loserNextMatch.loser = null;
      }
    }
  }
  
  return newRounds;
}

export default {
  generateSingleEliminationBracket,
  generateDoubleEliminationBracket,
  advanceWinner,
  getChampion,
  calculateTeamStats,
  getTeamMatches,
  isBracketComplete,
  getNextMatches,
  resetMatch
};