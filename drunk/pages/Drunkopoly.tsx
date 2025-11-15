import { useState } from "react";
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

type Screen = "join-create" | "enter-name" | "home";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";
console.log("Drunkopoly API_BASE:", API_BASE);

const Drunkopoly = () => {
  const [screen, setScreen] = useState<Screen>("join-create");
  const [gameCode, setGameCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"join" | "create" | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<any | null>(null);
  const [player, setPlayer] = useState<any | null>(null);

  // Step 1: Join/Create Game
  if (screen === "join-create") {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-3xl">Drunkopoly</CardTitle>
            <CardDescription>
              Join an existing game or create a new one to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-8">
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
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-border" />
                <span className="text-muted-foreground text-xs">or</span>
                <div className="flex-1 border-t border-border" />
              </div>
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (gameCode.trim()) {
                    setMode("join");
                    setScreen("enter-name");
                  }
                }}
              >
                <Input
                  placeholder="Enter game code"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoFocus
                />
                <Button className="w-full" type="submit" disabled={!gameCode.trim()}>
                  Join Game
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Enter Name
  if (screen === "enter-name") {
    return (
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
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return;
                setError(null);
                setLoading(true);
                try {
                  if (mode === "create") {
                    // 1) create game
                    const createRes = await fetch(`${API_BASE}/games`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: null }),
                    });

                    const createBody = await createRes.json().catch(() => ({}));
                    if (!createRes.ok) {
                      throw new Error(createBody.error || "Failed to create game");
                    }
                    const created = createBody.game;

                    // 2) join as host
                    const joinRes = await fetch(`${API_BASE}/games/join`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ code: created.code, name }),
                    });

                    const joinBody = await joinRes.json().catch(() => ({}));
                    if (!joinRes.ok) {
                      throw new Error(joinBody.error || "Failed to join created game");
                    }

                    const { game: g, player: p } = joinBody;
                    setGame(g);
                    setPlayer(p);
                    setGameCode(g.code);
                    setScreen("home");
                  } else {
                    // join existing
                    const joinRes = await fetch(`${API_BASE}/games/join`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ code: gameCode, name }),
                    });

                    const joinBody = await joinRes.json().catch(() => ({}));
                    if (!joinRes.ok) {
                      throw new Error(joinBody.error || "Failed to join game");
                    }

                    const { game: g, player: p } = joinBody;
                    setGame(g);
                    setPlayer(p);
                    setGameCode(g.code);
                    setScreen("home");
                  }
                } catch (err: any) {
                  console.error("Join/Create error:", err);
                  setError(err.message || "Unexpected error");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Input
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
              />
              <div className="flex flex-col gap-2">
                <Button className="w-full" type="submit" disabled={!name.trim() || loading}>
                  {loading ? "Please wait..." : "Continue"}
                </Button>
                {error && <div className="text-destructive text-sm">{error}</div>}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Home (main game screen)
  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        {/* Name (top left) */}
        <div className="font-semibold text-lg text-foreground">
          {player?.name ?? name}
        </div>
        {/* Game code (top right) with popover */}
        <GameCodePopover code={game?.code ?? gameCode} />
      </div>

      {/* Centered balance */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="mb-8">
          <div className="text-muted-foreground text-lg mb-2 text-center">
            Current Balance
          </div>
          <div className="text-6xl font-extrabold text-primary text-center">
            $
            {(player?.balance ?? game?.initial_balance ?? 1500).toLocaleString()}
          </div>
        </div>

        {/* Pay section */}
        <Section title="Pay">
          <div className="grid grid-cols-2 gap-4 w-64">
            <Button variant="secondary" className="py-6">
              Rent
            </Button>
            <Button variant="secondary" className="py-6">
              Bank
            </Button>
            <Button variant="secondary" className="py-6">
              Players
            </Button>
            <Button variant="secondary" className="py-6">
              Tax
            </Button>
          </div>
        </Section>

        {/* Collect section */}
        <Section title="Collect" className="mt-8">
          <div className="grid grid-cols-2 gap-4 w-64">
            <Button variant="secondary" className="py-6">
              Bank
            </Button>
            <Button variant="secondary" className="py-6">
              Pass Go
            </Button>
            <Button variant="secondary" className="py-6">
              Free Parking
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
};

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      <div className="text-xl font-bold mb-4 text-foreground">{title}</div>
      {children}
    </div>
  );
}

function GameCodePopover({ code }: { code: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="font-mono px-4 py-2 text-base font-bold uppercase tracking-widest"
        >
          {code}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-lg font-bold text-center">{code}</div>
          <Button variant="destructive" className="w-full mt-2">
            Leave Game
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default Drunkopoly;
