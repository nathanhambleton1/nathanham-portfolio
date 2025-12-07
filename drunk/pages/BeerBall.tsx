import { useState, useEffect } from "react";
import { BackButton } from "../components/BackButton";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { UserPlus, X, Shuffle, Users, Trophy, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { generateRegularSeasonGames } from "../lib/scheduler";
import type { Team, Game as SGame, PlayoffRound, PlayoffMatch } from "../lib/scheduler";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Checkbox } from "../components/ui/checkbox";
import { useLocation, useNavigate } from "react-router-dom";
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Team and Game types are imported from scheduler

type TeamMode = "random" | "skill";

type Player = {
  id: string;
  name: string;
};

// How many games so everyone plays everyone once (round robin)
const computeRoundRobinGames = (numTeams: number) =>
  numTeams < 2 ? 0 : (numTeams * (numTeams - 1)) / 2;

// Default playoff spots:
// - even # of teams  -> all teams make playoffs
// - odd # of teams   -> drop the lowest one
// - always at least 2 if possible
const computeDefaultPlayoffSpots = (numTeams: number) => {
  if (numTeams < 2) return 0;
  if (numTeams === 2) return 2;
  return numTeams % 2 === 0 ? numTeams : numTeams - 1;
};

const BeerBall = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Check for Beer Olympics integration
  const params = new URLSearchParams(location.search);
  const olympicsGameCode = params.get('olympics');
  const olympicsEventId = params.get('event');
  const olympicsPlayers = params.get('players');
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [teamMode, setTeamMode] = useState<TeamMode>("random");
  // Ordering for ranking-based skill input (top = best)
  const [throwOrder, setThrowOrder] = useState<string[]>([]); // array of player ids
  const [drinkOrder, setDrinkOrder] = useState<string[]>([]); // array of player ids
  const [defenseOrder, setDefenseOrder] = useState<string[]>([]); // array of player ids (new)
  const [activeRanking, setActiveRanking] = useState<"throw" | "drink" | "defense">("throw");
  // Team size is fixed to 2 players
  const teamSize = 2;
  const [teams, setTeams] = useState<Team[]>([]);
  const [numGames, setNumGames] = useState<number>(0);
  const [bracket, setBracket] = useState<SGame[]>([]);
  // map of regular season game id -> winning team id
  const [gameWinners, setGameWinners] = useState<Record<string, string | null>>({});
  const [enablePlayoffs, setEnablePlayoffs] = useState<boolean>(true);
  const [playoffSpots, setPlayoffSpots] = useState<number>(0);
  const [playoffRounds, setPlayoffRounds] = useState<PlayoffRound[]>([]);
  const [playoffChampion, setPlayoffChampion] = useState<Team | null>(null);
  // When true, regular-season match schedule is locked and cannot be changed

  const [scheduleLocked, setScheduleLocked] = useState<boolean>(false);

  // Initialize players from Beer Olympics if coming from there
  useEffect(() => {
    if (olympicsPlayers && players.length === 0) {
      const names = olympicsPlayers.split(',').map(n => n.trim()).filter(Boolean);
      const initialPlayers = names.map((name, index) => ({
        id: `p-${Date.now()}-${index}`,
        name: name,
      }));
      setPlayers(initialPlayers);
      const ids = initialPlayers.map(p => p.id);
      setThrowOrder(ids);
      setDrinkOrder(ids);
      setDefenseOrder(ids);
      toast.success(`Loaded ${names.length} players from Beer Olympics`);
    }
  }, [olympicsPlayers]);

  useEffect(() => {
    const numTeams = teams.length;

    if (numTeams < 2) {
      // No real schedule possible
      setNumGames(0);
      setPlayoffSpots(0);
      return;
    }

    // 1) regular season: everyone plays everyone once
    const rrGames = computeRoundRobinGames(numTeams);
    setNumGames(rrGames);

    // 2) playoffs: even -> all, odd -> drop lowest
    if (enablePlayoffs) {
      const spots = computeDefaultPlayoffSpots(numTeams);
      setPlayoffSpots(spots);
    } else {
      setPlayoffSpots(0);
    }
  }, [teams, enablePlayoffs]);

  // --- DERIVED STATE ---
  // are all regular-season games decided?
  const allRegularGamesDecided =
    bracket.length > 0 &&
    bracket.every((g) => gameWinners[g.id] !== undefined && gameWinners[g.id] !== null);
  // are all regular-season games paired with both teams (no TBDs)?
  const allGamesPaired = bracket.length > 0 && bracket.every((g) => !!g.teamA && !!g.teamB);

  // Add player
  const addPlayer = () => {
    const trimmed = newPlayerName.trim();
    if (!trimmed) {
      toast.error("Please enter a player name");
      return;
    }
    if (players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("This player is already added");
      return;
    }
    const newPlayer: Player = {
      id: `p-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: trimmed,
    };
    setPlayers((prev) => [...prev, newPlayer]);
    // append to both rankings at the end
    setThrowOrder((prev) => [...prev, newPlayer.id]);
    setDrinkOrder((prev) => [...prev, newPlayer.id]);
    setDefenseOrder((prev) => [...prev, newPlayer.id]);
    setNewPlayerName("");
    toast.success(`${trimmed} joined!`);
  };

  const removePlayer = (id: string) => {
    const removed = players.find((p) => p.id === id);
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setThrowOrder((prev) => prev.filter((pid) => pid !== id));
    setDrinkOrder((prev) => prev.filter((pid) => pid !== id));
    setDefenseOrder((prev) => prev.filter((pid) => pid !== id));
    if (removed) toast.info(`${removed.name} removed`);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addPlayer();
    }
  };

  // Drag-and-drop handler for rankings
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (activeRanking === "throw") {
      const items = Array.from(throwOrder);
      const [moved] = items.splice(sourceIndex, 1);
      items.splice(destIndex, 0, moved);
      setThrowOrder(items);
    } else if (activeRanking === "drink") {
      const items = Array.from(drinkOrder);
      const [moved] = items.splice(sourceIndex, 1);
      items.splice(destIndex, 0, moved);
      setDrinkOrder(items);
    } else {
      const items = Array.from(defenseOrder);
      const [moved] = items.splice(sourceIndex, 1);
      items.splice(destIndex, 0, moved);
      setDefenseOrder(items);
    }
  };

  // Generate teams
  const generateTeams = () => {
    if (players.length < teamSize * 2) {
      toast.error(`Need at least ${teamSize * 2} players for teams of ${teamSize}`);
      return;
    }

    let generatedTeams: Team[] = [];

    if (teamMode === "random") {
      // Random shuffle
      const shuffled = [...players].sort(() => Math.random() - 0.5).map((p) => p.name);
      const numTeams = Math.floor(shuffled.length / teamSize);

      for (let i = 0; i < numTeams; i++) {
        generatedTeams.push({
          id: `team-${i + 1}`,
          name: `Team ${i + 1}`,
          players: shuffled.slice(i * teamSize, (i + 1) * teamSize),
        });
      }

      // Handle leftover players
      const leftover = shuffled.slice(numTeams * teamSize);
      leftover.forEach((player, idx) => {
        generatedTeams[idx % generatedTeams.length].players.push(player);
      });
    } else {
      // Skill-based: snake draft using three separate rankings (throw, drink & defense)
      const numTeams = Math.floor(players.length / teamSize);
      generatedTeams = Array.from({ length: numTeams }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        players: [],
      }));

      const N = players.length;
      const scoreFromIndex = (index: number) => {
        if (index === -1) return 5; // default
        if (N === 1) return 5;
        return Math.round(((N - index - 1) / (N - 1)) * 9) + 1; // 1..10
      };

      const ranked = players
        .map((p) => {
          const ti = throwOrder.indexOf(p.id);
          const di = drinkOrder.indexOf(p.id);
          const defe = defenseOrder.indexOf(p.id);
          const throwScore = scoreFromIndex(ti);
          const drinkScore = scoreFromIndex(di);
          const defenseScore = scoreFromIndex(defe);
          return {
            ...p,
            throwScore,
            drinkScore,
            defenseScore,
            avg: (throwScore + drinkScore + defenseScore) / 3,
          };
        })
        .sort((a, b) => b.avg - a.avg);

      let currentTeamIndex = 0;
      let direction = 1; // 1 for forward, -1 for backward

      ranked.forEach((player) => {
        generatedTeams[currentTeamIndex].players.push(player.name);

        // Move to next team (snake)
        if (direction === 1) {
          if (currentTeamIndex === numTeams - 1) {
            direction = -1;
          } else {
            currentTeamIndex++;
          }
        } else {
          if (currentTeamIndex === 0) {
            direction = 1;
          } else {
            currentTeamIndex--;
          }
        }
      });
    }

    setTeams(generatedTeams);
    setBracket([]); // Clear bracket when teams change
    toast.success(`${generatedTeams.length} teams created!`);
  };

  // Generate bracket
  const generateBracket = () => {
    if (teams.length < 2) {
      toast.error("Need at least 2 teams to generate a bracket");
      return;
    }
    const games = generateRegularSeasonGames(teams, numGames);
    setBracket(games);
    setGameWinners({});
    toast.success(`Regular season: ${games.length} games created!`);
  };

  const generatePlayoffs = () => {
    if (teams.length < 2) {
      toast.error("Need at least 2 teams to create playoffs");
      return;
    }
    // Require that all regular season games have been decided
    if (bracket.length > 0) {
      const allDecided = bracket.every((g) => gameWinners[g.id] !== undefined && gameWinners[g.id] !== null);
      if (!allDecided) {
        toast.error("Please decide all regular season games before creating playoffs");
        return;
      }
    }

    // Build standings from regular season winners (gameWinners)
    const wins: Record<string, number> = {};
    teams.forEach((t) => (wins[t.id] = 0));
    bracket.forEach((g) => {
      const winTeamId = gameWinners[g.id];
      if (winTeamId) {
        if (!wins[winTeamId]) wins[winTeamId] = 0;
        wins[winTeamId] += 1;
      }
    });

    // Group teams by wins so we can apply head-to-head tie-breakers within tied groups
    const groupsByWins = new Map<number, Team[]>();
    teams.forEach((t) => {
      const w = wins[t.id] || 0;
      const arr = groupsByWins.get(w) ?? [];
      arr.push(t);
      groupsByWins.set(w, arr);
    });

    const winCounts = Array.from(groupsByWins.keys()).sort((a, b) => b - a);
    const ranked: Team[] = [];

    for (const wc of winCounts) {
      const group = groupsByWins.get(wc) ?? [];
      if (group.length === 1) {
        ranked.push(group[0]);
        continue;
      }

      // Tie-breaker: head-to-head wins among teams in this group
      const h2hWins: Record<string, number> = {};
      group.forEach((t) => (h2hWins[t.id] = 0));

      bracket.forEach((g) => {
        const winnerId = gameWinners[g.id];
        if (!winnerId) return;
        const aId = g.teamA?.id ?? null;
        const bId = g.teamB?.id ?? null;
        // only count head-to-head games where both teams are in the tied group
        if (aId && bId && h2hWins.hasOwnProperty(aId) && h2hWins.hasOwnProperty(bId)) {
          h2hWins[winnerId] = (h2hWins[winnerId] || 0) + 1;
        }
      });

      // sort group by head-to-head wins desc, then deterministic fallback (name)
      group.sort((a, b) => {
        const ha = h2hWins[a.id] || 0;
        const hb = h2hWins[b.id] || 0;
        if (ha !== hb) return hb - ha;
        return a.name.localeCompare(b.name);
      });

      ranked.push(...group);
    }
      // Auto playoff spots: even -> all, odd -> drop the lowest
      let autoSpots = computeDefaultPlayoffSpots(teams.length);
      autoSpots = Math.max(2, Math.min(autoSpots, teams.length));

      // keep state in sync with what we're actually using
      setPlayoffSpots(autoSpots);

      const selected = ranked.slice(0, autoSpots);

      const rounds = buildEmptyPlayoffRounds(selected, autoSpots);
      setPlayoffRounds(rounds);
      setPlayoffChampion(null);
      toast.success(
        `Playoffs created. Top ${selected.length} teams seeded by regular season wins (auto spots: ${autoSpots}).`
      );
      // Lock the regular-season schedule so games cannot be changed after playoffs created
      setScheduleLocked(true);
  };

  // NOTE: Playoffs are generated manually via the "Generate Playoff" button.
  // The previous auto-generation (on allRegularGamesDecided) was removed so
  // the user can explicitly lock the schedule when they're ready.

  // Clear playoff state when playoffs are disabled
  useEffect(() => {
    if (!enablePlayoffs) {
      setPlayoffRounds([]);
      setPlayoffChampion(null);
    }
  }, [enablePlayoffs]);

  // Helper: build empty playoff rounds (no winners filled) from selected teams
  const buildEmptyPlayoffRounds = (selectedTeams: Team[], spots: number) => {
    const nextPowerOfTwo = (n: number) => {
      let p = 1;
      while (p < n) p <<= 1;
      return p;
    };

    const bracketSize = nextPowerOfTwo(spots);
    const seeds: (Team | null)[] = Array.from({ length: bracketSize }, () => null);
    for (let i = 0; i < selectedTeams.length; i++) seeds[i] = selectedTeams[i];

    let currentSeeds = seeds.map((t, i) => ({ seed: i + 1, team: t }));
    const roundsOut: PlayoffRound[] = [];
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
          winner: null,
        });
      }

      roundsOut.push({ round: roundNumber, matches });

      // prepare seeds for next round (winners unknown -> nulls)
      currentSeeds = matches.map((m: PlayoffMatch, idx: number) => ({ seed: idx + 1, team: null }));
      roundNumber++;
    }

    return roundsOut;
  };

  // When a regular-season game winner is selected
  const setRegularGameWinner = (gameId: string, teamId: string | null) => {
    setGameWinners((prev) => ({ ...prev, [gameId]: teamId }));
  };

  // Update a playoff match winner and propagate to later rounds
  const setPlayoffMatchWinner = (roundIdx: number, matchIdx: number, winner: Team | null) => {
    setPlayoffRounds((prevRounds) => {
      const rounds = JSON.parse(JSON.stringify(prevRounds)) as PlayoffRound[];
      if (!rounds[roundIdx]) return prevRounds;
      rounds[roundIdx].matches[matchIdx].winner = winner ?? null;

      // propagate winners forward only when an entire round is decided.
      for (let r = roundIdx; r < rounds.length - 1; r++) {
        const current = rounds[r];
        const next = rounds[r + 1];

        // clear next round by default
        next.matches.forEach((m) => {
          m.teamA = null;
          m.teamB = null;
          m.winner = null;
        });

        // check if the entire current round is decided
        const allDecided = current.matches.every((m) => {
          return (
            (m.winner !== null && m.winner !== undefined) ||
            (m.teamA && !m.teamB) ||
            (m.teamB && !m.teamA)
          );
        });

        if (!allDecided) {
          // stop propagation until the whole round is finished
          break;
        }

        // collect winners (or default single-team advances)
        const winners = current.matches.map((m) => {
          return (
            m.winner ??
            (m.teamA && !m.teamB ? m.teamA : m.teamB && !m.teamA ? m.teamB : null)
          );
        });

        winners.forEach((win, i) => {
          const targetMatchIndex = Math.floor(i / 2);
          const slot = i % 2 === 0 ? 'teamA' : 'teamB';
          if (next.matches[targetMatchIndex]) {
            (next.matches[targetMatchIndex] as any)[slot] = win;
          }
        });
      }

      // compute champion only when final round fully decided
      const lastRound = rounds[rounds.length - 1];
      let champ: Team | null = null;
      if (lastRound && lastRound.matches.length > 0) {
        const final = lastRound.matches[0];
        const finalDecided = final.winner || (final.teamA && !final.teamB) || (final.teamB && !final.teamA);
        if (finalDecided) {
          champ = final.winner ?? (final.teamA && !final.teamB ? final.teamA : final.teamB && !final.teamA ? final.teamB : null);
        }
      }
      setPlayoffChampion(champ);

      return rounds;
    });
  };

  const generateFullSchedule = () => {
    // Only generate the regular-season schedule here.
    // Playoffs will be generated automatically by the effect
    // once all regular-season games have winners.
    generateBracket();
    setPlayoffRounds([]);
    setPlayoffChampion(null);
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Spacer section to force content down */}
      <div className="w-full" style={{ height: '48px' }} />
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Beer Ball</h1>
          <p className="text-muted-foreground">Organize teams and schedule matches</p>
        </div>

        {/* Step 1: Players */}
        <Card className="bg-gradient-card border-border p-6 mb-6">
          <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-5 h-5" />
            1. Players
          </h3>

          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter player name"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 bg-muted border-border"
              maxLength={20}
            />
            <Button
              onClick={addPlayer}
              className="bg-white text-black border border-border hover:bg-gray-100"
            >
              <UserPlus className="w-5 h-5" />
            </Button>
          </div>

          {players.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg"
                >
                  <span className="text-foreground">{player.name}</span>
                  <button
                    onClick={() => removePlayer(player.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No players yet. Add some to get started!
            </p>
          )}
        </Card>

        {/* Step 2: Team Setup */}
        <Card className="bg-gradient-card border-border p-6 mb-6">
          <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Shuffle className="w-5 h-5" />
            2. Team Setup
          </h3>

          <div className="space-y-4">
            <div>
              <RadioGroup value={teamMode} onValueChange={(v) => setTeamMode(v as TeamMode)}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="random" id="random" />
                  <Label htmlFor="random" className="cursor-pointer ml-2">
                    Random Teams
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skill" id="skill" />
                  <Label htmlFor="skill" className="cursor-pointer ml-2">
                    Skill-Based Teams
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {teamMode === "skill" && (
              <div className="mb-4">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setActiveRanking("throw")}
                    className={`px-3 py-1 rounded ${activeRanking === "throw" ? "bg-white text-black" : "bg-muted text-muted-foreground"}`}
                  >
                    Throw Ranking
                  </button>
                  <button
                    onClick={() => setActiveRanking("drink")}
                    className={`px-3 py-1 rounded ${activeRanking === "drink" ? "bg-white text-black" : "bg-muted text-muted-foreground"}`}
                  >
                    Drink Ranking
                  </button>
                  <button
                    onClick={() => setActiveRanking("defense")}
                    className={`px-3 py-1 rounded ${activeRanking === "defense" ? "bg-white text-black" : "bg-muted text-muted-foreground"}`}
                  >
                    Defense Ranking
                  </button>
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  Drag to rank players from best (top) to least experienced (bottom) for the selected skill.
                </p>

                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId={activeRanking}>
                    {(provided) => {
                      const order = activeRanking === "throw" ? throwOrder : activeRanking === "drink" ? drinkOrder : defenseOrder;
                      return (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                          {order.map((pid, index) => {
                            const player = players.find((p) => p.id === pid);
                            if (!player) return null;
                            return (
                              <Draggable key={pid} draggableId={pid} index={index}>
                                {(prov) => (
                                  <div
                                    ref={prov.innerRef}
                                    {...prov.draggableProps}
                                    {...prov.dragHandleProps}
                                    className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg"
                                  >
                                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground mr-2">#{index + 1}</span>
                                    <span className="flex-1 text-foreground">{player.name}</span>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </div>
                      );
                    }}
                  </Droppable>
                </DragDropContext>
              </div>

            )}

            <Button
              onClick={generateTeams}
              disabled={players.length < teamSize * 2}
              className="w-full bg-white text-black border border-border hover:bg-gray-100"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Generate Teams
            </Button>

            {players.length > 0 && players.length < teamSize * 2 && (
              <p className="text-sm text-destructive text-center">
                Need at least {teamSize * 2} players for teams of {teamSize}
              </p>
            )}
          </div>
        </Card>

        {/* Step 3: Teams Overview */}
        <Card className="bg-gradient-card border-border p-6 mb-6">
          <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-5 h-5" />
            3. Teams
          </h3>

          {teams.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-3">
                {teams.map((team) => (
                  <div key={team.id} className="bg-muted p-4 rounded-lg">
                    <h4 className="font-bold text-foreground mb-2">{team.name}</h4>
                    <div className="flex flex-wrap gap-2">
                      {team.players.map((player) => (
                        <span
                          key={player}
                          className="text-sm bg-background px-2 py-1 rounded text-foreground"
                        >
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={generateTeams}
                variant="outline"
                className="w-full"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Re-generate Teams
              </Button>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Generate teams above to see them here.
            </p>
          )}
        </Card>

        {/* Step 4: Bracket & Schedule */}
        <Card className="bg-gradient-card border-border p-6 mb-6">
          <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            4. Bracket & Schedule
          </h3>

          {teams.length >= 2 ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="numGames" className="text-foreground mb-2 block">
                  Number of Regular Season Games
                </Label>
                <Input
                  id="numGames"
                  type="number"
                  min={1}
                  max={200}
                  value={numGames === 0 ? '' : numGames}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setNumGames(0);
                    } else {
                      const n = parseInt(val, 10);
                      if (!isNaN(n)) setNumGames(n);
                    }
                  }}
                  className="bg-muted border-border"
                />
              </div>

              <div className="grid gap-2">
                <div className={`flex items-start gap-3 p-2 rounded ${enablePlayoffs ? "bg-muted border border-border" : ""}`}>
                  <Checkbox
                    id="enablePlayoffs"
                    checked={enablePlayoffs}
                    onCheckedChange={(v) => setEnablePlayoffs(!!v)}
                    className="h-5 w-5"
                  />
                  <div>
                    <Label htmlFor="enablePlayoffs" className="cursor-pointer">Enable Playoffs</Label>
                    <p className="text-xs text-muted-foreground">Toggle to enable a single-elimination playoff bracket after the regular season.</p>
                  </div>
                </div>

                {enablePlayoffs && (
                  <div className="grid md:grid-cols-1 gap-2">
                    <div>
                      <Label className="text-foreground mb-2 block">Playoff Spots</Label>
                      <Input
                        type="number"
                        min={2}
                        max={teams.length}
                        value={playoffSpots === 0 ? '' : playoffSpots}
                        readOnly
                        disabled
                        className="bg-muted border-border opacity-80 cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Auto: even → all teams, odd → drops the lowest seed. Playoffs are single-game matchups.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Playoff series controls are shown above when playoffs are enabled */}

              <div className="grid gap-2">
                <Button
                  onClick={generateFullSchedule}
                  className="w-full bg-white text-black border border-border hover:bg-gray-100"
                  disabled={scheduleLocked}
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Generate Full Schedule
                </Button>

                {enablePlayoffs && bracket.length > 0 && !allRegularGamesDecided && (
                  <p className="text-xs text-muted-foreground text-center">
                    Playoffs will unlock after all regular-season games have a winner.
                  </p>
                )}
              </div>

              {bracket.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-bold text-foreground mb-3">Match Schedule</h4>
                  <div className="space-y-2">
                    {bracket.map((game) => {
                      const aId = game.teamA?.id ?? null;
                      const bId = game.teamB?.id ?? null;
                      const winnerId = gameWinners[game.id] ?? null;
                      return (
                        <div key={game.id} className="bg-muted p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground mr-3">Game {game.index}</span>
                            <div className="flex-1 flex items-center gap-2">
                              <button
                                onClick={() => setRegularGameWinner(game.id, aId)}
                                disabled={scheduleLocked || !aId}
                                className={`flex-1 text-sm py-2 px-3 rounded ${winnerId === aId ? 'bg-white text-black font-semibold' : 'bg-background text-foreground'}`}
                              >
                                {game.teamA?.name ?? `TBD`}
                              </button>
                              <span className="text-muted-foreground">vs</span>
                              <button
                                onClick={() => setRegularGameWinner(game.id, bId)}
                                disabled={scheduleLocked || !bId}
                                className={`flex-1 text-sm py-2 px-3 rounded ${winnerId === bId ? 'bg-white text-black font-semibold' : 'bg-background text-foreground'}`}
                              >
                                {game.teamB?.name ?? `TBD`}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    onClick={generateBracket}
                    variant="outline"
                    className="w-full mt-4"
                    disabled={scheduleLocked}
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Re-generate Bracket
                  </Button>

                  {enablePlayoffs && (
                    <Button
                      onClick={() => {
                        // guard: ensure games are paired before generating playoffs
                        if (!allGamesPaired) {
                          toast.error("All matches must have both teams assigned before generating playoffs");
                          return;
                        }
                        if (!allRegularGamesDecided) {
                          toast.error("Please decide all regular-season games before creating playoffs");
                          return;
                        }
                        generatePlayoffs();
                      }}
                      variant="outline"
                      className="w-full mt-2"
                      disabled={!allGamesPaired || !allRegularGamesDecided || scheduleLocked || bracket.length === 0}
                    >
                      Generate Playoff
                    </Button>
                  )}
                </div>
              )}

              {enablePlayoffs && playoffRounds.length > 0 && allRegularGamesDecided && (
                <div className="mt-6">
                  <h4 className="font-bold text-foreground mb-3">Playoff Bracket</h4>
                  <div className="space-y-4">
                    {playoffRounds.map((round, rIdx) => (
                      <div key={`round-${round.round}`} className="bg-muted p-3 rounded-lg">
                        <h5 className="font-semibold mb-2">Round {round.round}</h5>
                        <div className="space-y-2">
                          {round.matches.map((m, mi) => {
                            const a = m.teamA ?? null;
                            const b = m.teamB ?? null;
                            const win = m.winner ?? null;
                            return (
                              <div key={m.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button
                                    disabled={!a}
                                    onClick={() => setPlayoffMatchWinner(rIdx, mi, a)}
                                    className={`px-3 py-1 rounded ${win && win.id === a?.id ? 'bg-white text-black font-semibold' : 'bg-background text-foreground'}`}
                                  >
                                    {a?.name ?? `Seed ${m.seedA ?? "?"}`}
                                  </button>
                                  <span className="text-muted-foreground">vs</span>
                                  <button
                                    disabled={!b}
                                    onClick={() => setPlayoffMatchWinner(rIdx, mi, b)}
                                    className={`px-3 py-1 rounded ${win && win.id === b?.id ? 'bg-white text-black font-semibold' : 'bg-background text-foreground'}`}
                                  >
                                    {b?.name ?? `Seed ${m.seedB ?? "?"}`}
                                  </button>
                                </div>
                                <div className="text-sm font-semibold">
                                  {win ? win.name : "TBD"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="mt-3">
                      <div className="text-lg font-bold">
                        Champion: {playoffChampion ? playoffChampion.name : "TBD"}
                      </div>
                      
                      {olympicsGameCode && olympicsEventId && playoffChampion && (
                        <Button
                          className="mt-4 w-full"
                          onClick={async () => {
                            try {
                              // Calculate points for each player based on team performance
                              const teamStandings: Record<string, number> = {};
                              
                              // Give points based on regular season wins
                              teams.forEach((team) => {
                                const wins = bracket.filter(g => gameWinners[g.id] === team.id).length;
                                teamStandings[team.id] = wins;
                              });
                              
                              // Extra points for making playoffs and winning
                              if (playoffChampion) {
                                teamStandings[playoffChampion.id] = (teamStandings[playoffChampion.id] || 0) + 10;
                              }
                              
                              // Assign individual player scores based on their team
                              const playerScores: Record<string, number> = {};
                              teams.forEach((team) => {
                                const teamScore = teamStandings[team.id] || 0;
                                team.players.forEach((playerName) => {
                                  playerScores[playerName] = teamScore;
                                });
                              });
                              
                              // Get event details and player IDs from Beer Olympics
                              const { data: eventData } = await supabase
                                .from('beer_olympics_events')
                                .select('*, beer_olympics_games!inner(id)')
                                .eq('id', olympicsEventId)
                                .single();
                              
                              if (!eventData) throw new Error('Event not found');
                              
                              const { data: olympicsPlayersData } = await supabase
                                .from('beer_olympics_players')
                                .select('*')
                                .eq('game_id', eventData.beer_olympics_games.id);
                              
                              if (!olympicsPlayersData) throw new Error('Players not found');
                              
                              // Create scores for each player
                              const scoresToInsert = olympicsPlayersData.map(p => {
                                const score = playerScores[p.name] || 0;
                                return {
                                  event_id: olympicsEventId,
                                  player_id: p.id,
                                  points: score,
                                  notes: `Beer Ball Tournament - ${teams.find(t => t.players.includes(p.name))?.name || 'Unknown Team'}`,
                                };
                              });
                              
                              // Insert scores
                              const { error: scoreErr } = await supabase
                                .from('beer_olympics_scores')
                                .insert(scoresToInsert);
                              
                              if (scoreErr) throw scoreErr;
                              
                              // Update player total points
                              for (const p of olympicsPlayersData) {
                                const score = playerScores[p.name] || 0;
                                await supabase
                                  .from('beer_olympics_players')
                                  .update({ total_points: p.total_points + score })
                                  .eq('id', p.id);
                              }
                              
                              toast.success('Results sent to Beer Olympics!');
                              
                              // Navigate back to Beer Olympics
                              setTimeout(() => {
                                navigate(`/drunk/beer-olympics?code=${olympicsGameCode}`);
                              }, 1500);
                              
                            } catch (err) {
                              console.error('Send results error:', err);
                              toast.error('Failed to send results');
                            }
                          }}
                        >
                          Send Results to Beer Olympics
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Generate at least 2 teams first.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default BeerBall;
