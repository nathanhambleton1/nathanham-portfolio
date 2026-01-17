// Bracket utilities for single and double elimination tournaments

export type Team = {
  id: string;
  name: string;
  players: string[];
};

export type BracketType = "single-elimination" | "double-elimination";

export type BracketMatch = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  teamA: Team | null;
  teamB: Team | null;
  winner: Team | null;
  // For double elimination
  isLowerBracket?: boolean;
  // Team that came from upper bracket in losers bracket
  fromUpperBracket?: boolean;
};

export type BracketRound = {
  roundIndex: number;
  roundName: string;
  matches: BracketMatch[];
  isLowerBracket?: boolean;
};

export type TournamentSettings = {
  bracketType: BracketType;
  allowByes: boolean;
  reseedAfterRound: boolean;
  thirdPlaceMatch: boolean;
  // For situations where we don't have power of 2 teams
  byeStrategy: "top-seeds" | "random" | "none";
  // For double elimination
  grandFinalReset: boolean; // If loser bracket winner wins first final, play second final
};

/**
 * Get the next power of 2 greater than or equal to n
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 1) return 2;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Check if a number is a power of 2
 */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Generate bracket seeding pairs (1 vs N, 2 vs N-1, etc.)
 * Standard tournament seeding to ensure best teams don't meet early
 */
export function generateSeeding(numTeams: number): [number, number][] {
  const bracketSize = nextPowerOfTwo(numTeams);
  const pairs: [number, number][] = [];
  
  for (let i = 0; i < bracketSize / 2; i++) {
    const seed1 = i + 1;
    const seed2 = bracketSize - i;
    pairs.push([seed1, seed2]);
  }
  
  return pairs;
}

/**
 * Generate single elimination bracket
 */
export function generateSingleEliminationBracket(
  teams: Team[],
  settings: TournamentSettings
): BracketRound[] {
  if (teams.length < 2) return [];

  const bracketSize = nextPowerOfTwo(teams.length);
  const numByes = bracketSize - teams.length;
  
  // Create seeded array
  const seededTeams: (Team | null)[] = new Array(bracketSize).fill(null);
  
  // Assign teams based on bye strategy
  if (settings.allowByes && numByes > 0) {
    if (settings.byeStrategy === "top-seeds") {
      // Top seeds get byes
      teams.forEach((team, idx) => {
        seededTeams[idx] = team;
      });
    } else if (settings.byeStrategy === "random") {
      // Randomly distribute byes
      const indices = Array.from({ length: bracketSize }, (_, i) => i);
      const shuffled = indices.sort(() => Math.random() - 0.5);
      teams.forEach((team, idx) => {
        seededTeams[shuffled[idx]] = team;
      });
    }
  } else {
    // No byes - just use the teams we have
    teams.forEach((team, idx) => {
      if (idx < bracketSize) {
        seededTeams[idx] = team;
      }
    });
  }

  const rounds: BracketRound[] = [];
  let currentTeams = [...seededTeams];
  let roundNum = 0;

  // Generate rounds
  while (currentTeams.length > 1) {
    const matches: BracketMatch[] = [];
    const numMatches = currentTeams.length / 2;

    for (let i = 0; i < numMatches; i++) {
      const teamA = currentTeams[i];
      const teamB = currentTeams[currentTeams.length - 1 - i];
      
      matches.push({
        id: `r${roundNum}-m${i}`,
        roundIndex: roundNum,
        matchIndex: i,
        teamA,
        teamB,
        winner: null,
      });
    }

    const roundName = getRoundName(roundNum, currentTeams.length / 2, false);
    rounds.push({
      roundIndex: roundNum,
      roundName,
      matches,
    });

    // Next round will have half as many teams (all null initially)
    currentTeams = new Array(numMatches).fill(null);
    roundNum++;
  }

  // Add third place match if enabled
  if (settings.thirdPlaceMatch && rounds.length >= 2) {
    const finalRound = rounds[rounds.length - 1];
    const semiFinalRound = rounds[rounds.length - 2];
    
    rounds.push({
      roundIndex: roundNum,
      roundName: "Third Place",
      matches: [{
        id: `r${roundNum}-m0`,
        roundIndex: roundNum,
        matchIndex: 0,
        teamA: null,
        teamB: null,
        winner: null,
      }],
    });
  }

  return rounds;
}

/**
 * Generate double elimination bracket
 */
