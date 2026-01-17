import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { UserPlus, X, Shuffle, Users, Trophy, GripVertical, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Checkbox } from "../components/ui/checkbox";
import { useLocation, useNavigate } from "react-router-dom";
import { createClient } from '@supabase/supabase-js';
import { 
  Team, 
  BracketType, 
  BracketRound, 
  BracketMatch,
  TournamentSettings,
  generateSingleEliminationBracket,
  generateDoubleEliminationBracket,
  advanceWinner,
  getChampion,
  calculateTeamStats
} from "../lib/bracket-utils";

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type TeamMode = "random" | "skill";

type Player = {
  id: string;
  name: string;
};

const BeerBall = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Check for Beer Olympics integration
  const params = new URLSearchParams(location.search);
  const olympicsGameCode = params.get('olympics');
  const olympicsEventId = params.get('event');
  const olympicsPlayers = params.get('players');
  
  // Player Management
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  
  // Team Generation
  const [teamMode, setTeamMode] = useState<TeamMode>("random");
  const [throwOrder, setThrowOrder] = useState<string[]>([]);
  const [drinkOrder, setDrinkOrder] = useState<string[]>([]);
  const [defenseOrder, setDefenseOrder] = useState<string[]>([]);
  const [activeRanking, setActiveRanking] = useState<"throw" | "drink" | "defense">("throw");
  
  // Teams
  const [teams, setTeams] = useState<Team[]>([]);
  
  // Tournament Settings
  const [tournamentSettings, setTournamentSettings] = useState<TournamentSettings>({
    bracketType: "single-elimination",
    allowByes: true,
    reseedAfterRound: false,
    thirdPlaceMatch: false,
    byeStrategy: "top-seeds",
    grandFinalReset: false,
    seedingStrategy: "random",
  });
  
  // Bracket State
  const [bracketRounds, setBracketRounds] = useState<BracketRound[]>([]);
  const [champion, setChampion] = useState<Team | null>(null);
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [isDraggingTeams, setIsDraggingTeams] = useState(false);

  // Initialize players from Beer Olympics
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

  // Drag-and-drop handler for player rankings
  const onDragEndPlayers = (result: DropResult) => {
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

  // Drag-and-drop handler for team player adjustments
  const onDragEndTeams = (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceTeamId = result.source.droppableId;
    const destTeamId = result.destination.droppableId;
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    setTeams((prevTeams) => {
      const newTeams = JSON.parse(JSON.stringify(prevTeams)) as Team[];
      const sourceTeam = newTeams.find(t => t.id === sourceTeamId);
      const destTeam = newTeams.find(t => t.id === destTeamId);
      
      if (!sourceTeam || !destTeam) return prevTeams;
      
      const [movedPlayer] = sourceTeam.players.splice(sourceIndex, 1);
      destTeam.players.splice(destIndex, 0, movedPlayer);
      
      return newTeams;
    });
    
    toast.info("Team adjusted - regenerate bracket to apply changes");
  };

  // Generate teams
  const generateTeams = () => {
    if (players.length < 2) {
      toast.error("Need at least 2 players to create teams");
      return;
    }

    let generatedTeams: Team[] = [];
    const teamSize = 2; // Beer Ball is 2v2

    if (teamMode === "random") {
      // Random shuffle
      const shuffled = [...players].sort(() => Math.random() - 0.5).map((p) => p.name);
      const numTeams = Math.floor(shuffled.length / teamSize);

      if (numTeams < 1) {
        toast.error("Need at least 2 players to create a team");
        return;
      }

      for (let i = 0; i < numTeams; i++) {
        generatedTeams.push({
          id: `team-${i + 1}`,
          name: `Team ${i + 1}`,
          players: shuffled.slice(i * teamSize, (i + 1) * teamSize),
        });
      }

      // Warn about leftover players (don't add them to teams)
      const leftover = shuffled.slice(numTeams * teamSize);
      if (leftover.length > 0) {
        toast.warning(`${leftover.join(", ")} couldn't be placed (need even number of players for 2v2)`);
      }
    } else {
      // Skill-based: snake draft using three rankings
      const numTeams = Math.floor(players.length / teamSize);
      if (numTeams < 1) {
        toast.error("Not enough players for teams");
        return;
      }
      
      generatedTeams = Array.from({ length: numTeams }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        players: [],
      }));

      const N = players.length;
      const scoreFromIndex = (index: number) => {
        if (index === -1) return 5;
        if (N === 1) return 5;
        return Math.round(((N - index - 1) / (N - 1)) * 9) + 1;
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
      let direction = 1;

      // Only assign players that fit into complete teams
      const playersToAssign = ranked.slice(0, numTeams * teamSize);
      const leftoverPlayers = ranked.slice(numTeams * teamSize);

      playersToAssign.forEach((player) => {
        generatedTeams[currentTeamIndex].players.push(player.name);

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

      if (leftoverPlayers.length > 0) {
        toast.warning(`${leftoverPlayers.map(p => p.name).join(", ")} couldn't be placed (need even number of players for 2v2)`);
      }
    }

    setTeams(generatedTeams);
    setBracketRounds([]);
    setChampion(null);
    toast.success(`${generatedTeams.length} teams created!`);
  };

  // Generate bracket
  const generateBracket = () => {
    if (teams.length < 2) {
      toast.error("Need at least 2 teams to generate a bracket");
      return;
    }

    // Validate all teams have exactly 2 players
    const invalidTeams = teams.filter(t => t.players.length !== 2);
    if (invalidTeams.length > 0) {
      toast.error(`All teams must have exactly 2 players. Fix: ${invalidTeams.map(t => t.name).join(", ")}`);
      return;
    }

    let rounds: BracketRound[] = [];
    
    if (tournamentSettings.bracketType === "single-elimination") {
      rounds = generateSingleEliminationBracket(teams, tournamentSettings);
    } else {
      rounds = generateDoubleEliminationBracket(teams, tournamentSettings);
    }
    
    setBracketRounds(rounds);
    setChampion(null);
    toast.success(`${tournamentSettings.bracketType} bracket created with ${rounds.length} rounds!`);
  };

  // Set match winner
  const setMatchWinner = (matchId: string, winner: Team | null) => {
    const newRounds = advanceWinner(bracketRounds, matchId, winner, tournamentSettings);
    setBracketRounds(newRounds);
    
    const newChampion = getChampion(newRounds, tournamentSettings);
    setChampion(newChampion);
    
    if (newChampion) {
      toast.success(`🏆 ${newChampion.name} wins the tournament!`);
    }
  };

  // Update tournament setting
  const updateSetting = <K extends keyof TournamentSettings>(
    key: K,
    value: TournamentSettings[K]
  ) => {
    setTournamentSettings(prev => ({ ...prev, [key]: value }));
    
    // Regenerate bracket if it exists
    if (bracketRounds.length > 0) {
      toast.info("Settings changed - regenerate bracket to apply");
    }
  };


  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="w-full" style={{ height: '48px' }} />
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Beer Ball Tournament</h1>
          <p className="text-muted-foreground">Create teams and run elimination brackets</p>
        </div>

        {/* Step 1: Players */}
        <Card className="bg-gradient-card border-border p-6 mb-6">
          <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            1. Players ({players.length})
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
          <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Shuffle className="w-5 h-5" />
            2. Team Setup
          </h3>

          <div className="space-y-4">
            <div>
              <Label className="mb-3 block">Team Generation Mode</Label>
              <RadioGroup value={teamMode} onValueChange={(v) => setTeamMode(v as TeamMode)}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="random" id="random" />
                  <Label htmlFor="random" className="cursor-pointer ml-2">
                    Random Teams - Shuffle players randomly
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skill" id="skill" />
                  <Label htmlFor="skill" className="cursor-pointer ml-2">
                    Skill-Based Teams - Balance teams by ranking players
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {teamMode === "skill" && (
              <div className="mb-4 bg-muted/50 p-4 rounded-lg">
                <Label className="mb-3 block font-semibold">Rank Players by Skill</Label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setActiveRanking("throw")}
                    className={`px-3 py-2 rounded text-sm ${
                      activeRanking === "throw" 
                        ? "bg-white text-black font-semibold" 
                        : "bg-muted text-muted-foreground hover:bg-background"
                    }`}
                  >
                    Throwing
                  </button>
                  <button
                    onClick={() => setActiveRanking("drink")}
                    className={`px-3 py-2 rounded text-sm ${
                      activeRanking === "drink" 
                        ? "bg-white text-black font-semibold" 
                        : "bg-muted text-muted-foreground hover:bg-background"
                    }`}
                  >
                    Drinking
                  </button>
                  <button
                    onClick={() => setActiveRanking("defense")}
                    className={`px-3 py-2 rounded text-sm ${
                      activeRanking === "defense" 
                        ? "bg-white text-black font-semibold" 
                        : "bg-muted text-muted-foreground hover:bg-background"
                    }`}
                  >
                    Defense
                  </button>
                </div>

                <p className="text-xs text-muted-foreground mb-3">
                  Drag to rank from best (top) to least skilled (bottom). Teams will be balanced using snake draft.
                </p>

                <DragDropContext onDragEnd={onDragEndPlayers}>
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
                                    className="flex items-center gap-3 bg-background px-3 py-2 rounded-lg border border-border hover:border-foreground transition-colors"
                                  >
                                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-mono text-muted-foreground w-8">#{index + 1}</span>
                                    <span className="flex-1 text-foreground font-medium">{player.name}</span>
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
              disabled={players.length < 2}
              className="w-full bg-white text-black border border-border hover:bg-gray-100"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Generate Teams
            </Button>
          </div>
        </Card>

        {/* Step 3: Teams Display with Drag & Drop */}
        {teams.length > 0 && (
          <Card className="bg-gradient-card border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5" />
                3. Teams ({teams.length})
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDraggingTeams(!isDraggingTeams)}
              >
                {isDraggingTeams ? "Lock Teams" : "Adjust Teams"}
              </Button>
            </div>

            {isDraggingTeams && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-300">
                  <strong>Drag & Drop Mode:</strong> Drag players between teams to adjust. Click "Lock Teams" when done.
                </p>
              </div>
            )}

            <DragDropContext onDragEnd={onDragEndTeams}>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <Droppable 
                    key={team.id} 
                    droppableId={team.id} 
                    isDropDisabled={!isDraggingTeams}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`bg-muted p-4 rounded-lg border-2 transition-colors ${
                          snapshot.isDraggingOver && isDraggingTeams
                            ? 'border-white bg-muted/70' 
                            : 'border-transparent'
                        }`}
                      >
                        <h4 className="font-bold text-foreground mb-3">{team.name}</h4>
                        <div className="space-y-2">
                          {team.players.map((player, idx) => (
                            <Draggable
                              key={`${team.id}-${player}`}
                              draggableId={`${team.id}-${player}`}
                              index={idx}
                              isDragDisabled={!isDraggingTeams}
                            >
                              {(prov, snap) => (
                                <div
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  className={`flex items-center gap-2 bg-background px-3 py-2 rounded ${
                                    snap.isDragging ? 'opacity-50' : ''
                                  } ${isDraggingTeams ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                >
                                  {isDraggingTeams && <GripVertical className="w-4 h-4 text-muted-foreground" />}
                                  <span className="text-foreground">{player}</span>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>
            </DragDropContext>

            <div className="mt-4 flex gap-2">
              <Button
                onClick={generateTeams}
                variant="outline"
                className="flex-1"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Re-generate Teams
              </Button>
            </div>
          </Card>
        )}

        {/* Step 4: Tournament Settings */}
        {teams.length >= 2 && (
          <Card className="bg-gradient-card border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Settings className="w-5 h-5" />
                4. Tournament Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>

            <div className="space-y-4">
              {/* Always visible: Bracket Type */}
              <div>
                <Label className="mb-3 block font-semibold">Bracket Type</Label>
                <RadioGroup 
                  value={tournamentSettings.bracketType} 
                  onValueChange={(v) => updateSetting("bracketType", v as BracketType)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                      <RadioGroupItem value="single-elimination" id="single" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="single" className="cursor-pointer font-medium">
                          Single Elimination
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          One loss and you're out. Fast and decisive tournament format.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                      <RadioGroupItem value="double-elimination" id="double" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="double" className="cursor-pointer font-medium">
                          Double Elimination
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upper and lower brackets. Teams must lose twice to be eliminated.
                        </p>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Collapsible Advanced Settings */}
              {showSettings && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <Label className="block font-semibold mb-3">Advanced Options</Label>
                  
                  {/* Allow Byes */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Checkbox
                      id="allowByes"
                      checked={tournamentSettings.allowByes}
                      onCheckedChange={(v) => updateSetting("allowByes", !!v)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor="allowByes" className="cursor-pointer font-medium">
                        Allow Byes
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Teams with byes automatically advance to the next round if the bracket isn't a power of 2.
                      </p>
                    </div>
                  </div>

                  {/* Bye Strategy */}
                  {tournamentSettings.allowByes && (
                    <div className="ml-6 space-y-2">
                      <Label className="text-sm">Bye Strategy</Label>
                      <RadioGroup 
                        value={tournamentSettings.byeStrategy} 
                        onValueChange={(v) => updateSetting("byeStrategy", v as "top-seeds" | "random" | "none")}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="top-seeds" id="top-seeds" />
                          <Label htmlFor="top-seeds" className="cursor-pointer text-sm">
                            Top Seeds Get Byes (Recommended)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="random" id="random-byes" />
                          <Label htmlFor="random-byes" className="cursor-pointer text-sm">
                            Random Bye Distribution
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                  {/* Third Place Match (Single Elimination Only) */}
                  {tournamentSettings.bracketType === "single-elimination" && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Checkbox
                        id="thirdPlace"
                        checked={tournamentSettings.thirdPlaceMatch}
                        onCheckedChange={(v) => updateSetting("thirdPlaceMatch", !!v)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label htmlFor="thirdPlace" className="cursor-pointer font-medium">
                          Third Place Match
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Semi-final losers play for 3rd place.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Grand Final Reset (Double Elimination Only) */}
                  {tournamentSettings.bracketType === "double-elimination" && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Checkbox
                        id="grandReset"
                        checked={tournamentSettings.grandFinalReset}
                        onCheckedChange={(v) => updateSetting("grandFinalReset", !!v)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label htmlFor="grandReset" className="cursor-pointer font-medium">
                          Grand Final Bracket Reset
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          If lower bracket winner wins the grand final, play a second final to determine champion.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Reseed After Round */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Checkbox
                      id="reseed"
                      checked={tournamentSettings.reseedAfterRound}
                      onCheckedChange={(v) => updateSetting("reseedAfterRound", !!v)}
                      className="mt-1"
                      disabled
                    />
                    <div className="flex-1">
                      <Label htmlFor="reseed" className="cursor-pointer font-medium text-muted-foreground">
                        Re-seed After Each Round (Coming Soon)
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Highest remaining seed always plays lowest. Not yet implemented.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={generateBracket}
                className="w-full bg-white text-black border border-border hover:bg-gray-100"
              >
                <Trophy className="w-4 h-4 mr-2" />
                Generate {tournamentSettings.bracketType === "single-elimination" ? "Single" : "Double"} Elimination Bracket
              </Button>
            </div>
          </Card>
        )}

        {/* Step 5: Bracket Display */}
        {bracketRounds.length > 0 && (
          <Card className="bg-gradient-card border-border p-6 mb-6">
            <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              5. Tournament Bracket
            </h3>

            <div className="space-y-6">
              {bracketRounds.map((round) => {
                // Filter out bye matches (auto-advanced)
                const actualMatches = round.matches.filter(m => {
                  // Hide bye matches
                  if (m.isBye) return false;
                  // Keep matches where both teams are present
                  if (m.teamA && m.teamB) return true;
                  // Keep matches where both are TBD (waiting for previous round)
                  if (!m.teamA && !m.teamB) return true;
                  // Hide matches where one is null and winner is already set (auto-bye)
                  if (m.winner) return false;
                  // Keep everything else
                  return true;
                });

                // Get bye teams for display
                const byeMatches = round.matches.filter(m => m.isBye && m.winner);

                return (
                  <div key={`round-${round.roundIndex}`} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-lg text-foreground">
                        {round.roundName}
                        {round.isLowerBracket && (
                          <span className="ml-2 text-sm font-normal text-orange-400">(Lower Bracket)</span>
                        )}
                      </h4>
                      <span className="text-sm text-muted-foreground">
                        {actualMatches.length} {actualMatches.length === 1 ? 'match' : 'matches'}
                        {byeMatches.length > 0 && ` • ${byeMatches.length} bye${byeMatches.length > 1 ? 's' : ''}`}
                      </span>
                    </div>

                    {/* Show bye information if any */}
                    {byeMatches.length > 0 && (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <div className="text-sm text-blue-300">
                          <strong>Byes:</strong> {byeMatches.map(m => m.winner?.name).join(', ')} advance{byeMatches.length === 1 ? 's' : ''} automatically
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      {actualMatches.map((match) => (
                      <div 
                        key={match.id} 
                        className="bg-muted p-4 rounded-lg border border-border"
                      >
                        <div className="space-y-2">
                          {/* Team A */}
                          <button
                            onClick={() => match.teamA && setMatchWinner(match.id, match.teamA)}
                            disabled={!match.teamA || !match.teamB}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                              match.winner?.id === match.teamA?.id
                                ? 'bg-white text-black font-bold shadow-lg scale-105'
                                : match.teamA && match.teamB
                                ? 'bg-background text-foreground hover:bg-background/80 hover:scale-102'
                                : 'bg-background/50 text-muted-foreground cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{match.teamA?.name || `TBD`}</span>
                              {match.winner?.id === match.teamA?.id && (
                                <Trophy className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                          </button>

                          {/* VS Divider */}
                          <div className="text-center text-xs text-muted-foreground font-semibold">
                            VS
                          </div>

                          {/* Team B */}
                          <button
                            onClick={() => match.teamB && setMatchWinner(match.id, match.teamB)}
                            disabled={!match.teamA || !match.teamB}
                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                              match.winner?.id === match.teamB?.id
                                ? 'bg-white text-black font-bold shadow-lg scale-105'
                                : match.teamA && match.teamB
                                ? 'bg-background text-foreground hover:bg-background/80 hover:scale-102'
                                : 'bg-background/50 text-muted-foreground cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{match.teamB?.name || `TBD`}</span>
                              {match.winner?.id === match.teamB?.id && (
                                <Trophy className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                          </button>

                          {/* Reset Button */}
                          {match.winner && (
                            <button
                              onClick={() => setMatchWinner(match.id, null)}
                              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1"
                            >
                              Reset Match
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
              })}

              {/* Champion Display */}
              {champion && (
                <div className="mt-8 p-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 rounded-lg text-center">
                  <Trophy className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
                  <h2 className="text-3xl font-bold text-foreground mb-2">
                    🏆 Tournament Champion 🏆
                  </h2>
                  <p className="text-2xl font-bold text-white mb-4">
                    {champion.name}
                  </p>
                  <div className="text-sm text-muted-foreground">
                    Players: {champion.players.join(', ')}
                  </div>

                  {olympicsGameCode && olympicsEventId && (
                    <Button
                      className="mt-6"
                      onClick={async () => {
                        try {
                          // Calculate points based on tournament performance
                          const teamPoints: Record<string, number> = {};
                          
                          teams.forEach((team) => {
                            const stats = calculateTeamStats(bracketRounds, team, tournamentSettings);
                            // Award points: 10 per win, bonus for champion
                            let points = stats.wins * 10;
                            if (team.id === champion.id) {
                              points += 50; // Champion bonus
                            }
                            teamPoints[team.id] = points;
                          });

                          // Assign points to players
                          const playerScores: Record<string, number> = {};
                          teams.forEach((team) => {
                            const teamScore = teamPoints[team.id] || 0;
                            team.players.forEach((playerName) => {
                              playerScores[playerName] = teamScore;
                            });
                          });

                          // Get event and players from Beer Olympics
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

                          // Insert scores
                          const scoresToInsert = olympicsPlayersData.map(p => ({
                            event_id: olympicsEventId,
                            player_id: p.id,
                            points: playerScores[p.name] || 0,
                            notes: `Beer Ball - ${teams.find(t => t.players.includes(p.name))?.name || 'Unknown'}`,
                          }));

                          const { error: scoreErr } = await supabase
                            .from('beer_olympics_scores')
                            .insert(scoresToInsert);

                          if (scoreErr) throw scoreErr;

                          // Update player totals
                          for (const p of olympicsPlayersData) {
                            const score = playerScores[p.name] || 0;
                            await supabase
                              .from('beer_olympics_players')
                              .update({ total_points: p.total_points + score })
                              .eq('id', p.id);
                          }

                          toast.success('Results sent to Beer Olympics!');

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
              )}
            </div>

            <Button
              onClick={generateBracket}
              variant="outline"
              className="w-full mt-4"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Re-generate Bracket
            </Button>
          </Card>
        )}

        {/* Team Stats (if bracket exists) */}
        {bracketRounds.length > 0 && (
          <Card className="bg-gradient-card border-border p-6 mb-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Team Statistics</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => {
                const stats = calculateTeamStats(bracketRounds, team, tournamentSettings);
                return (
                  <div key={team.id} className="bg-muted p-4 rounded-lg">
                    <h4 className="font-bold text-foreground mb-2">{team.name}</h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Wins:</span>
                        <span className="text-green-400 font-semibold">{stats.wins}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Losses:</span>
                        <span className="text-red-400 font-semibold">{stats.losses}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={stats.isEliminated ? "text-red-400" : "text-green-400"}>
                          {stats.placement}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BeerBall;
