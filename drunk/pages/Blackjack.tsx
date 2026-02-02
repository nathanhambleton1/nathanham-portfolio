import { useEffect, useState } from "react";
import { Users, Settings, QrCode, Copy, ChevronDown, Info } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Switch } from "../components/ui/switch";
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from "react-router-dom";
import { toast } from "../components/ui/use-toast";
import { Toaster } from "../components/ui/toaster";

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Screen = "join-create" | "enter-name" | "confirm-settings" | "home";

const Blackjack = () => {
  const STORAGE_KEY_CODE = "blackjack:gameCode";
  const STORAGE_KEY_NAME = "blackjack:name";
  const STORAGE_KEY_RECENT = "blackjack:recentGames";

  const [screen, setScreen] = useState<Screen>("join-create");
  const [gameCode, setGameCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"join" | "create" | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // temporary settings used when creating a new game
  const [tempDealerStandsOnSoft17, setTempDealerStandsOnSoft17] = useState<boolean>(true);
  const [tempInsuranceEnabled, setTempInsuranceEnabled] = useState<boolean>(true);
  const [tempDoubleDownsEnabled, setTempDoubleDownsEnabled] = useState<boolean>(true);
  const [tempNumberOfSplits, setTempNumberOfSplits] = useState<string>("3");
  const [tempNumberOfDecks, setTempNumberOfDecks] = useState<string>("4");
  const [game, setGame] = useState<any | null>(null);
  const [player, setPlayer] = useState<any | null>(null);
  const [recentGames, setRecentGames] = useState<string[]>([]);
  const [playersList, setPlayersList] = useState<any[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    const storedCode = localStorage.getItem(STORAGE_KEY_CODE);
    const storedName = localStorage.getItem(STORAGE_KEY_NAME);
    const storedRecent = localStorage.getItem(STORAGE_KEY_RECENT);

    if (storedCode) setGameCode(storedCode);
    if (storedName) setName(storedName);
    if (storedRecent) {
      try {
        setRecentGames(JSON.parse(storedRecent));
      } catch (e) {
        console.error("Failed to parse recent games:", e);
      }
    }
  }, []);

  const handleCreateGame = async () => {
    setLoading(true);
    setError(null);

    try {
      // For now, just set a dummy game
      const newGame = {
        id: Math.random().toString(36).substr(2, 9),
        code: Math.random().toString(36).substr(2, 6).toUpperCase(),
        settings: {
          dealerStandsOnSoft17: tempDealerStandsOnSoft17,
          insuranceEnabled: tempInsuranceEnabled,
          doubleDownsEnabled: tempDoubleDownsEnabled,
          numberOfSplits: parseInt(tempNumberOfSplits),
          numberOfDecks: parseInt(tempNumberOfDecks),
        },
        players: [],
      };

      setGame(newGame);
      setGameCode(newGame.code);
      localStorage.setItem(STORAGE_KEY_CODE, newGame.code);
      // Add to recent games
      const updatedRecent = [newGame.code, ...recentGames.filter(c => c !== newGame.code)].slice(0, 5);
      setRecentGames(updatedRecent);
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updatedRecent));
      // Don't set screen here - let caller decide
    } catch (err) {
      setError("Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async () => {
    if (!gameCode.trim()) {
      setError("Please enter a game code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // For now, assume game exists
      const joinedGame = {
        id: "dummy",
        code: gameCode.toUpperCase(),
        settings: {
          dealerStandsOnSoft17: true,
          insuranceEnabled: true,
          doubleDownsEnabled: true,
          numberOfSplits: 3,
          numberOfDecks: 4,
        },
        players: [],
      };

      setGame(joinedGame);
      // Add to recent games
      const updatedRecent = [gameCode.toUpperCase(), ...recentGames.filter(c => c !== gameCode.toUpperCase())].slice(0, 5);
      setRecentGames(updatedRecent);
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updatedRecent));
      setScreen("enter-name");
    } catch (err) {
      setError("Game not found");
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = () => {
    const cleaned = (name ?? '').trim();
    if (!cleaned) return;
    // Validate: only letters and spaces, 1-10 chars
    if (!/^[A-Z ]{1,10}$/.test(cleaned)) {
      setError('Name must be letters and spaces only (max 10 characters)');
      return;
    }
    setError(null);

    localStorage.setItem(STORAGE_KEY_NAME, name);

    if (mode === "create") {
      setScreen("confirm-settings");
    } else {
      // For join, assume game exists and go to home
      setScreen("home");
    }
  };

  const handleSettingsConfirm = () => {
    // Create the game with settings and go to home
    setLoading(true);
    setError(null);

    try {
      // For now, just set a dummy game
      const newGame = {
        id: Math.random().toString(36).substr(2, 9),
        code: gameCode || Math.random().toString(36).substr(2, 6).toUpperCase(),
        settings: {
          dealerStandsOnSoft17: tempDealerStandsOnSoft17,
          insuranceEnabled: tempInsuranceEnabled,
          doubleDownsEnabled: tempDoubleDownsEnabled,
          numberOfSplits: parseInt(tempNumberOfSplits),
          numberOfDecks: parseInt(tempNumberOfDecks),
        },
        players: [],
      };

      setGame(newGame);
      setGameCode(newGame.code);
      localStorage.setItem(STORAGE_KEY_CODE, newGame.code);
      // Add to recent games
      const updatedRecent = [newGame.code, ...recentGames.filter(c => c !== newGame.code)].slice(0, 5);
      setRecentGames(updatedRecent);
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(updatedRecent));
      setScreen("home");
    } catch (err) {
      setError("Failed to create game");
    } finally {
      setLoading(false);
    }
  };

  const handleRecentGameSelect = async (code: string) => {
    setLoading(true);
    try {
      setGameCode(code);
      setMode('join');
      setScreen('enter-name');
    } catch (e) {
      setScreen('enter-name');
    } finally {
      setLoading(false);
    }
  };

  const renderJoinCreate = () => (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-3xl">Blackjack</CardTitle>
          <CardDescription>
            Join an existing game or create a new one to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-8">
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                if (!gameCode.trim()) return;
                try {
                  setLoading(true);
                  // For now, assume game exists
                  const joinedGame = {
                    id: "dummy",
                    code: gameCode.toUpperCase(),
                    settings: {
                      dealerStandsOnSoft17: true,
                      insuranceEnabled: true,
                      doubleDownsEnabled: true,
                      numberOfSplits: 3,
                      numberOfDecks: 4,
                    },
                    players: [],
                  };
                  setGame(joinedGame);
                  setMode("join");
                  setScreen("enter-name");
                } catch (err: any) {
                  console.error('Join check failed', err);
                  setError((err && err.message) || 'Failed to check game');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Input
                placeholder="Enter game code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus
              />
              <Button className="w-full py-4 text-lg font-semibold shadow-md" size="lg" type="submit" disabled={!gameCode.trim() || loading}>
                {loading ? 'Looking for game...' : 'Join Game'}
              </Button>
            </form>
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-border" />
              <span className="text-muted-foreground text-xs">or</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <Button
              className="w-full py-4 text-lg font-semibold shadow-md"
              size="lg"
              onClick={() => {
                setMode("create");
                setScreen("enter-name");
              }}
            >
              Create Game
            </Button>
            {recentGames && recentGames.length > 0 && (
              <div className="mt-6">
                <div className="text-sm text-muted-foreground mb-2">Recent games</div>
                <div className="flex gap-2">
                  {recentGames.map((c) => (
                    <Button key={c} variant="outline" className="px-3" onClick={() => handleRecentGameSelect(c)}>
                      {c}
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

  const renderEnterName = () => (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl mb-2">Enter Your Name</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Create a new game and become the host."
              : `Joining game: ${gameCode}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleNameSubmit();
            }}
          >
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => {
                const raw = e.target.value ?? '';
                const upper = raw.toUpperCase();
                let filtered = upper.replace(/[^A-Z ]+/g, '');
                if (filtered.length > 10) filtered = filtered.slice(0, 10);
                setName(filtered);
              }}
              maxLength={10}
              autoFocus
            />
            <div className="flex flex-col gap-2">
              <Button className="w-full" type="submit" disabled={!/^[A-Z ]{1,10}$/.test((name||'').trim()) || loading}>
                {loading ? "Please wait..." : "Continue"}
              </Button>
              {error && <div className="text-destructive text-sm">{error}</div>}
              {name.length > 10 && (
                <div className="text-destructive text-sm">Name must be 10 characters or less.</div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  const renderConfirmSettings = () => (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Game Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label>Dealer stands on soft 17</label>
            <Switch
              checked={tempDealerStandsOnSoft17}
              onCheckedChange={setTempDealerStandsOnSoft17}
            />
          </div>
          <div className="flex items-center justify-between">
            <label>Insurance enabled</label>
            <Switch
              checked={tempInsuranceEnabled}
              onCheckedChange={setTempInsuranceEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <label>Double downs enabled</label>
            <Switch
              checked={tempDoubleDownsEnabled}
              onCheckedChange={setTempDoubleDownsEnabled}
            />
          </div>
          <div className="space-y-2">
            <label>Number of splits</label>
            <div className="flex gap-2">
              {[0, 1, 3].map((num) => (
                <Button
                  key={num}
                  type="button"
                  variant={parseInt(tempNumberOfSplits) === num ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTempNumberOfSplits(num.toString())}
                  className="flex-1"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label>Number of decks</label>
            <div className="flex gap-2">
              {[4, 6, 8].map((num) => (
                <Button
                  key={num}
                  type="button"
                  variant={parseInt(tempNumberOfDecks) === num ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTempNumberOfDecks(num.toString())}
                  className="flex-1"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={handleSettingsConfirm} className="w-full">
            Start Game
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderHome = () => (
    <div className="min-h-screen bg-gradient-bg p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Blackjack Game</CardTitle>
            <CardDescription>Game Code: {gameCode}</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Welcome to Blackjack! Game logic to be implemented.</p>
            <p>Settings: Dealer stands on soft 17: {game?.settings?.dealerStandsOnSoft17 ? 'Yes' : 'No'}</p>
            <p>Insurance: {game?.settings?.insuranceEnabled ? 'Enabled' : 'Disabled'}</p>
            <p>Double Downs: {game?.settings?.doubleDownsEnabled ? 'Enabled' : 'Disabled'}</p>
            <p>Number of Splits: {game?.settings?.numberOfSplits}</p>
            <p>Number of Decks: {game?.settings?.numberOfDecks}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  switch (screen) {
    case "join-create":
      return renderJoinCreate();
    case "enter-name":
      return renderEnterName();
    case "confirm-settings":
      return renderConfirmSettings();
    case "home":
      return renderHome();
    default:
      return renderJoinCreate();
  }
};

export default Blackjack;
