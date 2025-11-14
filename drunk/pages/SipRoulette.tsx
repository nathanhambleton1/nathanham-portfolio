import { useState } from "react";
import { BackButton } from "../components/BackButton";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Dices, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

const prompts = [
  "Take 1 sip",
  "Take 2 sips",
  "Take 3 sips",
  "Give 1 sip to someone",
  "Give 2 sips to someone",
  "Everyone drinks!",
  "Last person to raise their hand drinks",
  "Swap drinks with someone for one round",
  "Choose someone to take a shot",
  "Finish your drink!",
  "You're safe this round!",
  "Pick two people to drink",
  "Drink with your non-dominant hand or take 2 sips",
  "Truth or dare? Loser drinks!",
  "Do your best impression or take 3 sips",
];

interface Result {
  player: string;
  prompt: string;
}

const SipRoulette = () => {
  const [players, setPlayers] = useState<string[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [currentResult, setCurrentResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);

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
    toast.success(`${trimmed} joined the game!`);
  };

  const removePlayer = (name: string) => {
    setPlayers(players.filter((p) => p !== name));
    toast.info(`${name} left the game`);
  };

  const spin = () => {
    if (players.length === 0) {
      toast.error("Add at least one player first!");
      return;
    }

    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    const result = { player: randomPlayer, prompt: randomPrompt };
    setCurrentResult(result);
    setHistory([result, ...history].slice(0, 5));

    toast.success("Spun! Check the result 🎲");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addPlayer();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <div className="w-full" style={{ height: '48px' }} />
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Sip Roulette</h1>
          <p className="text-muted-foreground">Spin the wheel of fate!</p>
        </div>

        {/* Players Section */}
        <Card className="bg-gradient-card border-border p-6 mb-6">
          <h3 className="text-lg font-bold text-foreground mb-3">Players ({players.length})</h3>
          
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
              className="bg-white text-black hover:bg-gray-200"
            >
              <UserPlus className="w-5 h-5" />
            </Button>
          </div>

          {players.length > 0 ? (
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
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No players yet. Add some to get started!
            </p>
          )}
        </Card>

        {/* Spin Button */}
        <Button
          onClick={spin}
          disabled={players.length === 0}
          className="w-full bg-white text-black hover:bg-gray-200 py-8 text-xl mb-6 border border-gray-300"
        >
          <Dices className="w-6 h-6 mr-2" />
          Spin the Roulette!
        </Button>

        {/* Current Result */}
        {currentResult && (
          <Card className="bg-gradient-primary border-0 p-8 mb-6 text-center animate-pulse-glow">
            <p className="text-2xl text-white mb-2">The winner is:</p>
            <p className="text-4xl font-bold text-white mb-3">
              {currentResult.player}
            </p>
            <p className="text-2xl text-primary-foreground/90">
              {currentResult.prompt}
            </p>
          </Card>
        )}

        {/* History */}
        {history.length > 0 && (
          <Card className="bg-gradient-card border-border p-6">
            <h3 className="text-lg font-bold text-foreground mb-3">Recent Spins</h3>
            <div className="space-y-2">
              {history.map((result, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-2 border-b border-border last:border-0"
                >
                  <span className="font-semibold text-foreground">{result.player}</span>
                  <span className="text-sm text-muted-foreground">{result.prompt}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SipRoulette;
