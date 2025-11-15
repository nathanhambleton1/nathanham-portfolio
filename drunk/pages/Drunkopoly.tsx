import { useEffect, useState } from "react";
import PayPopup from "../components/PayPopup";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import CollectPopup from "../components/CollectPopup";
import SipPopup from "../components/SipPopup";
import ActivityLog from "../components/ActivityLog";
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
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "../components/ui/alert-dialog";

type Screen = "join-create" | "enter-name" | "home";

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";
console.log("Drunkopoly API_BASE:", API_BASE);

const Drunkopoly = () => {
    // Log out of game: remove from game, keep account data
    const handleLogoutOfGame = () => {
      setGame(null);
      setGameCode("");
      // Do NOT clear name or localStorage name
      setScreen("join-create");
    };
  const STORAGE_KEY_CODE = "drunkopoly:gameCode";
  const STORAGE_KEY_NAME = "drunkopoly:name";

  const [screen, setScreen] = useState<Screen>("join-create");
  const [gameCode, setGameCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"join" | "create" | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<any | null>(null);
  const [player, setPlayer] = useState<any | null>(null);
  const [playersList, setPlayersList] = useState<any[]>([]);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMode, setPayMode] = useState<"bank" | "players" | "tax" | null>(null);
  const [sipModalOpen, setSipModalOpen] = useState(false);
  // Free Parking pot state
  const [freeParkingPot, setFreeParkingPot] = useState(0);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectMode, setCollectMode] = useState<'bank'|'pass_go'|'free_parking'|null>(null);
  const [blockedPaymentMessage, setBlockedPaymentMessage] = useState<string | null>(null);

  // On mount, try to restore session from localStorage and auto-join
  useEffect(() => {
    const savedCode = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_CODE) : null;
    const savedName = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_NAME) : null;
    if (savedCode && savedName) {
      // attempt to re-join the game with saved credentials
      (async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/games/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: savedCode, name: savedName }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            // failed to rejoin, clear storage
            localStorage.removeItem(STORAGE_KEY_CODE);
            localStorage.removeItem(STORAGE_KEY_NAME);
            return;
          }
          const { game: g, player: p } = body;
          setGame(g);
          setPlayer(p);
          setGameCode(g.code);
          setName(savedName);
          setScreen("home");
        } catch (err) {
          console.error("Auto-join failed:", err);
          localStorage.removeItem(STORAGE_KEY_CODE);
          localStorage.removeItem(STORAGE_KEY_NAME);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (screen === "home" && player && game) {
      // fetch players for this game from the server
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/games/${game.code}/players`);
          if (res.ok) {
            const body = await res.json();
            setPlayersList(body.players || []);
          } else {
            // fallback to demo list if endpoint not available
            setPlayersList((prev) => {
              if (prev.length) return prev;
              const self = { id: player.id, name: player.name, balance: player.balance ?? (game?.initial_balance ?? 1500) };
              const others = [
                { id: "demo-1", name: "Alex", balance: 1200 },
                { id: "demo-2", name: "Casey", balance: 900 },
                { id: "demo-3", name: "Jordan", balance: 1500 },
              ];
              return [self, ...others];
            });
          }
        } catch (e) {
          console.warn('Failed to fetch players, using fallback demo list', e);
        }
      })();
    }
  }, [screen, player, game]);

  // keep free parking pot in sync with game
  useEffect(() => {
    if (game) setFreeParkingPot(game.free_parking_balance || 0);
  }, [game]);

  // Polling: periodically refresh game and players so other clients see updates
  useEffect(() => {
    if (screen !== 'home' || !game || !player) return;

    let stopped = false;
    let timer: number | null = null;
    let inFlight = false;

    const fetchState = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [playersRes, gameRes] = await Promise.all([
          fetch(`${API_BASE}/games/${game.code}/players`),
          fetch(`${API_BASE}/games/${game.code}`),
        ]);

        if (playersRes.ok) {
          const pb = await playersRes.json();
          setPlayersList(pb.players || []);
          const updated = (pb.players || []).find((p: any) => p.id === player.id);
          if (updated) setPlayer(updated);
        }

        if (gameRes.ok) {
          const gb = await gameRes.json();
          if (gb.game) setGame(gb.game);
        }
      } catch (e) {
        console.warn('Polling game state failed', e);
      } finally {
        inFlight = false;
      }
    };

    const scheduleNext = () => {
      if (stopped) return;
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const delay = hidden ? 5000 : 500; // 2s when visible, 10s when hidden
      timer = window.setTimeout(async () => {
        if (stopped) return;
        await fetchState();
        scheduleNext();
      }, delay);
    };

    // initial fetch then schedule
    fetchState();
    scheduleNext();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchState();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [screen, game?.code, player?.id]);

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
                    // persist for reloads
                    try {
                      localStorage.setItem(STORAGE_KEY_CODE, g.code);
                      localStorage.setItem(STORAGE_KEY_NAME, name);
                    } catch (e) {
                      /* ignore storage errors */
                    }
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
                    // persist for reloads
                    try {
                      localStorage.setItem(STORAGE_KEY_CODE, g.code);
                      localStorage.setItem(STORAGE_KEY_NAME, name);
                    } catch (e) {
                      /* ignore storage errors */
                    }
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
  const handleLeave = async () => {
    try {
      if (!game || !player) return;
      const res = await fetch(`${API_BASE}/games/${game.code}/players/${player.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to leave game');
      }

      // reset local state back to join screen
      setPlayer(null);
      setGame(null);
      setGameCode('');
      setName('');
      try {
        localStorage.removeItem(STORAGE_KEY_CODE);
        localStorage.removeItem(STORAGE_KEY_NAME);
      } catch (e) {
        /* ignore */
      }
      setScreen('join-create');
    } catch (err: any) {
      console.error('Leave game error:', err);
      // optionally show an error to the user
      alert(err.message || 'Failed to leave game');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 z-50">
        {/* Name (top left) */}
        <div className="font-semibold text-lg text-foreground flex items-center gap-2">
          <div>{player?.name ?? name}</div>
          <div className="text-sm text-muted-foreground">{(player?.total_sips ?? 0)} sips</div>
        </div>
        {/* Game code (top right) with popover */}
        <GameCodePopover code={game?.code ?? gameCode} onLeave={handleLeave} onLogout={handleLogoutOfGame} />
      </div>

      {/* Lockdown overlay when player has pending sips */}
      {player?.pending_sips > 0 && (
        <div className="fixed inset-0 z-40 pointer-events-auto">
          {/* fully opaque black background to hide everything below */}
          <div className="absolute inset-0 bg-black" />

          {/* centered content (below header which has z-50) */}
          <div className="relative z-40 min-h-screen flex items-center justify-center px-6">
            <div className="max-w-lg w-full text-center text-white">
              <div className="flex flex-col items-center gap-6 py-12">
                {/* white lock icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 text-white" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2" />
                  <rect x="4" y="10" width="16" height="10" rx="2" strokeWidth={1.5} />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 10V8a5 5 0 0110 0v2" />
                </svg>

                <div className="text-2xl font-bold">You have {player.pending_sips} sip{player.pending_sips > 1 ? 's' : ''}</div>
                <p className="mt-3 text-lg text-white/90">Please finish your sips to continue playing.</p>
                <p className="mt-1 text-sm text-white/70">You cannot collect money until you've finished.</p>

                <div className="w-full mt-4">
                  <Button
                    className="w-full"
                    onClick={async () => {
                      try {
                        const res = await fetch(`${API_BASE}/games/${game.code}/sips/complete`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ actor_player_id: player.id }),
                        });
                        if (!res.ok) {
                          const body = await res.json().catch(() => ({}));
                          throw new Error(body.error || 'Failed to complete sips');
                        }
                        // refresh players and game state
                        const [playersRes, gameRes] = await Promise.all([
                          fetch(`${API_BASE}/games/${game.code}/players`),
                          fetch(`${API_BASE}/games/${game.code}`),
                        ]);
                        if (playersRes.ok) {
                          const pb = await playersRes.json();
                          setPlayersList(pb.players || []);
                          const updated = (pb.players || []).find((p: any) => p.id === player.id);
                          if (updated) setPlayer(updated);
                        }
                        if (gameRes.ok) {
                          const gb = await gameRes.json();
                          if (gb.game) setGame(gb.game);
                        }
                      } catch (err: any) {
                        console.error('Complete sips error:', err);
                        alert(err.message || 'Failed to complete sips');
                      }
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

        {/* SIP section for commissioner */}
        {player?.is_commissioner && (
          <Section title="Sips">
            <div className="grid grid-cols-1 gap-4 w-64">
              <Button variant="secondary" className="py-6" onClick={() => setSipModalOpen(true)}>Give Sips</Button>
            </div>
          </Section>
        )}

        {/* Pay section */}
        <Section title="Pay" className={player?.is_commissioner ? "mt-8" : ""}>
          <div className="grid grid-cols-2 gap-4 w-64">
            <Button
              variant="secondary"
              className="py-6"
              onClick={() => {
                setPayMode("bank");
                setPayModalOpen(true);
              }}
            >
              Bank
            </Button>
            <Button
              variant="secondary"
              className="py-6"
              onClick={() => {
                setPayMode("players");
                setPayModalOpen(true);
              }}
            >
              Players
            </Button>
            <Button
              variant="secondary"
              className="py-6"
              onClick={() => {
                setPayMode("tax");
                setPayModalOpen(true);
              }}
            >
              Tax
            </Button>
          </div>
        </Section>

        <PayPopup
          open={payModalOpen}
          onOpenChange={(v) => setPayModalOpen(v)}
          mode={payMode}
          currentPlayer={player}
          players={playersList}
          onSubmit={async (payments, opts) => {
            if (!game || !player) return;
            try {
              const res = await fetch(`${API_BASE}/games/${game.code}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actor_player_id: player.id, payments, opts: { ...(opts || {}), mode: payMode } }),
              });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Payment failed');
              }
              const body = await res.json().catch(() => ({}));

              // If the server returned money_events showing zero-amount attempts, show an immediate message to the user
              const blocked = (body.money_events || []).filter((me: any) => (Number(me.amount || 0) === 0) && me.to_player_id);
              if (blocked.length > 0) {
                const names = blocked.map((b: any) => {
                  const found = (playersList || []).find((pl: any) => pl.id === b.to_player_id);
                  return found ? found.name : b.to_player_id;
                }).join(', ');
                setBlockedPaymentMessage(`No money was sent to ${names} because they have pending sips. Congrats! 🎉`);
              }

              // refresh players and game state
              const [playersRes, gameRes] = await Promise.all([
                fetch(`${API_BASE}/games/${game.code}/players`),
                fetch(`${API_BASE}/games/${game.code}`),
              ]);
              if (playersRes.ok) {
                const pb = await playersRes.json();
                setPlayersList(pb.players || []);
                // if current player present in refreshed list, update top-level player
                const updated = (pb.players || []).find((p: any) => p.id === player.id);
                if (updated) setPlayer(updated);
              }
              if (gameRes.ok) {
                const gb = await gameRes.json();
                if (gb.game) setGame(gb.game);
              }
            } catch (err: any) {
              console.error('Payment error:', err);
              alert(err.message || 'Failed to process payment');
            }
          }}
        />

      {/* Blocked payment message modal styled like PayPopup */}
      <Dialog open={!!blockedPaymentMessage} onOpenChange={v => { if (!v) setBlockedPaymentMessage(null); }}>
        <DialogContent>
          <div className="px-4">
            <DialogHeader>
              <DialogTitle>Payment Blocked</DialogTitle>
            </DialogHeader>
            <div className="mb-4">{blockedPaymentMessage}</div>
            <DialogFooter>
              <Button onClick={() => setBlockedPaymentMessage(null)}>OK</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <CollectPopup
        open={collectModalOpen}
        onOpenChange={(v) => setCollectModalOpen(v)}
        mode={collectMode}
        currentPlayer={player}
        game={game}
        onCollect={async (opts) => {
          if (!game || !player) return;
          try {
            const res = await fetch(`${API_BASE}/games/${game.code}/collect`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ actor_player_id: player.id, opts }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error || 'Collect failed');
            }
            // refresh players and game
            const [playersRes, gameRes] = await Promise.all([
              fetch(`${API_BASE}/games/${game.code}/players`),
              fetch(`${API_BASE}/games/${game.code}`),
            ]);
            if (playersRes.ok) {
              const pb = await playersRes.json();
              setPlayersList(pb.players || []);
              const updated = (pb.players || []).find((p: any) => p.id === player.id);
              if (updated) setPlayer(updated);
            }
            if (gameRes.ok) {
              const gb = await gameRes.json();
              if (gb.game) setGame(gb.game);
            }
          } catch (err: any) {
            console.error('Collect error:', err);
            alert(err.message || 'Failed to collect');
          }
        }}
      />

      <SipPopup
        open={sipModalOpen}
        onOpenChange={(v) => setSipModalOpen(v)}
        currentPlayer={player}
        players={playersList}
        onSubmit={async (to, sip_count) => {
          if (!game || !player) return;
          try {
            const res = await fetch(`${API_BASE}/games/${game.code}/sips`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ actor_player_id: player.id, to_player_id: to, sip_count: sip_count }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error || 'Failed to assign sips');
            }

            // refresh players and game state
            const [playersRes, gameRes] = await Promise.all([
              fetch(`${API_BASE}/games/${game.code}/players`),
              fetch(`${API_BASE}/games/${game.code}`),
            ]);
            if (playersRes.ok) {
              const pb = await playersRes.json();
              setPlayersList(pb.players || []);
            }
            if (gameRes.ok) {
              const gb = await gameRes.json();
              if (gb.game) setGame(gb.game);
            }
          } catch (err: any) {
            console.error('Assign sips error:', err);
            alert(err.message || 'Failed to assign sips');
          }
        }}
      />
        {/* Collect section */}
        <Section title="Collect" className="mt-8">
          <div className="grid grid-cols-2 gap-4 w-64">
            <Button variant="secondary" className="py-6" onClick={() => { setCollectMode('bank'); setCollectModalOpen(true); }}>
              Bank
            </Button>
            <Button variant="secondary" className="py-6" onClick={() => { setCollectMode('pass_go'); setCollectModalOpen(true); }}>
              Pass Go
            </Button>
            <Button 
              variant="secondary" 
              className="py-6" 
              onClick={() => { 
                setCollectMode('free_parking'); 
                setCollectModalOpen(true); 
              }}
            >
              Free Parking
              <span className="ml-2 text-primary font-bold">${freeParkingPot}</span>
            </Button>
          </div>
        </Section>
      </div>
      <ActivityLog gameCode={game?.code ?? gameCode} players={playersList} />
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

function GameCodePopover({ code, onLeave, onLogout }: { code: string; onLeave?: () => void; onLogout?: () => void }) {
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
          {/* Log Out of Game Button */}
          <Button variant="secondary" className="w-full mt-2" onClick={onLogout}>
            Log Out
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full mt-2">
                Leave Game
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to leave?</AlertDialogTitle>
                <AlertDialogDescription>
                  If you leave the game, <b>all your data will be permanently removed</b> from this session. This action cannot be undone. Please be careful!
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, remove my data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default Drunkopoly;