export function generateDoubleEliminationBracket(
  teams: Team[],
  settings: TournamentSettings
): BracketRound[] {
  if (teams.length < 2) return [];

  const bracketSize = nextPowerOfTwo(teams.length);
  const numByes = bracketSize - teams.length;
  
  // Create seeded array
  const seededTeams: (Team | null)[] = new Array(bracketSize).fill(null);
  
  // Assign teams
  if (settings.allowByes && numByes > 0 && settings.byeStrategy === "top-seeds") {
    teams.forEach((team, idx) => {
      seededTeams[idx] = team;
    });
  } else {
    teams.forEach((team, idx) => {
      if (idx < bracketSize) {
        seededTeams[idx] = team;
      }
    });
  }

  const rounds: BracketRound[] = [];
  
  // UPPER BRACKET
  let currentTeams = [...seededTeams];
  let upperRoundNum = 0;
  const upperRounds: BracketRound[] = [];

  while (currentTeams.length > 1) {
    const matches: BracketMatch[] = [];
    const numMatches = currentTeams.length / 2;

    for (let i = 0; i < numMatches; i++) {
      const teamA = currentTeams[i];
      const teamB = currentTeams[currentTeams.length - 1 - i];
      
      matches.push({
        id: `upper-r${upperRoundNum}-m${i}`,
        roundIndex: upperRoundNum,
        matchIndex: i,
        teamA,
        teamB,
        winner: null,
        isLowerBracket: false,
      });
    }

    const roundName = `Upper ${getRoundName(upperRoundNum, currentTeams.length / 2, false)}`;
    upperRounds.push({
      roundIndex: upperRoundNum,
      roundName,
      matches,
      isLowerBracket: false,
    });

    currentTeams = new Array(numMatches).fill(null);
    upperRoundNum++;
  }

  // LOWER BRACKET
  // Lower bracket has more rounds and is more complex
  const lowerRounds: BracketRound[] = [];
  let lowerRoundNum = 0;
  
  // Lower bracket starts with losers from first upper round
  // and progressively adds losers from subsequent upper rounds
  const numLowerRounds = (upperRounds.length - 1) * 2;
  
  for (let i = 0; i < numLowerRounds; i++) {
    lowerRounds.push({
      roundIndex: lowerRoundNum,
      roundName: `Lower Round ${lowerRoundNum + 1}`,
      matches: [],
      isLowerBracket: true,
    });
    lowerRoundNum++;
  }

  // GRAND FINALS
  const grandFinalRound: BracketRound = {
    roundIndex: upperRounds.length + lowerRounds.length,
    roundName: "Grand Final",
    matches: [{
      id: `grand-final`,
      roundIndex: upperRounds.length + lowerRounds.length,
      matchIndex: 0,
      teamA: null, // Winner of upper bracket
      teamB: null, // Winner of lower bracket
      winner: null,
      isLowerBracket: false,
    }],
  };

  // If grand final reset is enabled, add a second grand final
  if (settings.grandFinalReset) {
    const grandFinalReset: BracketRound = {
      roundIndex: upperRounds.length + lowerRounds.length + 1,
      roundName: "Grand Final Reset",
      matches: [{
        id: `grand-final-reset`,
        roundIndex: upperRounds.length + lowerRounds.length + 1,
        matchIndex: 0,
        teamA: null,
        teamB: null,
        winner: null,
        isLowerBracket: false,
      }],
    };
    rounds.push(...upperRounds, ...lowerRounds, grandFinalRound, grandFinalReset);
  } else {
    rounds.push(...upperRounds, ...lowerRounds, grandFinalRound);
  }

  return rounds;
}

/**
 * Get human-readable round name
 */
export function getRoundName(roundIndex: number, numMatches: number, isLower: boolean): string {
  if (isLower) {
    return `Lower Round ${roundIndex + 1}`;
  }
  
  if (numMatches === 1) return "Finals";
  if (numMatches === 2) return "Semi-Finals";
  if (numMatches === 4) return "Quarter-Finals";
  if (numMatches === 8) return "Round of 16";
  return `Round ${roundIndex + 1}`;
}

/**
 * Advance winner to next round
 */
export function advanceWinner(
  rounds: BracketRound[],
  matchId: string,
  winner: Team | null,
  settings: TournamentSettings
): BracketRound[] {
  const newRounds = JSON.parse(JSON.stringify(rounds)) as BracketRound[];
  
  // Find the match
  let matchRound: BracketRound | null = null;
  let match: BracketMatch | null = null;
  
  for (const round of newRounds) {
    const foundMatch = round.matches.find(m => m.id === matchId);
    if (foundMatch) {
      match = foundMatch;
      matchRound = round;
      break;
    }
  }
  
  if (!match || !matchRound) return newRounds;
  
  // Set winner
  match.winner = winner;
  
  // Handle advancement based on bracket type
  if (settings.bracketType === "single-elimination") {
    advanceSingleElimination(newRounds, match, winner);
  } else {
    advanceDoubleElimination(newRounds, match, winner, matchRound);
  }
  
  return newRounds;
}

