import { useState } from "react";
import { BackButton } from "../components/BackButton";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const BeerPong = () => {
  const [cupCount, setCupCount] = useState<6 | 10>(10);
  const [team1Name, setTeam1Name] = useState("Team 1");
  const [team2Name, setTeam2Name] = useState("Team 2");
  const [team1Cups, setTeam1Cups] = useState(10);
  const [team2Cups, setTeam2Cups] = useState(10);
  const [winner, setWinner] = useState<string | null>(null);

  const handleCupCountChange = (count: 6 | 10) => {
    setCupCount(count);
    setTeam1Cups(count);
    setTeam2Cups(count);
    setWinner(null);
  };

  const adjustCups = (team: 1 | 2, delta: number) => {
    if (team === 1) {
      const newCups = Math.max(0, Math.min(cupCount, team1Cups + delta));
      setTeam1Cups(newCups);
      if (newCups === 0 && team2Cups > 0) {
        setWinner(team2Name);
        toast.success(`${team2Name} Wins! 🏆`);
      } else if (winner) {
        setWinner(null);
      }
    } else {
      const newCups = Math.max(0, Math.min(cupCount, team2Cups + delta));
      setTeam2Cups(newCups);
      if (newCups === 0 && team1Cups > 0) {
        setWinner(team1Name);
        toast.success(`${team1Name} Wins! 🏆`);
      } else if (winner) {
        setWinner(null);
      }
    }
  };

  const handleReset = () => {
    setTeam1Cups(cupCount);
    setTeam2Cups(cupCount);
    setWinner(null);
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <BackButton />

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Beer Pong Scoreboard</h1>
          <p className="text-muted-foreground">Track cups and dominate the table</p>
        </div>

        {/* Cup Count Selector */}
        <div className="flex gap-3 justify-center mb-6">
          <Button
            variant={cupCount === 10 ? "default" : "outline"}
            onClick={() => handleCupCountChange(10)}
            className={cupCount === 10 ? "bg-gradient-primary" : ""}
          >
            10 Cups
          </Button>
          <Button
            variant={cupCount === 6 ? "default" : "outline"}
            onClick={() => handleCupCountChange(6)}
            className={cupCount === 6 ? "bg-gradient-primary" : ""}
          >
            6 Cups
          </Button>
        </div>

        {/* Winner Display */}
        {winner && (
          <Card className="bg-gradient-primary border-0 p-6 mb-6 text-center animate-pulse-glow">
            <p className="text-3xl font-bold text-primary-foreground">
              🏆 {winner} Wins! 🏆
            </p>
          </Card>
        )}

        {/* Teams */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Team 1 */}
          <Card className="bg-gradient-card border-border p-6">
            <div className="mb-4">
              <Label htmlFor="team1" className="text-sm text-muted-foreground">
                Team Name
              </Label>
              <Input
                id="team1"
                value={team1Name}
                onChange={(e) => setTeam1Name(e.target.value)}
                className="mt-1 bg-muted border-border text-lg font-semibold"
                maxLength={20}
              />
            </div>

            <div className="text-center mb-4">
              <p className="text-6xl font-bold text-primary mb-2">{team1Cups}</p>
              <p className="text-muted-foreground">Cups Remaining</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14"
                onClick={() => adjustCups(1, -1)}
                disabled={team1Cups === 0}
              >
                <Minus className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-14"
                onClick={() => adjustCups(1, 1)}
                disabled={team1Cups === cupCount}
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </Card>

          {/* Team 2 */}
          <Card className="bg-gradient-card border-border p-6">
            <div className="mb-4">
              <Label htmlFor="team2" className="text-sm text-muted-foreground">
                Team Name
              </Label>
              <Input
                id="team2"
                value={team2Name}
                onChange={(e) => setTeam2Name(e.target.value)}
                className="mt-1 bg-muted border-border text-lg font-semibold"
                maxLength={20}
              />
            </div>

            <div className="text-center mb-4">
              <p className="text-6xl font-bold text-secondary mb-2">{team2Cups}</p>
              <p className="text-muted-foreground">Cups Remaining</p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14"
                onClick={() => adjustCups(2, -1)}
                disabled={team2Cups === 0}
              >
                <Minus className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-14"
                onClick={() => adjustCups(2, 1)}
                disabled={team2Cups === cupCount}
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
          </Card>
        </div>

        {/* Reset Button */}
        <Button
          onClick={handleReset}
          variant="outline"
          className="w-full py-6 text-lg"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Reset Game
        </Button>
      </div>
    </div>
  );
};

export default BeerPong;
