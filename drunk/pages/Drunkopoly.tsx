import { useEffect, useState, useRef } from "react";
import PayPopup from "../components/PayPopup";
import JailPopup from "../components/JailPopup";
import { UserPlus, DollarSign, Users, Percent, Crown, PiggyBank, Clock, Copy, Settings, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import CollectPopup from "../components/CollectPopup";
import SipPopup from "../components/SipPopup";
import TradeTimerControl from "../components/TradeTimerControl";
import TradeLockOverlay from "../components/TradeLockOverlay";
import JailLockOverlay from "../components/JailLockOverlay";
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
import { Switch } from "../components/ui/switch";
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
import { useNavigate } from "react-router-dom";
import { toast } from "../components/ui/use-toast";
import { Toaster } from "../components/ui/toaster";

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Screen = "join-create" | "enter-name" | "confirm-settings" | "select-existing-player" | "home";

const Drunkopoly = () => {
  const STORAGE_KEY_CODE = "drunkopoly:gameCode";
  const STORAGE_KEY_NAME = "drunkopoly:name";
  const STORAGE_KEY_RECENT = "drunkopoly:recentGames";
  const STORAGE_KEY_SOUND = "drunkopoly:soundEnabled";

  const [screen, setScreen] = useState<Screen>("join-create");
  const [gameCode, setGameCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"join" | "create" | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // temporary settings used when creating a new game (strings so inputs can be cleared)
  const [tempInitialBalance, setTempInitialBalance] = useState<string>("1500");
  const [tempPassGoAmount, setTempPassGoAmount] = useState<string>("200");
  const [tempFreeParkingBalance, setTempFreeParkingBalance] = useState<string>("0");
  const [tempShowBalances, setTempShowBalances] = useState<boolean>(true);
  const [game, setGame] = useState<any | null>(null);
  const [player, setPlayer] = useState<any | null>(null);
  const [recentGames, setRecentGames] = useState<string[]>([]);
  const [recentPlayers, setRecentPlayers] = useState<any[] | null>(null);
  const [playersList, setPlayersList] = useState<any[]>([]);
  const alertedMessengerRef = useRef<Map<string, string | null>>(new Map());
  const [removedNoticeOpen, setRemovedNoticeOpen] = useState(false);
  const [removedNoticeMsg, setRemovedNoticeMsg] = useState<string | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMode, setPayMode] = useState<"bank" | "players" | "tax" | null>(null);
  const [sipModalOpen, setSipModalOpen] = useState(false);
  const [tradeTimerModalOpen, setTradeTimerModalOpen] = useState(false);
  const [tradeTimerSelected, setTradeTimerSelected] = useState<number>(60);
  const [jailModalOpen, setJailModalOpen] = useState(false);
  const [payProcessing, setPayProcessing] = useState(false);
  const [cardProcessing, setCardProcessing] = useState(false);
  const [completingSips, setCompletingSips] = useState(false);
  const [freeParkingPot, setFreeParkingPot] = useState(0);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectMode, setCollectMode] = useState<'bank'|'pass_go'|'free_parking'|null>(null);
  const [blockedPaymentMessage, setBlockedPaymentMessage] = useState<string | null>(null);
  const prevBalanceRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("drunkopoly:soundEnabled") : null;
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });
  // Show brief notification when the current player receives a money event.
  // Subscribe to the `game_events` view (same source ActivityLog uses) and show
  // a toast containing the sender name + optional note.
  useEffect(() => {
    // load recent games from localStorage and filter out any that no longer exist
    (async () => {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_RECENT) : null;
        if (!raw) return;
        const parsed = JSON.parse(raw || "[]");
        if (!Array.isArray(parsed)) return;
        const codes = parsed.filter(Boolean).map((s: any) => String(s));
        if (codes.length === 0) return;

        try {
          // Fetch existing games in one query
          const { data: existing = [], error: exErr } = await supabase.from('games').select('code').in('code', codes);
          if (exErr) throw exErr;
          const existingSet = new Set((existing || []).map((g: any) => String(g.code)));
          const filtered = codes.filter((c: string) => existingSet.has(c));
          setRecentGames(filtered);
          persistRecentGames(filtered);
        } catch (e) {
          // If Supabase check fails, fall back to showing the raw list
          setRecentGames(codes);
        }
      } catch (e) {
        // ignore JSON/localStorage errors
      }
    })();
  }, []);

  const persistRecentGames = (list: string[]) => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  };

  const pushRecentGame = (code: string) => {
    try {
      if (!code) return;
      const up = [code, ...recentGames.filter((c) => c !== code)].slice(0, 3);
      setRecentGames(up);
      persistRecentGames(up);
    } catch (e) { /* ignore */ }
  };

  const handleRecentClick = async (code: string) => {
    setLoading(true);
    try {
      setGameCode(code);
      setMode('join');
      const players = await fetchPlayers(code);
      if (players && players.length > 0) {
        setRecentPlayers(players);
        setScreen('select-existing-player' as Screen);
      } else {
        setScreen('enter-name');
      }
    } catch (e) {
      // fallback to enter name
      setScreen('enter-name');
    } finally {
      setLoading(false);
    }
  };

  const signInAsExistingPlayer = async (p: any) => {
    try {
      // fetch game
      const { data: games, error: gErr } = await supabase.from('games').select('*').eq('code', gameCode).limit(1);
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      const g = games[0];

      // mark online
      await supabase.from('players').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', p.id);

      setGame(g);
      setPlayer(p);
      setName((p.name ?? '').toUpperCase());
      setGameCode(g.code);
      try { localStorage.setItem(STORAGE_KEY_CODE, g.code); localStorage.setItem(STORAGE_KEY_NAME, (p.name ?? '').toUpperCase()); } catch (e) { /* ignore */ }
      pushRecentGame(g.code);
      setScreen('home');
    } catch (err) {
      console.error('Sign in existing player failed', err);
      toast({ title: 'Sign in failed', description: (err as any)?.message || 'Unable to sign in' });
    }
  };

  // If the URL contains an invite or code param, auto-fill and go to enter-name
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite') || params.get('code');
      if (invite) {
        // Clear any previously cached session so invite always forces join flow
        try {
          localStorage.removeItem(STORAGE_KEY_CODE);
          localStorage.removeItem(STORAGE_KEY_NAME);
        } catch (e) {
          // ignore
        }
        setGameCode(invite.toUpperCase());
        setMode('join');
        setScreen('enter-name');
        // remove query params from URL to keep it clean
        try {
          navigate(window.location.pathname, { replace: true });
        } catch (e) {
          // ignore navigate errors
        }
      }
    } catch (err) {
      // ignore
    }
  }, []);

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

  const isNameKicked = async (gameId: string, nameToCheck: string) => {
    try {
      const { data } = await supabase
        .from('money_events')
        .select('id')
        .eq('game_id', gameId)
        .eq('type', 'kick')
        .ilike('description', `%kicked:${nameToCheck}%`)
        .limit(1);
      return !!(data && data.length > 0);
    } catch (e) {
      return false;
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
          const isInJail = !!r.in_jail;
          const amt = (hasPending || isInJail) ? 0 : amountPer;
          let desc: string | null = null;
          if (hasPending) desc = opts.description || `Recipient has pending sips; no money was sent`;
          else if (isInJail) desc = opts.description || `Recipient is in jail; no money was sent`;
          else desc = opts.description || null;

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
          // If a description/message was provided, mark recipient with new messenger data
          try {
            const formatted = opts.description ? `[from:${actor.name}] ${opts.description}` : null;
            await supabase
              .from('players')
              .update({ has_new_messenger: !!opts.description, messenger_data: formatted })
              .eq('id', ins.to_player_id);
          } catch (mErr) {
            console.warn('Failed to set messenger data for player', ins.to_player_id, mErr);
          }
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
          const isInJail = !!recipient.in_jail;
          if (hasPending || isInJail) {
            inserts.push({
              game_id: game.id,
              actor_player_id: actor_player_id,
              from_player_id: p.from_player_id || actor_player_id,
              to_player_id: p.to,
              amount: 0,
              type: opts.type || (opts.freeParking ? 'tax' : 'manual'),
              description: hasPending ? (opts.description || `Recipient has pending sips; no money was sent`) : (opts.description || `Recipient is in jail; no money was sent`),
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
          // If a description/message was provided, mark recipient with new messenger data
          try {
            const formatted = opts.description ? `[from:${actor.name}] ${opts.description}` : null;
            await supabase
              .from('players')
              .update({ has_new_messenger: !!opts.description, messenger_data: formatted })
              .eq('id', ins.to_player_id);
          } catch (mErr) {
            console.warn('Failed to set messenger data for player', ins.to_player_id, mErr);
          }
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

      // Best-effort: also log this assignment to `money_events` so ActivityLog
      // will have a persistent record (assignment) even after the sip_events
      // row is later updated to cleared. This lets us show two separate
      // activity entries: the original assignment (pending) and a later
      // completion entry.
      try {
        // Fetch actor name for a nicer description
        const { data: actorRows } = await supabase
          .from('players')
          .select('id,name')
          .eq('id', actor_player_id)
          .eq('game_id', game.id)
          .limit(1);
        const actor = actorRows && actorRows.length ? actorRows[0] : { name: actor_player_id };

        await supabase.from('money_events').insert([{
          game_id: game.id,
          actor_player_id: actor_player_id,
          from_player_id: actor_player_id,
          to_player_id: to_player_id,
          amount: 0,
          type: 'sip_assigned',
          description: `${actor.name || actor_player_id} assigned ${sip_count} sip${sip_count !== 1 ? 's' : ''} to ${recipient.name || to_player_id}`,
        }]);
      } catch (logErr) {
        console.warn('Failed to log sip assignment', logErr);
      }

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

      // Log completion to money_events so ActivityLog shows a separate "completed" entry
      try {
        if ((totalCompleted || 0) > 0) {
          await supabase.from('money_events').insert([{
            game_id: game.id,
            actor_player_id: actor_player_id,
            from_player_id: null,
            to_player_id: actor_player_id,
            amount: 0,
            type: 'sip_completed',
            description: `${playerRow.name || actor_player_id} completed ${totalCompleted} sip${totalCompleted !== 1 ? 's' : ''}`,
          }]);
        }
      } catch (logErr) {
        console.warn('Failed to log sip completion', logErr);
      }

      return { ok: true, cleared: updated ? updated.length : 0, total_completed: totalCompleted, new_total_sips: newTotalSips };
    } catch (err) {
      console.error('Complete sips error:', err);
      throw err;
    }
  };

  // Start trade timer
  const startTradeTimer = async (seconds: number) => {
    if (!game) return;
    try {
      const { data: updatedGames, error } = await supabase
        .from('games')
        .update({
          trade_locked: true,
          trade_started_by: player?.id ?? null,
          trade_timer_seconds: seconds,
          trade_timer_expires_at: new Date(Date.now() + seconds * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', game.id)
        .select()
        .limit(1);

      if (error) throw error;
      if (updatedGames && updatedGames.length > 0) {
        setGame(updatedGames[0]);
      } else {
        // refresh
        const { data: gData } = await supabase.from('games').select('*').eq('id', game.id).single();
        if (gData) setGame(gData);
      }
      // Log event to activity (money_events) so ActivityLog shows the timer start
      try {
        await supabase.from('money_events').insert([{
          game_id: game.id,
          actor_player_id: player?.id ?? null,
          from_player_id: null,
          to_player_id: null,
          amount: 0,
          type: 'trade_timer_start',
          description: `Trade timer started for ${seconds} second${seconds !== 1 ? 's' : ''} by ${player?.name ?? 'unknown'}`,
        }]);
      } catch (logErr) {
        console.warn('Failed to log trade timer start', logErr);
      }
    } catch (err: any) {
      console.error('Start trade timer failed', err);
      alert(err.message || 'Failed to start timer');
    }
  };

  // Send a player to jail
  const sendPlayerToJail = async (targetPlayerId: string) => {
    if (!game || !player) return;
    try {
      // Mark player as in jail and record who sent them
      const { data: updated, error } = await supabase
        .from('players')
        .update({ in_jail: true, jail_started_by: player.id, jail_started_at: new Date().toISOString() })
        .eq('id', targetPlayerId)
        .select();

      if (error) throw error;

      // Log the event for activity
      try {
        await supabase.from('money_events').insert([{
          game_id: game.id,
          actor_player_id: player.id,
          from_player_id: null,
          to_player_id: targetPlayerId,
          amount: 0,
          type: 'jail',
          description: `${player.name} sent ${(updated && updated[0] && updated[0].name) || targetPlayerId} to jail`,
        }]);
      } catch (e) {
        // ignore logging errors
      }

      // Refresh players
      const players = await fetchPlayers(game.code);
      setPlayersList(players);
      const updatedPlayer = players.find((p: any) => p.id === player.id);
      if (updatedPlayer) setPlayer(updatedPlayer);
    } catch (err: any) {
      console.error('Send to jail failed', err);
      alert(err.message || 'Failed to send to jail');
    } finally {
    }
  };

  const payToGetOut = async () => {
    if (!game || !player) return;
    setPayProcessing(true);
    try {
      // Deduct $50 from the jailed player and send it to Free Parking
      await processPayments(game.code, player.id, [{ to: null, amount: 50 }], { type: 'jail_payment', freeParking: true });

      // Clear jail flag
      await supabase.from('players').update({ in_jail: false, jail_started_by: null, jail_started_at: null }).eq('id', player.id);

      // Refresh state
      const players = await fetchPlayers(game.code);
      setPlayersList(players);
      const updatedPlayer = players.find((p: any) => p.id === player.id);
      if (updatedPlayer) setPlayer(updatedPlayer);
    } catch (err: any) {
      console.error('Pay to get out failed', err);
      alert(err.message || 'Failed to pay to get out of jail');
    } finally {
      setPayProcessing(false);
    }
  };

  const useGetOutCard = async () => {
    if (!game || !player) return;
    setCardProcessing(true);
    // optimistic update: clear jail locally so the overlay disappears immediately
    const prevPlayer = player;
    try {
      const updatedLocal = { ...player, in_jail: false, has_get_out_of_jail_card: false, jail_started_by: null, jail_started_at: null };
      setPlayer(updatedLocal);
      setPlayersList((prev) => (prev || []).map((p) => (p.id === player.id ? { ...p, ...updatedLocal } : p)));

      // persist change
      const { error } = await supabase.from('players').update({ in_jail: false, has_get_out_of_jail_card: false, jail_started_by: null, jail_started_at: null }).eq('id', player.id);
      if (error) throw error;

      // Log usage event (best-effort)
      try {
        await supabase.from('money_events').insert([{
          game_id: game.id,
          actor_player_id: player.id,
          from_player_id: null,
          to_player_id: player.id,
          amount: 0,
          type: 'jail_card_used',
          description: `${player.name} used a Get Out of Jail Free card`,
        }]);
      } catch (e) { /* ignore logging errors */ }
    } catch (err: any) {
      console.error('Use card failed', err);
      alert(err.message || 'Failed to use card');
      // revert optimistic state
      setPlayer(prevPlayer);
      setPlayersList((prev) => (prev || []).map((p) => (p.id === prevPlayer.id ? prevPlayer : p)));
    } finally {
      setCardProcessing(false);
    }
  };

  // Stop trade timer (Done)
  const stopTradeTimer = async () => {
    if (!game) return;
    try {
      const { data: updatedGames, error } = await supabase
        .from('games')
        .update({
          trade_locked: false,
          trade_started_by: null,
          trade_timer_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', game.id)
        .select()
        .limit(1);

      if (error) throw error;
      if (updatedGames && updatedGames.length > 0) {
        setGame(updatedGames[0]);
      } else {
        const { data: gData } = await supabase.from('games').select('*').eq('id', game.id).single();
        if (gData) setGame(gData);
      }
      // Log event to activity (money_events) so ActivityLog shows the timer stop
      try {
        await supabase.from('money_events').insert([{
          game_id: game.id,
          actor_player_id: player?.id ?? null,
          from_player_id: null,
          to_player_id: null,
          amount: 0,
          type: 'trade_timer_stop',
          description: `Trade timer stopped by ${player?.name ?? 'unknown'}`,
        }]);
      } catch (logErr) {
        console.warn('Failed to log trade timer stop', logErr);
      }
    } catch (err: any) {
      console.error('Stop trade timer failed', err);
      alert(err.message || 'Failed to stop timer');
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
            .eq('name', (savedName ?? '').toUpperCase())
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
            // Prevent auto-creation if this name was kicked
            const kicked = await isNameKicked(game.id, (savedName ?? '').toUpperCase());
            if (kicked) {
              try { localStorage.removeItem(STORAGE_KEY_CODE); localStorage.removeItem(STORAGE_KEY_NAME); } catch {}
              try { toast({ title: 'Removed', description: 'You were removed from this game and cannot rejoin.' }); } catch {}
              setLoading(false);
              setScreen('join-create');
              return;
            }
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
                name: (savedName ?? '').toUpperCase(),
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
          setName((savedName ?? '').toUpperCase());
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
          if (updatedPlayer) {
            // Update player; AnimatedNumber will animate when `balance` changes
            // If player has a new messenger flag, alert once and clear the flag in the DB
            if (updatedPlayer.has_new_messenger) {
              try {
                const md = updatedPlayer.messenger_data || '';
                // Only alert if the message content differs from the last alerted content for this player
                const last = alertedMessengerRef.current.get(updatedPlayer.id) ?? null;
                if (last !== md) {
                  try {
                    // Expecting format: [from:USERNAME] message
                    const m = md.match(/^\[from:([^\]]+)\]\s*(.*)$/);
                    if (m) {
                      const sender = m[1];
                      const msg = m[2] || 'You have a new message.';
                      toast({ title: `New message from ${sender}`, description: msg });
                    } else {
                      toast({ title: 'New message', description: md || 'You have a new message.' });
                    }
                  } catch (tErr) {
                    try { toast({ title: 'New message', description: updatedPlayer.messenger_data || 'You have a new message.' }); } catch {}
                  }
                  alertedMessengerRef.current.set(updatedPlayer.id, md);
                }

                // Clear the flag and messenger data in the database so it's not repeatedly shown
                try {
                  await supabase.from('players').update({ has_new_messenger: false, messenger_data: null }).eq('id', updatedPlayer.id);
                } catch (mErr) {
                  console.warn('Failed to clear has_new_messenger/messenger_data for player', updatedPlayer.id, mErr);
                }

                // Reflect cleared flag and cleared message locally
                setPlayer({ ...updatedPlayer, has_new_messenger: false, messenger_data: null });
                // Remove the last-alerted message for this player so future identical messages will still show
                alertedMessengerRef.current.delete(updatedPlayer.id);
                // Also update players list locally
                setPlayersList((prev) => prev.map(p => p.id === updatedPlayer.id ? { ...p, has_new_messenger: false, messenger_data: null } : p));
              } catch (e) {
                // Fall back to setting player normally
                setPlayer(updatedPlayer);
              }
            } else {
              setPlayer(updatedPlayer);
            }
            prevBalanceRef.current = Number(updatedPlayer.balance ?? 0);
          }
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

  // Realtime subscription: update `game` and `playersList` when rows change so everyone sees
  // the trade lock overlay immediately when someone starts the timer.
  useEffect(() => {
    if (screen !== 'home' || !game) return;
    const gameId = game.id;
    let channel: any = null;
    try {
      channel = supabase
        .channel(`public-games-${gameId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload: any) => {
          if (payload && payload.new) {
            setGame(payload.new);
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, async (payload: any) => {
          try {
            const players = await fetchPlayers(game.code);
            setPlayersList(players);
            const updatedPlayer = players.find((p: any) => p.id === player?.id);
            if (updatedPlayer) setPlayer(updatedPlayer);
          } catch (e) {
            // ignore
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, async (payload: any) => {
          try {
            // Refresh players list
            const players = await fetchPlayers(game.code);
            setPlayersList(players);
            // If the deleted player is the current player, show notice and log out when closed
            const oldRow = payload?.old;
            if (oldRow && player && String(oldRow.id) === String(player.id)) {
              setRemovedNoticeMsg('You were removed from the game.');
              setRemovedNoticeOpen(true);
            }
          } catch (e) {
            // ignore
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Supabase realtime subscribe failed', e);
    }

    return () => {
      try {
        if (channel) channel.unsubscribe();
      } catch (e) {
        try { (supabase as any).removeChannel?.(channel); } catch (ignored) {}
      }
    };
  }, [screen, game?.id]);

  // Handle logout: fully clear session (localStorage + supabase auth) and reset state
  const handleLogoutOfGame = async () => {
    try {
      if (supabase && supabase.auth && typeof supabase.auth.signOut === 'function') {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Supabase signOut failed:', err);
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_CODE);
        localStorage.removeItem(STORAGE_KEY_NAME);
      } catch (e) {
        // ignore
      }
    }

    setPlayer(null);
    setGame(null);
    setGameCode("");
    setName("");
    setScreen("join-create");
  };

  const handleRemovePlayer = async (id: string) => {
    try {
      if (!game) return;
      if (!player || !player.is_commissioner) {
        try { toast({ title: 'Not allowed', description: 'Only the commissioner can remove players.' }); } catch {}
        return;
      }

      // Insert a 'kick' event so the removed name cannot rejoin easily
      try {
        const { data: removedRows } = await supabase.from('players').select('name').eq('id', id).limit(1);
        const removedName = removedRows && removedRows.length > 0 ? removedRows[0].name : null;
        await supabase.from('money_events').insert([{
          game_id: game.id,
          actor_player_id: player.id,
          from_player_id: null,
          to_player_id: null,
          amount: 0,
          type: 'kick',
          description: `kicked:${removedName ?? ''}:${id}`,
        }]);
      } catch (e) {
        // non-fatal
        console.warn('Failed to insert kick event', e);
      }

      const { error } = await supabase.from('players').delete().eq('id', id).eq('game_id', game.id);
      if (error) throw error;

      // Refresh player list
      const updated = await fetchPlayers(game.code);
      setPlayersList(updated);
      try { toast({ title: 'Player removed', description: 'Player was removed from the game.' }); } catch {}
    } catch (err) {
      console.error('Remove player failed', err);
      // If delete failed due to foreign key constraints (referenced in money_events),
      // try nulling those references then retry deletion.
      try {
        const e = err as any;
        const isFk = e && (e.code === '23503' || (e.details && String(e.details).includes('still referenced')));
        if (isFk && game) {
          try {
            await supabase.from('money_events').update({ actor_player_id: null }).eq('actor_player_id', id).eq('game_id', game.id);
            await supabase.from('money_events').update({ from_player_id: null }).eq('from_player_id', id).eq('game_id', game.id);
            await supabase.from('money_events').update({ to_player_id: null }).eq('to_player_id', id).eq('game_id', game.id);

            // Retry deletion
            const { error: delErr } = await supabase.from('players').delete().eq('id', id).eq('game_id', game.id);
            if (delErr) throw delErr;

            const updated2 = await fetchPlayers(game.code);
            setPlayersList(updated2);
            try { toast({ title: 'Player removed', description: 'Player was removed after clearing related events.' }); } catch {}
            return;
          } catch (inner) {
            console.error('Retry delete after nulling references failed', inner);
            try { toast({ title: 'Remove failed', description: 'Unable to remove player due to related records.' }); } catch {}
            return;
          }
        }
      } catch (checkerErr) {
        console.error('FK check failed', checkerErr);
      }

      try { toast({ title: 'Remove failed', description: (err as any)?.message || 'Unable to remove player.' }); } catch {}
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
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  if (!gameCode.trim()) return;
                  try {
                    setLoading(true);
                    // Verify the game exists now (before moving to name entry)
                    const { data: games, error: gErr } = await supabase
                      .from('games')
                      .select('*')
                      .eq('code', gameCode)
                      .limit(1);
                    if (gErr) throw gErr;
                    if (!games || games.length === 0) {
                      try { toast({ title: 'Game not found', description: 'No game exists with that code.' }); } catch {}
                      setLoading(false);
                      return;
                    }
                    // cache the game in state so the next step can reuse it and avoid re-checking
                    setGame(games[0]);
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
                  maxLength={8}
                  autoFocus
                />
                <Button className="w-full py-4 text-lg font-semibold shadow-md" size="lg" type="submit" disabled={!gameCode.trim() || loading}>
                  {loading ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      Looking for game...
                    </>
                  ) : (
                    'Join Game'
                  )}
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
                      <Button key={c} variant="outline" className="px-3" onClick={() => handleRecentClick(c)}>
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
  }

  // Step 2: Enter Name
  if (screen === 'select-existing-player' && recentPlayers) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl mb-2">Select Your Name</CardTitle>
            <CardDescription>Choose which player you are in game {gameCode}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {recentPlayers.map((p: any) => (
                <Button key={p.id} className="w-full text-left" onClick={() => signInAsExistingPlayer(p)}>
                  {p.name}
                </Button>
              ))}
              <div className="pt-4">
                <Button variant="secondary" className="w-full" onClick={() => setScreen('enter-name')}>Not me / Use different name</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
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
                    // go to confirm settings step before creating the game
                    setLoading(false);
                    setScreen("confirm-settings");
                    return;
                  } else {
                    // Join existing game: prefer cached `game` state if present, otherwise fetch
                    let localGame = game;
                    if (!localGame || localGame.code !== gameCode) {
                      const { data: games2, error: gErr2 } = await supabase
                        .from('games')
                        .select('*')
                        .eq('code', gameCode)
                        .limit(1);
                      if (gErr2) throw gErr2;
                      if (!games2 || games2.length === 0) throw new Error('Game not found');
                      localGame = games2[0];
                    }

                    // Check if player exists
                    const { data: existingPlayers, error: pErr } = await supabase
                      .from('players')
                      .select('*')
                      .eq('game_id', localGame.id)
                      .eq('name', name)
                      .limit(1);
                    if (pErr) throw pErr;

                    let newOrExistingPlayer;
                    if (existingPlayers && existingPlayers.length > 0) {
                      newOrExistingPlayer = existingPlayers[0];
                      // Update last seen
                      await supabase
                        .from('players')
                        .update({ is_online: true, last_seen_at: new Date().toISOString() })
                        .eq('id', newOrExistingPlayer.id);
                    } else {
                      // Prevent creating a player with a name that was kicked
                      const kicked = await isNameKicked(localGame.id, name);
                      if (kicked) {
                        setError('This name was removed from the game and cannot rejoin. Please choose a different name.');
                        setLoading(false);
                        return;
                      }

                      // Create new player
                      const { data: allPlayers } = await supabase
                        .from('players')
                        .select('id', { count: 'exact' })
                        .eq('game_id', localGame.id);
                      const isFirstPlayer = !allPlayers || allPlayers.length === 0;

                      const { data: createdPlayer, error: newErr } = await supabase
                        .from('players')
                        .insert([{
                          game_id: localGame.id,
                          name: (name ?? '').toUpperCase(),
                          balance: localGame.initial_balance ?? 0,
                          is_commissioner: isFirstPlayer,
                        }])
                        .select()
                        .single();
                      if (newErr) throw newErr;
                      newOrExistingPlayer = createdPlayer;

                      // Set host if first player
                      if (isFirstPlayer && !localGame.host_player_id) {
                        await supabase
                          .from('games')
                          .update({ host_player_id: newOrExistingPlayer.id })
                          .eq('id', localGame.id);
                      }

                      // Log join
                      await supabase.from('money_events').insert([{
                        game_id: localGame.id,
                        actor_player_id: newOrExistingPlayer.id,
                        from_player_id: null,
                        to_player_id: newOrExistingPlayer.id,
                        amount: 0,
                        type: 'join',
                        description: `${newOrExistingPlayer.name} joined the game`,
                      }]);
                    }

                    // Persist state and go home
                    setGame(localGame);
                    setPlayer(newOrExistingPlayer);
                    setGameCode(localGame.code);
                    try { localStorage.setItem(STORAGE_KEY_CODE, localGame.code); localStorage.setItem(STORAGE_KEY_NAME, (name ?? '').toUpperCase()); } catch (e) {}
                    pushRecentGame(localGame.code);
                    setScreen('home');
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
                onChange={(e) => setName((e.target.value ?? '').toUpperCase())}
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

  // Step 2b: Confirm Settings (only for creating a new game)
  if (screen === "confirm-settings") {
    // allow non-negative integers (0 and positive integers), no decimals
    const isNonNegativeInteger = (s: string) => /^\d+$/.test(s) && Number(s) >= 0;
    const canCreate = isNonNegativeInteger(tempInitialBalance) && isNonNegativeInteger(tempPassGoAmount) && isNonNegativeInteger(tempFreeParkingBalance);

    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl mb-2">Confirm Game Settings</CardTitle>
            <CardDescription>Set starting balances and game options before creating the game.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);

                if (!canCreate) {
                  setError('All values must be non-negative integers (no decimals)');
                  return;
                }

                setLoading(true);
                try {
                  // Create game with provided settings
                  const code = await createUniqueGameCode();
                  const { data: newGame, error: createErr } = await supabase
                    .from('games')
                    .insert([{
                      code,
                      initial_balance: Number(tempInitialBalance || 0),
                      pass_go_amount: Number(tempPassGoAmount || 0),
                      free_parking_balance: Number(tempFreeParkingBalance || 0),
                      show_balances: tempShowBalances,
                    }])
                    .select()
                    .single();

                  if (createErr) throw createErr;

                  // Create host player
                  const { data: newPlayer, error: joinErr } = await supabase
                    .from('players')
                    .insert([{
                      game_id: newGame.id,
                      name: (name ?? '').toUpperCase(),
                      balance: Number(newGame.initial_balance ?? tempInitialBalance ?? 0),
                      is_commissioner: true,
                    }])
                    .select()
                    .single();

                  if (joinErr) throw joinErr;

                  // Set host on game record
                  await supabase
                    .from('games')
                    .update({ host_player_id: newPlayer.id })
                    .eq('id', newGame.id);

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
                  localStorage.setItem(STORAGE_KEY_NAME, (name ?? '').toUpperCase());
                  pushRecentGame(newGame.code);
                  setScreen('home');
                } catch (err: any) {
                  console.error('Create with settings failed:', err);
                  setError(err?.message || 'Failed to create game');
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="grid grid-cols-1 gap-3">
                <label className="text-sm text-muted-foreground">Starting Balance</label>
                <Input
                  type="number"
                  min={0}
                  value={tempInitialBalance}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^[0-9]*$/.test(v)) setTempInitialBalance(v);
                  }}
                />

                <label className="text-sm text-muted-foreground">Pass Go Amount</label>
                <Input
                  type="number"
                  min={0}
                  value={tempPassGoAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^[0-9]*$/.test(v)) setTempPassGoAmount(v);
                  }}
                />

                <label className="text-sm text-muted-foreground">Free Parking Starting Pot</label>
                <Input
                  type="number"
                  min={0}
                  value={tempFreeParkingBalance}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^[0-9]*$/.test(v)) setTempFreeParkingBalance(v);
                  }}
                />

                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 mt-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">Show Player Balances</div>
                    <div className="text-xs text-muted-foreground">Allow players to see each other's money</div>
                  </div>
                  <Switch
                    checked={tempShowBalances}
                    onCheckedChange={(checked) => setTempShowBalances(checked)}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button type="submit" className="flex-1" disabled={!canCreate || loading}>{loading ? 'Creating...' : 'Create Game'}</Button>
              </div>
              {error && <div className="text-destructive text-sm mt-2">{error}</div>}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Home (main game screen)
  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col">
      <Toaster />
      <AlertDialog open={removedNoticeOpen} onOpenChange={(v) => { if (!v) handleLogoutOfGame(); setRemovedNoticeOpen(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Removed from game</AlertDialogTitle>
            <AlertDialogDescription>{removedNoticeMsg ?? 'You were removed from this game.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setRemovedNoticeOpen(false); }}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 z-50">
        <div className="font-semibold text-lg text-foreground flex items-center gap-2">
          <div>{player?.name ?? name}</div>
          <div className="text-sm text-muted-foreground">{(player?.total_sips ?? 0)} sips</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/drunk/drunkopoly/rules')}>Rules</Button>
          <GameCodePopover
            code={game?.code ?? gameCode}
            onLogout={handleLogoutOfGame}
            players={playersList}
            currentPlayer={player}
            game={game}
            onRemovePlayer={handleRemovePlayer}
            soundEnabled={soundEnabled}
            showBalances={game?.show_balances ?? true}
            onToggleSound={(enabled) => {
              setSoundEnabled(enabled);
              try {
                localStorage.setItem("drunkopoly:soundEnabled", String(enabled));
              } catch (e) {
                // ignore localStorage errors
              }
            }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="mb-8">
          <div className="text-muted-foreground text-lg mb-2 text-center">
            Current Balance
          </div>
          <div className="text-6xl font-extrabold text-primary text-center">
            <AnimatedNumber value={player?.balance ?? game?.initial_balance ?? 1500} soundEnabled={soundEnabled} />
          </div>
        </div>

        {/* SIP section*/}
        <Section title="Sips">
          <div className="grid grid-cols-1 gap-4 w-64">
              <Button variant="secondary" className="py-6" onClick={() => setSipModalOpen(true)}>
                <UserPlus className="h-5 w-5" />
                Give Sips
              </Button>
            </div>
        </Section>

        {/* Pay section */}
        <Section title="Pay" className={"mt-8"}>
          <div className="grid grid-cols-1 gap-4 w-64">
            <Button
              variant="secondary"
              className="w-full py-6"
              onClick={() => {
                setPayMode("bank");
                setPayModalOpen(true);
              }}
            >
              <DollarSign className="h-5 w-5" />
              Bank
            </Button>
            <Button
              variant="secondary"
              className="w-full py-6"
              onClick={() => {
                setPayMode("players");
                setPayModalOpen(true);
              }}
            >
              <Users className="h-5 w-5" />
              Players
            </Button>
            <Button
              variant="secondary"
              className="w-full py-6"
              onClick={() => {
                setPayMode("tax");
                setPayModalOpen(true);
              }}
            >
              <Percent className="h-5 w-5" />
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
          showBalances={game?.show_balances ?? true}
          onSubmit={async (payments, opts) => {
            if (!game || !player) return;
            try {
              const result = await processPayments(game.code, player.id, payments, { ...(opts || {}), mode: payMode });
              
              // Check for blocked payments (pending sips / jailed recipients)
              const blocked = (result.money_events || []).filter((me: any) => (Number(me.amount || 0) === 0) && me.to_player_id);
              if (blocked.length > 0) {
                const byReason: Record<string, any[]> = {};
                for (const b of blocked) {
                  const desc = (b.description || '').toLowerCase();
                  const key = desc.includes('pending sips') ? 'sips' : desc.includes('in jail') || desc.includes('jail') ? 'jail' : 'other';
                  if (!byReason[key]) byReason[key] = [];
                  byReason[key].push(b);
                }

                const parts: string[] = [];
                if (byReason.sips) {
                  const names = byReason.sips.map((b: any) => {
                    const found = (playersList || []).find((pl: any) => pl.id === b.to_player_id);
                    return found ? found.name : b.to_player_id;
                  }).join(', ');
                  parts.push(`No money was sent to ${names} because they have pending sips. Congrats! 🎉`);
                }
                if (byReason.jail) {
                  const names = byReason.jail.map((b: any) => {
                    const found = (playersList || []).find((pl: any) => pl.id === b.to_player_id);
                    return found ? found.name : b.to_player_id;
                  }).join(', ');
                  parts.push(`No money was sent to ${names} because they are in jail. Congrats! 🎉`);
                }
                if (byReason.other) {
                  const names = byReason.other.map((b: any) => {
                    const found = (playersList || []).find((pl: any) => pl.id === b.to_player_id);
                    return found ? found.name : b.to_player_id;
                  }).join(', ');
                  parts.push(`No money was sent to ${names}.`);
                }

                setBlockedPaymentMessage(parts.join(' '));
              }

              // Refresh state; AnimatedNumber will animate based on the changed `balance` value

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
          allowSelf={!!(player?.is_commissioner || (game?.host_player_id === player?.id))}
          onSubmit={async (to, sip_count) => {
            if (!game || !player) return;
            try {
              if (Array.isArray(to)) {
                for (const t of to) {
                  await assignSips(game.code, player.id, t, sip_count);
                }
              } else {
                await assignSips(game.code, player.id, to, sip_count);
              }
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
          <div className="grid grid-cols-1 gap-4 w-64">
            <Button variant="secondary" className="w-full py-6" onClick={() => { setCollectMode('bank'); setCollectModalOpen(true); }}>
              <DollarSign className="h-5 w-5" />
              Bank
            </Button>
            <Button variant="secondary" className="w-full py-6" onClick={() => { setCollectMode('pass_go'); setCollectModalOpen(true); }}>
              <Crown className="h-5 w-5" />
              Pass Go
            </Button>
            <Button 
              variant="secondary" 
              className="w-full py-6" 
              onClick={() => { 
                setCollectMode('free_parking'); 
                setCollectModalOpen(true); 
              }}
            >
              <PiggyBank className="h-5 w-5" />
              Free Parking
            </Button>
          </div>
        </Section>
        
        {/* Actions section (trade timer) */}
        <Section title="Actions" className="mt-8">
          <div className="grid grid-cols-1 gap-4 w-64">
            <Button
              variant="secondary"
              className="w-full py-6"
              onClick={() => {
                setTradeTimerSelected(Number(game?.trade_timer_seconds ?? 60));
                setTradeTimerModalOpen(true);
              }}
            >
              <Clock className="h-5 w-5" />
              Trade Timer
            </Button>
            <Button
              variant="secondary"
              className="w-full py-6"
              onClick={() => setJailModalOpen(true)}
            >
              <Users className="h-5 w-5" />
              Jail
            </Button>
          </div>
        </Section>

        <Dialog open={tradeTimerModalOpen} onOpenChange={(v) => setTradeTimerModalOpen(v)}>
          <DialogContent>
            <div className="px-4">
              <DialogHeader>
                <DialogTitle>Trade Timer</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <TradeTimerControl
                  tradeLocked={!!game?.trade_locked}
                  currentSeconds={Number(game?.trade_timer_seconds ?? 60)}
                  selected={tradeTimerSelected}
                  onSelect={(s) => setTradeTimerSelected(s)}
                />
              </div>
              <DialogFooter>
                <div className="flex gap-2 w-full justify-end">
                  <Button variant="secondary" onClick={() => setTradeTimerModalOpen(false)}>Cancel</Button>
                  {!game?.trade_locked ? (
                    <Button onClick={() => { startTradeTimer(tradeTimerSelected); setTradeTimerModalOpen(false); }}>
                      Start
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={() => { stopTradeTimer(); setTradeTimerModalOpen(false); }}>
                      Done
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <JailPopup
          open={jailModalOpen}
          onOpenChange={(v) => setJailModalOpen(v)}
          currentPlayer={player}
          players={playersList}
          showBalances={game?.show_balances ?? true}
          onSubmit={async (targetId) => {
            await sendPlayerToJail(targetId);
          }}
        />

        <JailLockOverlay
          open={!!player?.in_jail}
          jailedByName={playersList?.find((p: any) => p.id === player?.jail_started_by)?.name ?? null}
          hasGetOutCard={!!player?.has_get_out_of_jail_card}
          currentBalance={player?.balance ?? 0}
          payProcessing={payProcessing}
          cardProcessing={cardProcessing}
          onPayToGetOut={() => payToGetOut()}
          onUseCard={() => useGetOutCard()}
        />

        {/* Lockdown overlay when player has pending sips - rendered after jail so it appears on top */}
        {player?.pending_sips > 0 && (
          <div className="fixed inset-0 z-[99999] pointer-events-auto">
            <div className="absolute inset-0 bg-black" />
            <div className="relative z-[99999] min-h-screen flex items-center justify-center px-6">
              <div className="max-w-lg w-full text-center text-white">
                <div className="flex flex-col items-center gap-6 py-12">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-16 h-16 text-white" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2" />
                    <rect x="4" y="10" width="16" height="10" rx="2" strokeWidth={1.5} />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 10V8a5 5 0 0110 0v2" />
                  </svg>
                  <div className="text-2xl font-bold">You have {player.pending_sips} sip{player.pending_sips > 1 ? 's' : ''}</div>
                  <p className="mt-3 text-lg text-white/90">Finish your sips to continue playing.</p>
                  <p className="mt-1 text-sm text-white/70">You cannot collect money until you've finished.</p>
                  <div className="w-full mt-4">
                    <Button
                      className="w-full"
                      onClick={async () => {
                        if (!game || !player) return;
                        try {
                          setCompletingSips(true);
                          await completeSips(game.code, player.id);
                          // Refresh state
                          const players = await fetchPlayers(game.code);
                          setPlayersList(players);
                          const updatedPlayer = players.find((p: any) => p.id === player.id);
                          if (updatedPlayer) setPlayer(updatedPlayer);
                        } catch (err: any) {
                          console.error('Complete sips error:', err);
                          alert(err.message || 'Failed to complete sips');
                        } finally {
                          setCompletingSips(false);
                        }
                      }}
                      disabled={completingSips}
                    >
                      {completingSips ? (
                        <>
                          Processing...
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 inline ml-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            style={{
                              verticalAlign: 'middle',
                              animation: 'spin 1s linear infinite'
                            }}
                          >
                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M22 12a10 10 0 00-10-10" strokeLinecap="round" />
                          </svg>
                        </>
                      ) : (
                        'Done'
                      )}
                      
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <TradeLockOverlay
          open={!!game?.trade_locked}
          expiresAt={game?.trade_timer_expires_at}
          startedByName={playersList?.find((p: any) => p.id === game?.trade_started_by)?.name ?? null}
          onDone={() => stopTradeTimer()}
        />
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

function AnimatedNumber({ value, soundEnabled = true }: { value: number; soundEnabled?: boolean }) {
  const [display, setDisplay] = useState<number>(value ?? 0);
  const prevRef = useRef<number>(value ?? 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [bump, setBump] = useState<'up' | 'down' | 'neutral'>('neutral');
  const timeoutRef = useRef<number | null>(null);

  // initialize audio once
  useEffect(() => {
    try {
      if (!audioRef.current) {
        const a = new Audio('/money.mp3');
        a.preload = 'auto';
        a.volume = 0.85;
        audioRef.current = a;
        
        // Set Media Session metadata for iOS media player
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Drinking Games',
            artist: 'Drunkopoly',
            artwork: [
              { src: '/drunk_logo.png', sizes: '512x512', type: 'image/png' }
            ]
          });
        }
      }
    } catch (e) {
      // ignore audio init errors
      console.warn('Audio init failed', e);
    }
  }, []);

  useEffect(() => {
    const start = prevRef.current ?? 0;
    const end = value ?? 0;
    if (start === end) return;

    setBump(end > start ? 'up' : 'down');

    // If increase: play sound now and delay animation so audio starts
    const delayMs = 500;
    if (end > start && soundEnabled) {
      try {
        const a = audioRef.current;
        if (a) {
          a.currentTime = 0;
          const p = a.play();
          if (p && typeof p.then === 'function') p.catch(() => {});
        }
      } catch (e) {
        // ignore
      }
    }

    const duration = 700;
    let raf = 0;
    let startTime = 0;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      if (!startTime) startTime = now;
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOut(t);
      const curr = start + (end - start) * eased;
      setDisplay(curr);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevRef.current = end;
        setTimeout(() => setBump('neutral'), 350);
      }
    };

    // start animation after delayMs (so audio starts ~delayMs before)
    timeoutRef.current = window.setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value]);

  // bump only driven by internal value changes

  const formatted = Math.round(display).toLocaleString();

  const baseStyle: React.CSSProperties = {
    transition: 'transform 320ms cubic-bezier(.2,.8,.2,1), color 320ms',
    transformOrigin: 'center',
  };

  const upStyle: React.CSSProperties = {
    ...baseStyle,
    transform: 'translateY(-6px) scale(1.06) rotate(-3deg)'
  };

  const downStyle: React.CSSProperties = {
    ...baseStyle,
    transform: 'translateY(4px) scale(1.02) rotate(2deg)'
  };

  const styleToUse = bump === 'up' ? upStyle : bump === 'down' ? downStyle : baseStyle;
  // Use either the internal bump state OR the external flash prop
  // to determine color so external flashes (from payments) always reflect
  // increase/decrease visually even if the internal animation timing differs.
  const isUp = bump === 'up';
  const isDown = bump === 'down';
  const colorClass = isUp ? 'text-green-400' : isDown ? 'text-destructive' : 'text-primary';

  // Inline hex color to ensure it overrides any inherited text color
  const colorHex = isUp ? '#34D399' /* green-400 */ : isDown ? '#EF4444' /* red-500 */ : undefined;

  return (
    <div aria-live="polite" className="inline-flex items-baseline gap-1">
      <span className={`text-2xl align-baseline ${colorClass}`} style={{ ...styleToUse, color: colorHex }}>{"$"}</span>
      <span className={`align-baseline ${colorClass}`} style={{ ...styleToUse, fontVariantNumeric: 'tabular-nums', color: colorHex }}>{formatted}</span>
    </div>
  );
}

function GameCodePopover({ code, onLogout, players, currentPlayer, game, onRemovePlayer, soundEnabled, onToggleSound, showBalances = true }: { code: string; onLogout?: () => void; players?: any[]; currentPlayer?: any; game?: any; onRemovePlayer?: (id: string) => Promise<void>; soundEnabled?: boolean; onToggleSound?: (enabled: boolean) => void; showBalances?: boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name?: string } | null>(null);

  const requestRemove = (id: string, name?: string) => {
    setPendingRemove({ id, name });
    setConfirmOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!onRemovePlayer || !pendingRemove) return;
    try {
      await onRemovePlayer(pendingRemove.id);
      setConfirmOpen(false);
      setPendingRemove(null);
    } catch (e) {
      try { toast({ title: 'Unable to remove', description: 'Failed to remove player.' }); } catch {}
    }
  };

  const handleCopyInvite = async () => {
    try {
      const base = window.location.origin + window.location.pathname;
      const inviteUrl = `${base}?invite=${encodeURIComponent(code)}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = inviteUrl;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      try {
        toast({ title: 'Invite link copied', description: 'Paste it to share the game.' });
      } catch (e) {
        // ignore toast errors
      }
    } catch (err) {
      try {
        toast({ title: 'Unable to copy', description: 'Copying invite link failed.' });
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <>
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
          <Button variant="secondary" className="w-full mt-1" onClick={() => setQrCodeOpen(true)}>
            <QrCode size={16} />
            QR Code
          </Button>
          <Button variant="secondary" className="w-full mt-1" onClick={handleCopyInvite}>
            <Copy size={16} />
            Invite Link
          </Button>
          <Button variant="secondary" className="w-full mt-1" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            Settings
          </Button>
          <Button variant="destructive" className="w-full mt-1 ring-2 ring-red-500/10 shadow-sm shadow-red-500/20" onClick={onLogout}>
            Log Out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
    <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-6">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG 
              value={`${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(code)}`} 
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Scan this code to join the game
          </p>
          <p className="text-center font-mono font-bold text-lg mt-2">
            {code}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => setQrCodeOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        {/* Sound Settings Section */}
        <div className="space-y-4 mt-2">
          <div className="pb-4 border-b">
            <h3 className="text-sm font-semibold mb-3">Sound</h3>
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
              <div className="flex-1">
                <div className="font-medium text-sm">App Sounds</div>
                <div className="text-xs text-muted-foreground">Play sounds for money changes</div>
              </div>
              <Switch
                checked={soundEnabled ?? true}
                onCheckedChange={(checked) => {
                  if (onToggleSound) onToggleSound(checked);
                }}
              />
            </div>
          </div>
          
          {/* Players Section */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Players</h3>
            <div className="space-y-2">
              {(players && players.length > 0) ? (
                players.map((p: any) => {
                  const isSelf = currentPlayer && String(currentPlayer.id) === String(p.id);
                  const isCommissioner = !!p.is_commissioner;
                  const canRemove = currentPlayer && (currentPlayer.is_commissioner || currentPlayer.is_commissioner === true) && !isCommissioner && !isSelf;
                  // Show balance if showBalances is enabled
                  const canSeeBalance = showBalances;
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2 px-2 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{p.name}{isCommissioner ? ' • Commissioner' : isSelf ? ' • You' : ''}</div>
                        {canSeeBalance && (
                          <div className="text-sm text-muted-foreground">Balance: ${Number(p.balance || 0).toLocaleString()}</div>
                        )}
                      </div>
                      <div>
                        <Button size="sm" variant="destructive" disabled={!canRemove} onClick={() => requestRemove(p.id, p.name)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">No players found.</div>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmOpen} onOpenChange={(v) => { setConfirmOpen(v); if (!v) setPendingRemove(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove player</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove <span className="font-medium">{pendingRemove?.name ?? 'this player'}</span> from the game? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmRemove} className="bg-destructive">Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default Drunkopoly;