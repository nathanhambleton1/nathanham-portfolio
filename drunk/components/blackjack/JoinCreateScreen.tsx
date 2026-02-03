import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Crown } from "lucide-react";

interface JoinCreateScreenProps {
  gameCode: string;
  setGameCode: (code: string) => void;
  recentGames: string[];
  loading: boolean;
  error: string | null;
  onJoinGame: () => void;
  onCreateGame: () => void;
  onRecentGameSelect: (code: string) => void;
}

const JoinCreateScreen = ({
  gameCode,
  setGameCode,
  recentGames,
  loading,
  error,
  onJoinGame,
  onCreateGame,
  onRecentGameSelect,
}: JoinCreateScreenProps) => {
  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl">Blackjack</CardTitle>
          <CardDescription>
            Join an existing table or create a new one as dealer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-8">
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                onJoinGame();
              }}
            >
              <Input
                placeholder="Enter game code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
              />
              {error && <div className="text-destructive text-sm text-center">{error}</div>}
              <Button type="submit" className="w-full py-4 text-lg font-semibold shadow-md" disabled={loading}>
                {loading ? "Joining..." : "Join Table"}
              </Button>
            </form>
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">OR</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <Button
              className="w-full py-4 text-lg font-semibold shadow-md"
              size="lg"
              onClick={onCreateGame}
            >
              <Crown className="w-5 h-5 mr-2" />
              Create Table (Dealer)
            </Button>
            {recentGames && recentGames.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">Recent Games</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {recentGames.map((code) => (
                    <Button
                      key={code}
                      variant="outline"
                      size="sm"
                      onClick={() => onRecentGameSelect(code)}
                    >
                      {code}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinCreateScreen;
