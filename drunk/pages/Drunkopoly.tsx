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
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Screen = "join-create" | "enter-name" | "home";

const Drunkopoly = () => {
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
  const [freeParkingPot, setFreeParkingPot] = useState(0);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectMode, setCollectMode] = useState<'bank'|'pass_go'|'free_parking'|null>(null);
  const [blockedPaymentMessage, setBlockedPaymentMessage] = useState<string | null>(null);

  // Generate unique game code
  const generateCode = (len = 6) => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const createUniqueGameCode = async (attempts = 5) => {
    for (let i = 0; i < attempts; i++) {
      const code = generateCode();
      const { data, error } = await supabase
        .from('games')
        .select('id')
        .eq('code', code)
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return code;
    }
    throw new Error('Unable to generate unique game code');
  };

  // Get players for a game
  const fetchPlayers = async (code: string) => {
    try {
      // First get the game by code
      const { data: games, error: gErr } = await supabase
        .from('games')
        .select('id')
        .eq('code', code)
        .limit(1);
      
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      
      const game = games[0];
      
      // Then get players for that game
      const { data: players, error: pErr } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', game.id)
        .order('created_at', { ascending: true });
      
      if (pErr) throw pErr;
      return players || [];
    } catch (err) {
      console.error('Get players error:', err);
      return [];
    }
  };

  // Process payments
  const processPayments = async (code: string, actor_player_id: string, payments: any[], opts: any = {}) => {
    try {
      // Find game
      const { data: games, error: gErr } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .limit(1);
      
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      const game = games[0];

      // Fetch actor
      const { data: actorRows, error: aErr } = await supabase
        .from('players')
        .select('*')
        .eq('id', actor_player_id)
        .eq('game_id', game.id)
        .limit(1);
      
      if (aErr) throw aErr;
      if (!actorRows || actorRows.length === 0) throw new Error('Actor player not found in game');
      const actor = actorRows[0];

      let total = 0;
      let meData: any[] = [];

      // Handle tax distribution
      if (opts.mode === 'tax' && !opts.freeParking && payments.length === 1 && (payments[0].to == null)) {
        const amountPer = Number(payments[0].amount || 0);
        const { data: allPlayers, error: apErr } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', game.id);
        
        if (apErr) throw apErr;
        const recipients = (allPlayers || []).filter((p) => p.id !== actor_player_id);

        const inserts = [];
        for (const r of recipients) {
          const hasPending = (r.pending_sips || 0) > 0;
          const amt = hasPending ? 0 : amountPer;
          const desc = hasPending ? (opts.description || `Recipient has pending sips; no money was sent`) : (opts.description || null);
          inserts.push({
            game_id: game.id,
            actor_player_id: actor_player_id,
            from_player_id: actor_player_id,
            to_player_id: r.id,
            amount: amt,
            type: opts.type || 'tax',
            description: desc,
          });
          total += amt;
        }

        const { data: inserted, error: meErr } = await supabase
          .from('money_events')
          .insert(inserts)
          .select();
        
        if (meErr) throw meErr;
        meData = inserted || [];

        // Credit recipients
        for (const ins of inserts) {
          if (!ins.to_player_id || (ins.amount || 0) <= 0) continue;
          const { data: rRows, error: rErr } = await supabase
            .from('players')
            .select('*')
            .eq('id', ins.to_player_id)
            .eq('game_id', game.id)
            .limit(1);
          
          if (rErr) throw rErr;
          if (!rRows || rRows.length === 0) continue;
          
          const recipient = rRows[0];
          const newBal = (recipient.balance || 0) + ins.amount;
          await supabase
            .from('players')
            .update({ balance: newBal })
            .eq('id', ins.to_player_id);
        }
      } else {
        // Normal payments
        const inserts = [];
        for (const p of payments) {
          const intended = Number(p.amount || 0);
          if (!p.to) {
            inserts.push({
              game_id: game.id,
              actor_player_id: actor_player_id,
              from_player_id: p.from_player_id || actor_player_id,
              to_player_id: null,
              amount: intended,
              type: opts.type || (opts.freeParking ? 'tax' : 'manual'),
              description: opts.description || null,
            });
            total += intended;
            continue;
          }

          // Check recipient
          const { data: rRows, error: rErr } = await supabase
            .from('players')
            .select('*')
            .eq('id', p.to)
            .eq('game_id', game.id)
            .limit(1);
          
          if (rErr) throw rErr;
          if (!rRows || rRows.length === 0) {
            inserts.push({
              game_id: game.id,
              actor_player_id: actor_player_id,
              from_player_id: p.from_player_id || actor_player_id,
              to_player_id: p.to,
              amount: 0,
              type: opts.type || (opts.freeParking ? 'tax' : 'manual'),
              description: opts.description || null,
            });
            continue;
          }

          const recipient = rRows[0];
          const hasPending = (recipient.pending_sips || 0) > 0;
          if (hasPending) {
            inserts.push({
              game_id: game.id,
              actor_player_id: actor_player_id,
              from_player_id: p.from_player_id || actor_player_id,
              to_player_id: p.to,
              amount: 0,
              type: opts.type || (opts.freeParking ? 'tax' : 'manual'),
              description: opts.description || `Recipient has pending sips; no money was sent`,
            });
            continue;
          }

          inserts.push({
            game_id: game.id,
            actor_player_id: actor_player_id,
            from_player_id: p.from_player_id || actor_player_id,
            to_player_id: p.to,
            amount: intended,
            type: opts.type || (opts.freeParking ? 'tax' : 'manual'),
            description: opts.description || null,
          });
          total += intended;
        }

        const { data: inserted, error: meErr } = await supabase
          .from('money_events')
          .insert(inserts)
          .select();
        
        if (meErr) throw meErr;
        meData = inserted || [];

        // Credit recipients
        for (const ins of inserts) {
          if (!ins.to_player_id || (ins.amount || 0) <= 0) continue;
          const { data: rRows2, error: rErr2 } = await supabase
            .from('players')
            .select('*')
            .eq('id', ins.to_player_id)
            .eq('game_id', game.id)
            .limit(1);
          
          if (rErr2) throw rErr2;
          if (!rRows2 || rRows2.length === 0) continue;
          
          const recipient = rRows2[0];
          const newBal = (recipient.balance || 0) + ins.amount;
          await supabase
            .from('players')
            .update({ balance: newBal })
            .eq('id', ins.to_player_id);
        }
      }

      // Decrement actor balance
      await supabase
        .from('players')
        .update({ balance: (actor.balance || 0) - total })
        .eq('id', actor_player_id);

      // Handle free parking
      if (opts.freeParking) {
        await supabase
          .from('games')
          .update({ free_parking_balance: (game.free_parking_balance || 0) + total })
          .eq('id', game.id);
      }

      return { ok: true, money_events: meData };
    } catch (err) {
      console.error('Process payments error:', err);
      throw err;
    }
  };

  // Collect money
  const collectMoney = async (code: string, actor_player_id: string, opts: any) => {
    try {
      // Find game
      const { data: games, error: gErr } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .limit(1);
      
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      const game = games[0];

      // Fetch player
      const { data: pRows, error: pErr } = await supabase
        .from('players')
        .select('*')
        .eq('id', actor_player_id)
        .eq('game_id', game.id)
        .limit(1);
      
      if (pErr) throw pErr;
      if (!pRows || pRows.length === 0) throw new Error('Player not found in game');
      const player = pRows[0];

      let amount = 0;
      let meRow = null;

      if (opts.type === 'bank') {
        amount = Number(opts.amount || 0);
        if (amount <= 0) throw new Error('Invalid amount for bank collect');

        const { data: meData, error: meErr } = await supabase
          .from('money_events')
          .insert([{
            game_id: game.id,
            actor_player_id,
            from_player_id: null,
            to_player_id: actor_player_id,
            amount,
            type: 'bank',
            description: opts.description || null
          }])
          .select()
          .single();
        
        if (meErr) throw meErr;
        meRow = meData;
      } else if (opts.type === 'pass_go') {
        const base = Number(game.pass_go_amount || 200);
        const doubled = !!opts.doubled;
        amount = doubled ? base * 2 : base;

        const { data: meData, error: meErr } = await supabase
          .from('money_events')
          .insert([{
            game_id: game.id,
            actor_player_id,
            from_player_id: null,
            to_player_id: actor_player_id,
            amount,
            type: 'go',
            description: opts.description || null
          }])
          .select()
          .single();
        
        if (meErr) throw meErr;
        meRow = meData;
      } else if (opts.type === 'free_parking') {
        const pot = Number(game.free_parking_balance || 0);
        if (pot <= 0) throw new Error('Free parking pot is empty');
        amount = pot;

        const { data: meData, error: meErr } = await supabase
          .from('money_events')
          .insert([{
            game_id: game.id,
            actor_player_id,
            from_player_id: null,
            to_player_id: actor_player_id,
            amount,
            type: 'free_parking_collect',
            description: opts.description || null
          }])
          .select()
          .single();
        
        if (meErr) throw meErr;
        meRow = meData;

        // Clear pot
        await supabase
          .from('games')
          .update({ free_parking_balance: 0 })
          .eq('id', game.id);
      } else {
        throw new Error('Invalid collect type');
      }

      // Credit player
      const newBal = (player.balance || 0) + amount;
      await supabase
        .from('players')
        .update({ balance: newBal })
        .eq('id', actor_player_id);

      return { ok: true, money_event: meRow, new_balance: newBal };
    } catch (err) {
      console.error('Collect error:', err);
      throw err;
    }
  };

  // Assign sips
  const assignSips = async (code: string, actor_player_id: string, to_player_id: string, sip_count: number) => {
    try {
      // Find game
      const { data: games, error: gErr } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .limit(1);
      
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      const game = games[0];

      // Insert sip event
      const insertRow = {
        game_id: game.id,
        from_player_id: actor_player_id,
        to_player_id: to_player_id,
        sip_count: sip_count,
        status: 'pending',
      };
      
      const { data: inserted, error: iErr } = await supabase
        .from('sip_events')
        .insert([insertRow])
        .select();
      
      if (iErr) throw iErr;

      // Increment recipient pending_sips
      const { data: rRows, error: rErr } = await supabase
        .from('players')
        .select('*')
        .eq('id', to_player_id)
        .eq('game_id', game.id)
        .limit(1);
      
      if (rErr) throw rErr;
      if (!rRows || rRows.length === 0) throw new Error('Recipient not found in game');
      
      const recipient = rRows[0];
      const newPending = (recipient.pending_sips || 0) + sip_count;
      await supabase
        .from('players')
        .update({ pending_sips: newPending })
        .eq('id', to_player_id);

      return { ok: true, sip_event: Array.isArray(inserted) ? inserted[0] : inserted };
    } catch (err) {
      console.error('Assign sips error:', err);
      throw err;
    }
  };

  // Complete sips
  const completeSips = async (code: string, actor_player_id: string) => {
    try {
      // Find game
      const { data: games, error: gErr } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .limit(1);
      
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      const game = games[0];

      // Mark sip_events as cleared
      const { data: updated, error: uErr } = await supabase
        .from('sip_events')
        .update({ status: 'cleared', cleared_at: new Date().toISOString() })
        .eq('game_id', game.id)
        .eq('to_player_id', actor_player_id)
        .eq('status', 'pending')
        .select();
      
      if (uErr) throw uErr;

      const totalCompleted = (updated || []).reduce((sum, r) => sum + (Number(r.sip_count || 0)), 0);

      // Fetch player
      const { data: pRows, error: pFetchErr } = await supabase
        .from('players')
        .select('*')
        .eq('id', actor_player_id)
        .eq('game_id', game.id)
        .limit(1);
      
      if (pFetchErr) throw pFetchErr;
      if (!pRows || pRows.length === 0) throw new Error('Player not found in game');
      
      const playerRow = pRows[0];
      const newTotalSips = (playerRow.total_sips || 0) + totalCompleted;

      // Update player
      await supabase
        .from('players')
        .update({ pending_sips: 0, total_sips: newTotalSips })
        .eq('id', actor_player_id);

      return { ok: true, cleared: updated ? updated.length : 0, total_completed: totalCompleted, new_total_sips: newTotalSips };
    } catch (err) {
      console.error('Complete sips error:', err);
      throw err;
    }
  };

  // Auto-join on mount
  useEffect(() => {
    const savedCode = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_CODE) : null;
    const savedName = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_NAME) : null;
    
    if (savedCode && savedName) {
      (async () => {
        setLoading(true);
        try {
          // Find game
          const { data: games, error: gErr } = await supabase
            .from('games')
            .select('*')
            .eq('code', savedCode)
            .limit(1);

          if (gErr) throw gErr;
          if (!games || games.length === 0) {
            localStorage.removeItem(STORAGE_KEY_CODE);
            localStorage.removeItem(STORAGE_KEY_NAME);
            return;
          }

          const game = games[0];

          // Find or create player
          const { data: existingPlayers, error: pErr } = await supabase
            .from('players')
            .select('*')
            .eq('game_id', game.id)
            .eq('name', savedName)
            .limit(1);

          if (pErr) throw pErr;

          let player;
          if (existingPlayers && existingPlayers.length > 0) {
            player = existingPlayers[0];
            // Update last seen
            await supabase
              .from('players')
              .update({ is_online: true, last_seen_at: new Date().toISOString() })
              .eq('id', player.id);
          } else {
            // Check if first player
            const { data: allPlayers, error: countErr } = await supabase
              .from('players')
              .select('id', { count: 'exact' })
              .eq('game_id', game.id);
            
            const isFirstPlayer = !allPlayers || allPlayers.length === 0;
            
            const { data: newPlayer, error: newErr } = await supabase
              .from('players')
              .insert([{
                game_id: game.id,
                name: savedName,
                balance: game.initial_balance ?? 0,
                is_commissioner: isFirstPlayer,
              }])
              .select()
              .single();
            
            if (newErr) throw newErr;
            player = newPlayer;

            // Set host if first player
            if (isFirstPlayer && !game.host_player_id) {
              await supabase
                .from('games')
                .update({ host_player_id: player.id })
                .eq('id', game.id);
            }

            // Log join event
            await supabase.from('money_events').insert([{
              game_id: game.id,
              actor_player_id: player.id,
              from_player_id: null,
              to_player_id: player.id,
              amount: 0,
              type: 'join',
              description: `${player.name} joined the game`,
            }]);
          }

          setGame(game);
          setPlayer(player);
          setGameCode(game.code);
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

  // Fetch players when game changes
  useEffect(() => {
    if (screen === "home" && game) {
      (async () => {
        const players = await fetchPlayers(game.code);
        setPlayersList(players);
      })();
    }
  }, [screen, game]);

  // Update free parking pot
  useEffect(() => {
    if (game) setFreeParkingPot(game.free_parking_balance || 0);
  }, [game]);

  // Polling for real-time updates
  useEffect(() => {
    if (screen !== 'home' || !game || !player) return;

    let stopped = false;
    let timer: number | null = null;

    const fetchState = async () => {
      if (stopped) return;
      
      try {
        const [players, gameData] = await Promise.all([
          fetchPlayers(game.code),
          supabase.from('games').select('*').eq('code', game.code).limit(1).single()
        ]);

        if (players) setPlayersList(players);
        if (gameData.data) {
          setGame(gameData.data);
          const updatedPlayer = players.find((p: any) => p.id === player.id);
          if (updatedPlayer) setPlayer(updatedPlayer);
        }
      } catch (e) {
        console.warn('Polling game state failed', e);
      }
    };

    const scheduleNext = () => {
      if (stopped) return;
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const delay = hidden ? 5000 : 2000;
      timer = window.setTimeout(async () => {
        await fetchState();
        scheduleNext();
      }, delay);
    };

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

  // Handle logout (just leave game, keep name)
  const handleLogoutOfGame = () => {
    setGame(null);
    setGameCode("");
    setScreen("join-create");
  };

  // Handle leave game (remove data)
  const handleLeave = async () => {
    try {
      if (!game || !player) return;
      
      // Delete player and related data
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', player.id)
        .eq('game_id', game.id);
      
      if (error) throw error;

      // Log leave event
      await supabase.from('money_events').insert([{
        game_id: game.id,
        actor_player_id: player.id,
        from_player_id: player.id,
        to_player_id: null,
        amount: 0,
        type: 'leave',
        description: `${player.name} left the game`,
      }]);

      // Reset state
      setPlayer(null);
      setGame(null);
      setGameCode('');
      setName('');
      localStorage.removeItem(STORAGE_KEY_CODE);
      localStorage.removeItem(STORAGE_KEY_NAME);
      setScreen('join-create');
    } catch (err: any) {
      console.error('Leave game error:', err);
      alert(err.message || 'Failed to leave game');
    }
  };

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
                <Button className="w-full py-4 text-lg font-semibold shadow-md" size="lg" type="submit" disabled={!gameCode.trim()}>
                  Join Game
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
                    // Create game
                    const code = await createUniqueGameCode();
                    const { data: newGame, error: createErr } = await supabase
                      .from('games')
                      .insert([{ code }])
                      .select()
                      .single();
                    
                    if (createErr) throw createErr;

                    // Join as host
                    const { data: allPlayers } = await supabase
                      .from('players')
                      .select('id', { count: 'exact' })
                      .eq('game_id', newGame.id);
                    
                    const isFirstPlayer = !allPlayers || allPlayers.length === 0;
                    
                    const { data: newPlayer, error: joinErr } = await supabase
                      .from('players')
                      .insert([{
                        game_id: newGame.id,
                        name,
                        balance: newGame.initial_balance ?? 0,
                        is_commissioner: isFirstPlayer,
                      }])
                      .select()
                      .single();
                    
                    if (joinErr) throw joinErr;

                    // Set host
                    if (isFirstPlayer) {
                      await supabase
                        .from('games')
                        .update({ host_player_id: newPlayer.id })
                        .eq('id', newGame.id);
                    }

                    // Log join
                    await supabase.from('money_events').insert([{
                      game_id: newGame.id,
                      actor_player_id: newPlayer.id,
                      from_player_id: null,
                      to_player_id: newPlayer.id,
                      amount: 0,
                      type: 'join',
                      description: `${newPlayer.name} joined the game`,
                    }]);

                    setGame(newGame);
                    setPlayer(newPlayer);
                    setGameCode(newGame.code);
                    localStorage.setItem(STORAGE_KEY_CODE, newGame.code);
                    localStorage.setItem(STORAGE_KEY_NAME, name);
                    setScreen("home");
                  } else {
                    // Join existing game
                    const { data: games, error: gErr } = await supabase
                      .from('games')
                      .select('*')
                      .eq('code', gameCode)
                      .limit(1);
                    
                    if (gErr) throw gErr;
                    if (!games || games.length === 0) throw new Error('Game not found');
                    
                    const game = games[0];

                    // Check if player exists
                    const { data: existingPlayers, error: pErr } = await supabase
                      .from('players')
                      .select('*')
                      .eq('game_id', game.id)
                      .eq('name', name)
                      .limit(1);
                    
                    if (pErr) throw pErr;

                    let player;
                    if (existingPlayers && existingPlayers.length > 0) {
                      player = existingPlayers[0];
                      // Update last seen
                      await supabase
                        .from('players')
                        .update({ is_online: true, last_seen_at: new Date().toISOString() })
                        .eq('id', player.id);
                    } else {
                      // Create new player
                      const { data: allPlayers } = await supabase
                        .from('players')
                        .select('id', { count: 'exact' })
                        .eq('game_id', game.id);
                      
                      const isFirstPlayer = !allPlayers || allPlayers.length === 0;
                      
                      const { data: newPlayer, error: newErr } = await supabase
                        .from('players')
                        .insert([{
                          game_id: game.id,
                          name,
                          balance: game.initial_balance ?? 0,
                          is_commissioner: isFirstPlayer,
                        }])
                        .select()
                        .single();
                      
                      if (newErr) throw newErr;
                      player = newPlayer;

                      // Set host if first player
                      if (isFirstPlayer && !game.host_player_id) {
                        await supabase
                          .from('games')
                          .update({ host_player_id: player.id })
                          .eq('id', game.id);
                      }

                      // Log join
                      await supabase.from('money_events').insert([{
                        game_id: game.id,
                        actor_player_id: player.id,
                        from_player_id: null,
                        to_player_id: player.id,
                        amount: 0,
                        type: 'join',
                        description: `${player.name} joined the game`,
                      }]);
                    }

                    setGame(game);
                    setPlayer(player);
                    setGameCode(game.code);
                    localStorage.setItem(STORAGE_KEY_CODE, game.code);
                    localStorage.setItem(STORAGE_KEY_NAME, name);
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
      <div className="flex items-center justify-between px-6 py-4 z-50">
        <div className="font-semibold text-lg text-foreground flex items-center gap-2">
          <div>{player?.name ?? name}</div>
          <div className="text-sm text-muted-foreground">{(player?.total_sips ?? 0)} sips</div>
        </div>
        <GameCodePopover code={game?.code ?? gameCode} onLeave={handleLeave} onLogout={handleLogoutOfGame} />
      </div>

      {/* Lockdown overlay when player has pending sips */}
      {player?.pending_sips > 0 && (
        <div className="fixed inset-0 z-40 pointer-events-auto">
          <div className="absolute inset-0 bg-black" />
          <div className="relative z-40 min-h-screen flex items-center justify-center px-6">
            <div className="max-w-lg w-full text-center text-white">
              <div className="flex flex-col items-center gap-6 py-12">
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
                        await completeSips(game.code, player.id);
                        // Refresh state
                        const players = await fetchPlayers(game.code);
                        setPlayersList(players);
                        const updatedPlayer = players.find((p: any) => p.id === player.id);
                        if (updatedPlayer) setPlayer(updatedPlayer);
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
              const result = await processPayments(game.code, player.id, payments, { ...(opts || {}), mode: payMode });
              
              // Check for blocked payments
              const blocked = (result.money_events || []).filter((me: any) => (Number(me.amount || 0) === 0) && me.to_player_id);
              if (blocked.length > 0) {
                const names = blocked.map((b: any) => {
                  const found = (playersList || []).find((pl: any) => pl.id === b.to_player_id);
                  return found ? found.name : b.to_player_id;
                }).join(', ');
                setBlockedPaymentMessage(`No money was sent to ${names} because they have pending sips. Congrats! 🎉`);
              }

              // Refresh state
              const players = await fetchPlayers(game.code);
              setPlayersList(players);
              const updatedPlayer = players.find((p: any) => p.id === player.id);
              if (updatedPlayer) setPlayer(updatedPlayer);
              const { data: gameData } = await supabase.from('games').select('*').eq('code', game.code).single();
              if (gameData) setGame(gameData);
            } catch (err: any) {
              console.error('Payment error:', err);
              alert(err.message || 'Failed to process payment');
            }
          }}
        />

        {/* Blocked payment message modal */}
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
              await collectMoney(game.code, player.id, opts);
              // Refresh state
              const players = await fetchPlayers(game.code);
              setPlayersList(players);
              const updatedPlayer = players.find((p: any) => p.id === player.id);
              if (updatedPlayer) setPlayer(updatedPlayer);
              const { data: gameData } = await supabase.from('games').select('*').eq('code', game.code).single();
              if (gameData) setGame(gameData);
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
              await assignSips(game.code, player.id, to, sip_count);
              // Refresh state
              const players = await fetchPlayers(game.code);
              setPlayersList(players);
              const { data: gameData } = await supabase.from('games').select('*').eq('code', game.code).single();
              if (gameData) setGame(gameData);
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