function advanceSingleElimination(
  rounds: BracketRound[],
  match: BracketMatch,
  winner: Team | null
): void {
  const nextRound = rounds.find(r => r.roundIndex === match.roundIndex + 1);
  if (!nextRound) return;
  
  const nextMatchIndex = Math.floor(match.matchIndex / 2);
  const nextMatch = nextRound.matches[nextMatchIndex];
  
  if (!nextMatch) return;
  
  // Determine which slot (A or B) the winner goes to
  if (match.matchIndex % 2 === 0) {
    nextMatch.teamA = winner;
  } else {
    nextMatch.teamB = winner;
  }
  
  // Also handle third place match if it exists
  const thirdPlaceRound = rounds.find(r => r.roundName === "Third Place");
  if (thirdPlaceRound && match.roundIndex === rounds.length - 3) {
    // This is a semi-final
    const loser = match.teamA?.id === winner?.id ? match.teamB : match.teamA;
    const thirdPlaceMatch = thirdPlaceRound.matches[0];
    
    if (!thirdPlaceMatch.teamA) {
      thirdPlaceMatch.teamA = loser;
    } else {
      thirdPlaceMatch.teamB = loser;
    }
  }
}

function advanceDoubleElimination(
  rounds: BracketRound[],
  match: BracketMatch,
  winner: Team | null,
  matchRound: BracketRound
): void {
  const loser = match.teamA?.id === winner?.id ? match.teamB : match.teamA;
  
  if (match.isLowerBracket) {
    // Lower bracket match - winner advances in lower bracket
    const nextLowerRound = rounds.find(
      r => r.isLowerBracket && r.roundIndex === match.roundIndex + 1
    );
    
    if (nextLowerRound) {
      const nextMatchIndex = Math.floor(match.matchIndex / 2);
      const nextMatch = nextLowerRound.matches[nextMatchIndex];
      
      if (nextMatch) {
        if (match.matchIndex % 2 === 0) {
          nextMatch.teamA = winner;
        } else {
          nextMatch.teamB = winner;
        }
      }
    } else {
      // This might be the lower bracket final - advance to grand final
      const grandFinal = rounds.find(r => r.roundName === "Grand Final");
      if (grandFinal && grandFinal.matches[0]) {
        grandFinal.matches[0].teamB = winner;
      }
    }
  } else {
    // Upper bracket match
    // Winner advances in upper bracket
    const nextUpperRound = rounds.find(
      r => !r.isLowerBracket && r.roundIndex === match.roundIndex + 1 && r.roundName !== "Grand Final"
    );
    
    if (nextUpperRound) {
      const nextMatchIndex = Math.floor(match.matchIndex / 2);
      const nextMatch = nextUpperRound.matches[nextMatchIndex];
      
      if (nextMatch) {
        if (match.matchIndex % 2 === 0) {
          nextMatch.teamA = winner;
        } else {
          nextMatch.teamB = winner;
        }
      }
    } else {
      // Upper bracket final - advance to grand final
      const grandFinal = rounds.find(r => r.roundName === "Grand Final");
      if (grandFinal && grandFinal.matches[0]) {
        grandFinal.matches[0].teamA = winner;
      }
    }
    
    // Loser goes to lower bracket
    const lowerRoundIndex = match.roundIndex;
    const targetLowerRound = rounds.find(
      r => r.isLowerBracket && r.roundIndex === lowerRoundIndex
    );
    
    if (targetLowerRound && loser) {
      // Find appropriate match in lower bracket
      const lowerMatchIndex = match.matchIndex;
      if (targetLowerRound.matches[lowerMatchIndex]) {
        if (!targetLowerRound.matches[lowerMatchIndex].teamA) {
          targetLowerRound.matches[lowerMatchIndex].teamA = loser;
        } else {
          targetLowerRound.matches[lowerMatchIndex].teamB = loser;
        }
      }
    }
  }
}

/**
 * Get tournament champion
 */
export function getChampion(rounds: BracketRound[], settings: TournamentSettings): Team | null {
  if (settings.bracketType === "single-elimination") {
    const finalRound = rounds.find(r => r.roundName === "Finals");
    if (finalRound && finalRound.matches[0]) {
      return finalRound.matches[0].winner || null;
    }
  } else {
    // Double elimination
    if (settings.grandFinalReset) {
      const resetRound = rounds.find(r => r.roundName === "Grand Final Reset");
      if (resetRound && resetRound.matches[0] && resetRound.matches[0].winner) {
        return resetRound.matches[0].winner;
      }
    }
    
    const grandFinal = rounds.find(r => r.roundName === "Grand Final");
    if (grandFinal && grandFinal.matches[0]) {
      return grandFinal.matches[0].winner || null;
    }
  }
  
  return null;
}

/**
 * Calculate team statistics
 */
export function calculateTeamStats(rounds: BracketRound[], team: Team): {
  wins: number;
  losses: number;
  isEliminated: boolean;
} {
  let wins = 0;
  let losses = 0;
  let isEliminated = false;
  
  for (const round of rounds) {
    for (const match of round.matches) {
      if (match.teamA?.id === team.id || match.teamB?.id === team.id) {
        if (match.winner) {
          if (match.winner.id === team.id) {
            wins++;
          } else {
            losses++;
            // In single elimination, one loss eliminates
            // In double elimination, two losses eliminate
            if (!match.isLowerBracket) {
              // First loss - check bracket type from context
            } else {
              // Second loss in lower bracket
              isEliminated = true;
            }
          }
        }
      }
    }
  }
  
  return { wins, losses, isEliminated };
}
