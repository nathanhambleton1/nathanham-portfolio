import { useState } from "react";
import { BackButton } from "../components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { UserPlus, X, Shuffle, Users, Trophy, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

type Team = {
  id: string;
  name: string;
  players: string[];
};

type Game = {
  id: string;
  index: number;
  teamA: Team;
  teamB: Team;
};

type TeamMode = "random" | "skill";

const BeerBall = () => {
  const [players, setPlayers] = useState<string[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [teamMode, setTeamMode] = useState<TeamMode>("random");
  const [teamSize, setTeamSize] = useState<number>(2);
  const [teams, setTeams] = useState<Team[]>([]);
  const [numGames, setNumGames] = useState<number>(6);
  const [bracket, setBracket] = useState<Game[]>([]);

  // Add player
  const addPlayer = () => {
    const trimmed = newPlayerName.trim();
    if (!trimmed) {
      toast.error("Please enter a player name");
      return;
    }
    if (players.includes(trimmed)) {
      toast.error("This player is already added");
      return;
    }
    setPlayers([...players, trimmed]);
    setNewPlayerName("");
    toast.success(`${trimmed} joined!`);
  };

  const removePlayer = (name: string) => {
    setPlayers(players.filter((p) => p !== name));
    toast.info(`${name} removed`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addPlayer();
    }
  };

  // Drag and drop for skill-based ranking
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(players);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setPlayers(items);
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
      const shuffled = [...players].sort(() => Math.random() - 0.5);
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
      // Skill-based: snake draft
      const numTeams = Math.floor(players.length / teamSize);
      generatedTeams = Array.from({ length: numTeams }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        players: [],
      }));

      let currentTeamIndex = 0;
      let direction = 1; // 1 for forward, -1 for backward

      players.forEach((player) => {
        generatedTeams[currentTeamIndex].players.push(player);

        // Move to next team
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

    // Generate all possible pairings
    const allPairings: [Team, Team][] = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        allPairings.push([teams[i], teams[j]]);
      }
    }

    if (allPairings.length === 0) {
      toast.error("Cannot generate bracket");
      return;
    }

    const games: Game[] = [];
    const availablePairings = [...allPairings];
    let lastTeamIds: string[] = [];

    for (let gameNum = 1; gameNum <= numGames; gameNum++) {
      // Try to find a pairing that doesn't include teams from the last game
      let selectedPairing: [Team, Team] | null = null;
      let selectedIndex = -1;

      // First pass: try to avoid back-to-back teams
      for (let i = 0; i < availablePairings.length; i++) {
        const [teamA, teamB] = availablePairings[i];
        if (!lastTeamIds.includes(teamA.id) && !lastTeamIds.includes(teamB.id)) {
          selectedPairing = availablePairings[i];
          selectedIndex = i;
          break;
        }
      }

      // If no perfect match, take any available pairing
      if (!selectedPairing && availablePairings.length > 0) {
        selectedIndex = Math.floor(Math.random() * availablePairings.length);
        selectedPairing = availablePairings[selectedIndex];
      }

      // If we've exhausted pairings, reshuffle and continue
      if (!selectedPairing) {
        availablePairings.push(...allPairings.sort(() => Math.random() - 0.5));
        selectedIndex = 0;
        selectedPairing = availablePairings[0];
      }

      if (selectedPairing) {
        const [teamA, teamB] = selectedPairing;
        games.push({
          id: `game-${gameNum}`,
          index: gameNum,
          teamA,
          teamB,
        });

        lastTeamIds = [teamA.id, teamB.id];
        availablePairings.splice(selectedIndex, 1);
      }
    }

    setBracket(games);
    toast.success(`Bracket with ${games.length} games created!`);
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <BackButton />

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Beer Ball Teams & Bracket</h1>
          <p className="text-muted-foreground">Organize teams and schedule matches</p>
        </div>

        {/* Step 1: Players */}
        <Card className="bg-gradient-card border-border p-6 mb-6">
          <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Users className="w-5 h-5" />
            1. Players
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Add everyone who will play Beer Ball.
          </p>

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
              className="bg-gradient-secondary text-secondary-foreground"
            >
              <UserPlus className="w-5 h-5" />
            </Button>
          </div>

          {players.length > 0 ? (
            teamMode === "skill" ? (
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-3">
                  <GripVertical className="w-4 h-4 inline mr-1" />
                  Drag to rank from best (top) to least experienced (bottom)
                </p>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="players">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {players.map((player, index) => (
                          <Draggable key={player} draggableId={player} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg"
                              >
                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground mr-2">
                                  #{index + 1}
                                </span>
                                <span className="flex-1 text-foreground">{player}</span>
                                <button
                                  onClick={() => removePlayer(player)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {players.map((player) => (
                  <div
                    key={player}
                    className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg"
                  >
                    <span className="text-foreground">{player}</span>
                    <button
                      onClick={() => removePlayer(player)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
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
              <Label className="text-foreground mb-2 block">Team Generation Mode</Label>
              <RadioGroup value={teamMode} onValueChange={(v) => setTeamMode(v as TeamMode)}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="random" id="random" />
                  <Label htmlFor="random" className="cursor-pointer">
                    Random Teams
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skill" id="skill" />
                  <Label htmlFor="skill" className="cursor-pointer">
                    Skill-Based Teams (Balanced)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="teamSize" className="text-foreground mb-2 block">
                Team Size
              </Label>
              <div className="flex gap-2">
                {[2, 3, 4].map((size) => (
                  <Button
                    key={size}
                    variant={teamSize === size ? "default" : "outline"}
                    onClick={() => setTeamSize(size)}
                    className="flex-1"
                  >
                    {size} Players
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={generateTeams}
              disabled={players.length < teamSize * 2}
              className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground"
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
                  Number of Games
                </Label>
                <Input
                  id="numGames"
                  type="number"
                  min={1}
                  max={50}
                  value={numGames}
                  onChange={(e) => setNumGames(parseInt(e.target.value) || 1)}
                  className="bg-muted border-border"
                />
              </div>

              <Button
                onClick={generateBracket}
                className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Generate Bracket
              </Button>

              {bracket.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-bold text-foreground mb-3">Match Schedule</h4>
                  <div className="space-y-2">
                    {bracket.map((game) => (
                      <div
                        key={game.id}
                        className="bg-muted p-3 rounded-lg flex items-center justify-between"
                      >
                        <span className="text-sm font-semibold text-foreground mr-3">
                          Game {game.index}
                        </span>
                        <span className="text-sm text-foreground flex-1">
                          {game.teamA.name} <span className="text-muted-foreground">vs</span>{" "}
                          {game.teamB.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={generateBracket}
                    variant="outline"
                    className="w-full mt-4"
                  >
                    <Shuffle className="w-4 h-4 mr-2" />
                    Re-generate Bracket
                  </Button>
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
