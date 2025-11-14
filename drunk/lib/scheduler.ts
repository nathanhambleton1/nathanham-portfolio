export type Team = {
  id: string;
  name: string;
  players: string[];
};

export type Game = {
  id: string;
  index: number;
  teamA?: Team | null;
  teamB?: Team | null;
};

export type PlayoffMatch = {
  id: string;
  round: number;
  seedA: number | null;
  seedB: number | null;
  teamA?: Team | null;
  teamB?: Team | null;
  winner?: Team | null;
};

export type PlayoffRound = {
  round: number;
  matches: PlayoffMatch[];
};

function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

export function generateRegularSeasonGames(teams: Team[], numGames: number): Game[] {
  if (teams.length < 2) return [];

  const allPairings: [Team, Team][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      allPairings.push([teams[i], teams[j]]);
    }
  }

  const games: Game[] = [];
  const availablePairings = [...allPairings];
  let lastTeamIds: string[] = [];

  for (let gameNum = 1; gameNum <= numGames; gameNum++) {
    let selectedPairing: [Team, Team] | null = null;
    let selectedIndex = -1;

    for (let i = 0; i < availablePairings.length; i++) {
      const [teamA, teamB] = availablePairings[i];
      if (!lastTeamIds.includes(teamA.id) && !lastTeamIds.includes(teamB.id)) {
        selectedPairing = availablePairings[i];
        selectedIndex = i;
        break;
      }
    }

    if (!selectedPairing && availablePairings.length > 0) {
      selectedIndex = Math.floor(Math.random() * availablePairings.length);
      selectedPairing = availablePairings[selectedIndex];
    }

    if (!selectedPairing) {
      // refill
      availablePairings.push(...allPairings.sort(() => Math.random() - 0.5));
      selectedIndex = 0;
      selectedPairing = availablePairings[0];
    }

    if (selectedPairing) {
      const [teamA, teamB] = selectedPairing;
      games.push({ id: `game-${gameNum}`, index: gameNum, teamA, teamB });
      lastTeamIds = [teamA.id, teamB.id];
      availablePairings.splice(selectedIndex, 1);
    }
  }

  return games;
}

export function generatePlayoffBracket(
  teams: Team[],
  playoffSpots: number,
  seriesLength = 1
): { rounds: PlayoffRound[]; champion?: Team | null } {
  const spots = Math.max(2, Math.min(playoffSpots, teams.length));
  const bracketSize = nextPowerOfTwo(spots);

  // pick top teams (simple selection: first N teams). Caller can reorder teams beforehand if desired.
  const selected = teams.slice(0, spots);

  // seed array: index 1..bracketSize
  const seeds: (Team | null)[] = Array.from({ length: bracketSize }, () => null);
  for (let i = 0; i < selected.length; i++) seeds[i] = selected[i];

  const rounds: PlayoffRound[] = [];

  let currentSeeds = seeds.map((t, i) => ({ seed: i + 1, team: t }));

  let roundNumber = 1;

  while (currentSeeds.length > 1) {
    const matches: PlayoffMatch[] = [];
    const half = currentSeeds.length / 2;
    for (let i = 0; i < half; i++) {
      const a = currentSeeds[i];
      const b = currentSeeds[currentSeeds.length - 1 - i];
      matches.push({
        id: `r${roundNumber}-m${i + 1}`,
        round: roundNumber,
        seedA: a ? a.seed : null,
        seedB: b ? b.seed : null,
        teamA: a ? a.team ?? null : null,
        teamB: b ? b.team ?? null : null,
      });
    }

    const winners: (Team | null)[] = matches.map((m) => {
      if (!m.teamA && !m.teamB) return null;
      if (!m.teamA) return m.teamB ?? null;
      if (!m.teamB) return m.teamA ?? null;
      const needed = Math.floor(seriesLength / 2) + 1;
      let winsA = 0;
      let winsB = 0;
      while (winsA < needed && winsB < needed) {
        if (Math.random() < 0.5) winsA++; else winsB++;
      }
      m.winner = winsA > winsB ? m.teamA ?? null : m.teamB ?? null;
      return m.winner ?? null;
    });

    rounds.push({ round: roundNumber, matches });

    currentSeeds = winners.map((t, idx) => ({ seed: idx + 1, team: t }));
    roundNumber++;
  }

  const champion = currentSeeds[0] ? currentSeeds[0].team ?? null : null;

  return { rounds, champion: champion ?? null };
}
