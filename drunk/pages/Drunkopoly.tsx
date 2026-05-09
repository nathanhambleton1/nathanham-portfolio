import { useEffect, useState, useRef } from "react";
import PayPopup from "../components/PayPopup";
import JailPopup from "../components/JailPopup";
import BankruptPopup from "../components/BankruptPopup";
import BankruptStatus from "../components/BankruptStatus";
import SipsLockOverlay from "../components/SipsLockOverlay";
import PropertiesPopup from "../components/PropertiesPopup";
import RankingsPopup from "../components/RankingsPopup";
import SipLeaderboardPopup from "../components/SipLeaderboardPopup";
import { UserPlus, DollarSign, Users, Percent, Crown, PiggyBank, Clock, Copy, Settings, QrCode, ChevronDown, ChevronLeft, Info, Eye, EyeOff, Building2, MessagesSquare } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import CollectPopup from "../components/CollectPopup";
import RoulettePopup, { type RouletteSpinBroadcast } from "../components/RoulettePopup";
import RouletteSpectatorPopup from "../components/RouletteSpectatorPopup";
import SipPopup from "../components/SipPopup";
import TradeTimerControl from "../components/TradeTimerControl";
import TradeLockOverlay from "../components/TradeLockOverlay";
import JailLockOverlay from "../components/JailLockOverlay";
import ActivityLog from "../components/ActivityLog";
import PlayerAvatar from "../components/PlayerAvatar";
import { ThemeSelector } from "../../src/components/ThemeSelector";
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
import useLockBodyScroll from "../hooks/use-lock-body-scroll";
import {
  initializePlayerStats,
  trackMoneyFromGo,
  trackMoneyFromFreeParking,
  trackMoneyFromBank,
  trackMoneyFromPlayer,
  trackMoneyToBank,
  trackMoneyToPlayer,
  trackJailPayment,
  trackWentToJail
} from "../lib/playerStatsTracking";

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Screen = "join-create" | "enter-name" | "confirm-settings" | "select-existing-player" | "home" | "auth" | "profile";

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
  const [tempSipsEnabled, setTempSipsEnabled] = useState<boolean>(true);
  const [tempExpansionEnabled, setTempExpansionEnabled] = useState<boolean>(false);
  const [tempGamblingEnabled, setTempGamblingEnabled] = useState<boolean>(false);
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
  const [propertiesModalOpen, setPropertiesModalOpen] = useState(false);
  const [rankingsModalOpen, setRankingsModalOpen] = useState(false);
  const [sipLeaderboardOpen, setSipLeaderboardOpen] = useState(false);
  const [payProcessing, setPayProcessing] = useState(false);
  const [cardProcessing, setCardProcessing] = useState(false);
  const [insufficientFundsFlash, setInsufficientFundsFlash] = useState(false);
  const [completingSips, setCompletingSips] = useState(false);
  const [pendingSipEvents, setPendingSipEvents] = useState<{ id: string; sip_count: number }[]>([]);
  const [freeParkingPot, setFreeParkingPot] = useState(0);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectMode, setCollectMode] = useState<'bank'|'pass_go'|'free_parking'|null>(null);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [rouletteAmount, setRouletteAmount] = useState(0);
  const [rouletteMode, setRouletteMode] = useState<'pass_go'|'free_parking'|null>(null);
  const [rouletteDoubled, setRouletteDoubled] = useState(false);
  const [spectatorOpen, setSpectatorOpen] = useState(false);
  const [spectatorData, setSpectatorData] = useState<RouletteSpinBroadcast | null>(null);
  const realtimeChannelRef = useRef<any>(null);
  const [bankruptModalOpen, setBankruptModalOpen] = useState(false);
  const [bankruptStatusOpen, setBankruptStatusOpen] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [blockedPaymentMessage, setBlockedPaymentMessage] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);
  const prevBalanceRef = useRef<number | null>(null);

  // Transaction metadata for the orbital animation around the money tower
  type TransactionType = 'bank' | 'player' | 'tax' | 'free_parking' | 'pass_go' | 'jail' | null;
  type OrbitalEntity = { id: string; name: string; avatar_url?: string | null };
  const [transactionMeta, setTransactionMeta] = useState<{
    type: TransactionType;
    direction: 'in' | 'out';
    entities?: OrbitalEntity[];
    key: number;
  } | null>(null);
  const txMetaKeyRef = useRef(0);
  // Set to true by direct collect actions so the realtime subscription knows not to fire a second animation
  const directAnimationFiredRef = useRef(false);
  const navigate = useNavigate();
  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' ? window.innerWidth < 400 : false;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsNarrow(window.innerWidth < 400);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Commissioner unlock / PIN (centralized so parent and popover agree)
  const [commPinOpen, setCommPinOpen] = useState(false);
  const [commToolsOpen, setCommToolsOpen] = useState(false);
  const [commPinValue, setCommPinValue] = useState('');
  const [commUnlockedUntil, setCommUnlockedUntil] = useState<number>(() => {
    try { return Number(localStorage.getItem('drunkopoly:commUnlockedUntil') || 0); } catch { return 0; }
  });

  // Simple account state (stored in `drunk_users` table in Supabase)
  const [accountMode, setAccountMode] = useState<'none'|'signin'|'signup'>('none');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  // removed bio input; keep state only if needed later
  const [authBio, setAuthBio] = useState('');
  const [authAvatarFile, setAuthAvatarFile] = useState<File | null>(null);
  const [authAvatarPreview, setAuthAvatarPreview] = useState<string | null>(null);
  // standalone auth screen mode (used on the dedicated auth screen)
  const [standaloneAuthMode, setStandaloneAuthMode] = useState<'signin' | 'signup'>('signin');
  // profile edit state
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any|null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('drunkopoly:authUser') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.username) return parsed;
      }
    } catch (e) {}
    return null;
  });

  // NOTE: This is NOT a secret. Vite env vars are bundled into the client.
  // Real security must be enforced server-side (Supabase RLS / policies).
  const commissionerPin = 'drunk1234';
  const commUnlocked = Date.now() < (commUnlockedUntil || 0);

  const openCommissionerTools = () => {
    // GameCodePopover will set default selection; just open the PIN or tools here.
    if (commUnlocked) {
      setCommToolsOpen(true);
      return;
    }
    setCommPinValue('');
    setCommPinOpen(true);
  };

  const tryUnlockCommissionerTools = () => {
    if ((commPinValue || '') === String(commissionerPin || '')) {
      const until = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      setCommUnlockedUntil(until);
      try { localStorage.setItem('drunkopoly:commUnlockedUntil', String(until)); } catch { /* ignore */ }
      setCommPinOpen(false);
      setCommToolsOpen(true);
      setCommPinValue('');
      try { toast({ title: 'Unlocked', description: 'Commissioner Tools unlocked for 24 hours.' }); } catch { /* ignore */ }
      return;
    }
    try { toast({ title: 'Incorrect PIN', description: 'Commissioner Tools PIN was incorrect.', variant: 'destructive' }); } catch { /* ignore */ }
  };
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

  // Determine which overlays are active. We always want the sips overlay to
  // be visible when there are pending sips so players can clear them, but
  // we should NOT forcibly close other action popups when only the sips
  // overlay appears. Only jail or trade overlays should interrupt other flows.
  const jailOverlayOpen = !!player?.in_jail;
  // Derive sip batches directly from DB sip_events rows so separate rounds are
  // always tracked individually rather than being merged into a single counter.
  const sipBatches = pendingSipEvents.map(e => ({ id: e.id, count: e.sip_count }));
  const sipsOverlayOpen = sipBatches.length > 0;
  const tradeOverlayOpen = !!game?.trade_locked;

  useLockBodyScroll(jailOverlayOpen || tradeOverlayOpen, { scrollToTop: true });

  // If a blocking overlay (jail or trade) is active, close other action popups
  // so they don't persist or auto-open when overlays toggle. But do NOT close
  // popups when only the sips overlay is active.
  useEffect(() => {
    if (jailOverlayOpen || tradeOverlayOpen) {
      setSipModalOpen(false);
      setPayModalOpen(false);
      setCollectModalOpen(false);
      // also close the trade timer dialog if it's not the active overlay
      setTradeTimerModalOpen(false);
    }
  }, [jailOverlayOpen, tradeOverlayOpen]);

  const persistRecentGames = (list: string[]) => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  };

  const hasCommissionerAccess = () => {
    try {
      const unlocked = Number(localStorage.getItem('drunkopoly:commUnlockedUntil') || '0');
      // Allow either an explicit PIN unlock OR the current player being the commissioner.
      return Date.now() < unlocked || (!!player?.is_commissioner);
    } catch (e) {
      return false;
    }
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
        // If a current auth user exists, try to auto-sign them into the matching player
        try {
          if (currentUser) {
            const preferred = ((currentUser.first_name || currentUser.username) || '').toString().toUpperCase();
            if (preferred) {
              const match = (players || []).find((p: any) => (String(p.name || '').toUpperCase()) === preferred);
                    if (match) {
                      // sign in the matched player and bail out
                      await signInAsExistingPlayer(match, code);
                      return;
                    }
            }
          }
        } catch (e) {
          // ignore matching errors and fall back to selection flow
          console.warn('Auto-match recent player failed', e);
        }

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

  const signInAsExistingPlayer = async (p: any, codeArg?: string) => {
    try {
      const codeToUse = codeArg || gameCode;
      // fetch game
      const { data: games, error: gErr } = await supabase.from('games').select('*').eq('code', codeToUse).limit(1);
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      const g = games[0];

      // mark online and sync avatar
      const onlineUpdate: any = { is_online: true, last_seen_at: new Date().toISOString() };
      if (currentUser?.avatar_url) onlineUpdate.avatar_url = currentUser.avatar_url;
      await supabase.from('players').update(onlineUpdate).eq('id', p.id);
      if (currentUser?.avatar_url) p = { ...p, avatar_url: currentUser.avatar_url };

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

  const persistAuthUser = (u: any | null) => {
    try {
      if (!u) {
        localStorage.removeItem('drunkopoly:authUser');
        setCurrentUser(null);
        return;
      }
      localStorage.setItem('drunkopoly:authUser', JSON.stringify(u));
      setCurrentUser(u);
    } catch (e) { /* ignore */ }
  };

  const compressImageToBlob = (file: File, maxDim = 128, quality = 0.65): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        // Crop to a centered square then resize to maxDim (or smaller if image is smaller)
        const srcSide = Math.min(img.width, img.height);
        const sx = Math.round((img.width - srcSide) / 2);
        const sy = Math.round((img.height - srcSide) / 2);
        const outSide = Math.min(maxDim, srcSide);
        const canvas = document.createElement('canvas');
        canvas.width = outSide;
        canvas.height = outSide;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        // draw the centered square portion of the source image into the output square canvas
        ctx.drawImage(img, sx, sy, srcSide, srcSide, 0, 0, outSide, outSide);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          resolve(blob);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });

  const uploadAvatar = async (file: File, username: string): Promise<string> => {
    const blob = await compressImageToBlob(file);
    const path = `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  const signUpUser = async () => {
    if (!authUsername || !authPassword || !authFirstName) throw new Error('Provide username, password and first name');
    let avatar_url: string | null = null;
    if (authAvatarFile) {
      try { avatar_url = await uploadAvatar(authAvatarFile, authUsername); } catch (e) { /* avatar upload optional */ }
    }
    const payload = {
      username: authUsername,
      password: authPassword,
      first_name: authFirstName,
      last_name: authLastName || null,
      avatar_url,
      wins: 0,
      losses: 0,
    };
    const { data, error } = await supabase.from('drunk_users').insert([payload]).select().limit(1).single();
    if (error) throw error;
    persistAuthUser(data);
    return data;
  };

  const signInUser = async () => {
    if (!authUsername || !authPassword) throw new Error('Please provide username and password');
    // First check whether the username exists so we can give a clearer error message
    const { data: usersByName, error: nameErr } = await supabase.from('drunk_users').select('*').eq('username', authUsername).limit(1);
    if (nameErr) throw nameErr;
    if (!usersByName || usersByName.length === 0) throw new Error('Account not found');
    const user = usersByName[0];
    if ((user.password || '') !== authPassword) throw new Error('Incorrect password');
    persistAuthUser(user);
    return user;
  };

  const updateUserProfile = async (opts: { firstName: string; lastName: string; avatarFile?: File | null }) => {
    if (!currentUser?.id) throw new Error('Not signed in');
    let avatar_url = currentUser.avatar_url ?? null;
    if (opts.avatarFile) {
      avatar_url = await uploadAvatar(opts.avatarFile, currentUser.username);
    }
    const updates: any = {
      first_name: opts.firstName || currentUser.first_name,
      last_name: opts.lastName || null,
      avatar_url,
    };
    const { data, error } = await supabase.from('drunk_users').update(updates).eq('id', currentUser.id).select().limit(1).single();
    if (error) throw error;
    persistAuthUser(data);
    return data;
  };

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

  // Join game flow extracted so it can be reused (auto-login with signed-in user)
  const joinGameWithName = async (nameToUse: string) => {
    const cleaned = (nameToUse ?? '').trim();
    if (!cleaned) throw new Error('Name required');
    // Ensure uppercase validation
    if (!/^[A-Z ]{1,15}$/.test(cleaned.toUpperCase())) throw new Error('Name invalid');

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
      .eq('name', cleaned.toUpperCase())
      .limit(1);
    if (pErr) throw pErr;

    let newOrExistingPlayer;
    if (existingPlayers && existingPlayers.length > 0) {
      newOrExistingPlayer = existingPlayers[0];
      const rejoinUpdate: any = { is_online: true, last_seen_at: new Date().toISOString() };
      if (currentUser?.avatar_url) rejoinUpdate.avatar_url = currentUser.avatar_url;
      if (currentUser?.id) rejoinUpdate.user_id = currentUser.id;
      await supabase.from('players').update(rejoinUpdate).eq('id', newOrExistingPlayer.id);
      if (currentUser?.avatar_url) newOrExistingPlayer = { ...newOrExistingPlayer, avatar_url: currentUser.avatar_url };
    } else {
      // Prevent creating a player with a name that was kicked
      const kicked = await isNameKicked(localGame.id, cleaned);
      if (kicked) {
        throw new Error('This name was removed from the game and cannot rejoin.');
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
          name: cleaned.toUpperCase(),
          balance: localGame.initial_balance ?? 0,
          is_commissioner: isFirstPlayer,
          avatar_url: currentUser?.avatar_url || null,
          user_id: currentUser?.id || null,
        }])
        .select()
        .single();
      if (newErr) throw newErr;
      newOrExistingPlayer = createdPlayer;

      // Initialize player statistics
      await initializePlayerStats(localGame.id, newOrExistingPlayer.id);

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
    try { localStorage.setItem(STORAGE_KEY_CODE, localGame.code); localStorage.setItem(STORAGE_KEY_NAME, (cleaned ?? '').toUpperCase()); } catch (e) {}
    pushRecentGame(localGame.code);
    setScreen('home');
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

      // Determine whether payments to the bank should route to free parking.
      const expansionEnabled = !!game?.expansion_enabled;
      const freeParkingFlag = !!opts.freeParking || expansionEnabled;

      // Handle tax distribution
        if (opts.mode === 'tax' && !freeParkingFlag && payments.length === 1 && (payments[0].to == null)) {
        const amountPer = Number(payments[0].amount || 0);
        const { data: allPlayers, error: apErr } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', game.id);
        
        if (apErr) throw apErr;
        const recipients = (allPlayers || []).filter((p) => p.id !== actor_player_id);

        const inserts = [];
        for (const r of recipients) {
          const isInJail = !!r.in_jail;
          const amt = isInJail ? 0 : amountPer;
          const desc: string | null = isInJail ? (opts.description || `Recipient is in jail; no money was sent`) : (opts.description || null);

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
                  type: opts.type || (freeParkingFlag ? 'tax' : 'manual'),
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
              type: opts.type || (freeParkingFlag ? 'tax' : 'manual'),
              description: opts.description || null,
            });
            continue;
          }

          const recipient = rRows[0];
          const isInJail = !!recipient.in_jail;
          if (isInJail) {
            inserts.push({
              game_id: game.id,
              actor_player_id: actor_player_id,
              from_player_id: p.from_player_id || actor_player_id,
              to_player_id: p.to,
              amount: 0,
              type: opts.type || (freeParkingFlag ? 'tax' : 'manual'),
              description: opts.description || `Recipient is in jail; no money was sent`,
            });
            continue;
          }

          inserts.push({
            game_id: game.id,
            actor_player_id: actor_player_id,
            from_player_id: p.from_player_id || actor_player_id,
            to_player_id: p.to,
            amount: intended,
              type: opts.type || (freeParkingFlag ? 'tax' : 'manual'),
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
          
          // Track money received by recipient from payer
          const isRent = (opts.type === 'rent' || opts.description?.toLowerCase().includes('rent'));
          await trackMoneyFromPlayer(game.id, ins.to_player_id, ins.amount, isRent);
          
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

      // Prevent negative balances: ensure actor has enough funds for the total owed
      if ((actor.balance || 0) < total) {
        throw new Error('Insufficient funds');
      }

      // Decrement actor balance
      await supabase
        .from('players')
        .update({ balance: (actor.balance || 0) - total })
        .eq('id', actor_player_id);
      
      // Track money spent by actor
      if (total > 0) {
        // Determine if payment is to players or bank
        const hasPlayerRecipients = meData.some((me: any) => me.to_player_id);
        const isTax = (opts.type === 'tax' || opts.mode === 'tax');
        const isRent = (opts.type === 'rent' || opts.description?.toLowerCase().includes('rent'));
        
        if (hasPlayerRecipients) {
          await trackMoneyToPlayer(game.id, actor_player_id, total, isRent);
        } else {
          await trackMoneyToBank(game.id, actor_player_id, total, isTax);
        }
      }

      // Handle free parking
      if (freeParkingFlag) {
        await supabase
          .from('games')
          .update({ free_parking_balance: (game.free_parking_balance || 0) + total })
          .eq('id', game.id);
      }

      // If a note was included on player-to-player payments, also log it into chat history.
      // This makes payment notes visible in the Messages page later.
      if (opts?.description) {
        const note = String(opts.description || '').trim();
        if (note) {
          const actorName = actor?.name || 'Unknown';
          const playerTransfers = (meData || []).filter((me: any) => !!me?.to_player_id && (me?.amount || 0) > 0);
          for (const tr of playerTransfers) {
            try {
              const toId = String(tr.to_player_id);
              const ids = [String(actor_player_id), toId].sort();

              // Find an existing direct chat (both members).
              let chatId: string | null = null;
              const { data: m1, error: m1e } = await supabase
                .from('drunkopoly_chat_members')
                .select('chat_id')
                .eq('player_id', ids[0]);
              if (m1e) throw m1e;
              const cand = Array.from(new Set((m1 || []).map((r: any) => r.chat_id)));
              if (cand.length > 0) {
                const { data: m2, error: m2e } = await supabase
                  .from('drunkopoly_chat_members')
                  .select('chat_id')
                  .in('chat_id', cand)
                  .eq('player_id', ids[1]);
                if (m2e) throw m2e;
                const found = (m2 || [])[0]?.chat_id;
                if (found) {
                  const { data: cr, error: ce } = await supabase
                    .from('drunkopoly_chats')
                    .select('id, game_id')
                    .eq('id', found)
                    .limit(1)
                    .single();
                  if (!ce && cr?.game_id === game.id) chatId = found;
                }
              }

              if (!chatId) {
                const { data: chatCreated, error: cErr } = await supabase
                  .from('drunkopoly_chats')
                  .insert([{ game_id: game.id, title: null, created_by_player_id: actor_player_id }])
                  .select()
                  .limit(1)
                  .single();
                if (cErr) throw cErr;
                chatId = chatCreated.id;
                await supabase.from('drunkopoly_chat_members').insert([
                  { chat_id: chatId, player_id: actor_player_id, last_read_at: new Date().toISOString() },
                  { chat_id: chatId, player_id: toId, last_read_at: null },
                ]);
              }

              await supabase.from('drunkopoly_chat_messages').insert([{
                chat_id: chatId,
                game_id: game.id,
                sender_player_id: actor_player_id,
                body: note,
                kind: 'payment',
                meta: { amount: tr.amount ?? null, from: actor_player_id, to: toId, actor_name: actorName },
              }]);
            } catch (logErr) {
              console.warn('Failed to log payment note to chat history', logErr);
            }
          }
        }
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
        
        // Track money from bank
        await trackMoneyFromBank(game.id, actor_player_id, amount);
      } else if (opts.type === 'pass_go') {
        const base = Number(game.pass_go_amount || 200);
        const doubled = !!opts.doubled;
        amount = doubled ? base * 2 : base;
        if (opts.gamblingWon) amount *= (opts.gamblingMultiplier ?? 2);
        if (opts.gamblingLost) {
          return { ok: true, money_event: null, new_balance: player.balance || 0 };
        }

        const { data: meData, error: meErr } = await supabase
          .from('money_events')
          .insert([{
            game_id: game.id,
            actor_player_id,
            from_player_id: null,
            to_player_id: actor_player_id,
            amount,
            type: 'go',
            description: opts.gamblingWon ? 'Gambled Pass Go and won' : (opts.description || null)
          }])
          .select()
          .single();

        if (meErr) throw meErr;
        meRow = meData;

        // Track money from passing Go
        await trackMoneyFromGo(game.id, actor_player_id, amount);
      } else if (opts.type === 'free_parking') {
        const pot = Number(game.free_parking_balance || 0);

        if (opts.gamblingLost) {
          await supabase.from('games').update({ free_parking_balance: 0 }).eq('id', game.id);
          return { ok: true, money_event: null, new_balance: player.balance || 0 };
        }

        if (pot <= 0) throw new Error('Free parking pot is empty');
        amount = opts.gamblingWon ? pot * (opts.gamblingMultiplier ?? 2) : pot;

        const { data: meData, error: meErr } = await supabase
          .from('money_events')
          .insert([{
            game_id: game.id,
            actor_player_id,
            from_player_id: null,
            to_player_id: actor_player_id,
            amount,
            type: 'free_parking_collect',
            description: opts.gamblingWon ? 'Gambled Free Parking and won' : (opts.description || null)
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

        // Track money from free parking
        await trackMoneyFromFreeParking(game.id, actor_player_id, amount);
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

  // Shared collect handler used by the main CollectPopup and the lock overlays
  const handleCollect = async (opts: any): Promise<void> => {
    if (!game || !player) return;
    // Fire orbital animation before the balance change lands
    const collectType: TransactionType =
      collectMode === 'pass_go' ? 'pass_go' :
      collectMode === 'free_parking' ? 'free_parking' :
      'bank';
    directAnimationFiredRef.current = true;
    txMetaKeyRef.current++;
    setTransactionMeta({ type: collectType, direction: 'in', key: txMetaKeyRef.current });
    try {
      await collectMoney(game.code, player.id, opts);
      // Refresh state
      const players = await fetchPlayers(game.code);
      setPlayersList(players);
      // Find updated player robustly (handle number/string id mismatch)
      const updatedPlayer = players.find((p: any) => String(p.id) === String(player.id));
      if (updatedPlayer) setPlayer(updatedPlayer);
      const { data: gameData } = await supabase.from('games').select('*').eq('code', game.code).single();
      if (gameData) setGame(gameData);
      // Update any derived UI state (free parking pot)
      try {
        setFreeParkingPot(Number((gameData && gameData.free_parking_balance) || 0));
      } catch (e) {}
    } catch (err: any) {
      console.error('Collect error:', err);
      alert(err.message || 'Failed to collect');
      throw err;
    }
  };

  // Open the roulette popup when a player chooses to gamble from CollectPopup
  const handleGamble = (amount: number, doubled: boolean) => {
    if (!collectMode || (collectMode !== 'pass_go' && collectMode !== 'free_parking')) return;
    setRouletteAmount(amount);
    setRouletteMode(collectMode);
    setRouletteDoubled(doubled);
    setRouletteOpen(true);
  };

  // Broadcast the spin to all other players so they can spectate
  const handleRouletteSpin = (data: RouletteSpinBroadcast) => {
    if (!player) return;
    const payload: RouletteSpinBroadcast = {
      ...data,
      spinnerPlayerId: String(player.id),
      spinnerName: player.name || 'Someone',
      spinnerAvatar: (player as any).avatar_url ?? null,
    };
    try {
      realtimeChannelRef.current?.send({ type: 'broadcast', event: 'roulette_spin', payload });
    } catch (e) {
      console.warn('Failed to broadcast roulette spin', e);
    }
  };

  // Called when the roulette spin resolves
  const handleRouletteResult = async (won: boolean, multiplier: number) => {
    if (!rouletteMode || !game || !player) return;

    const modeLabel = rouletteMode === 'pass_go' ? 'Pass Go' : 'Free Parking';
    const winAmount = rouletteAmount * multiplier;
    const description = won
      ? `${player.name} gambled on ${modeLabel} and won $${winAmount.toLocaleString()}`
      : `${player.name} gambled on ${modeLabel} and lost`;

    try {
      await supabase.from('money_events').insert([{
        game_id: game.id,
        actor_player_id: player.id,
        to_player_id: player.id,
        amount: won ? winAmount : 0,
        type: 'gamble',
        description,
      }]);
    } catch (e) {
      console.warn('Failed to log gamble event', e);
    }

    try {
      if (won) {
        await handleCollect({ type: rouletteMode, doubled: rouletteDoubled, gamblingWon: true, gamblingMultiplier: multiplier });
      } else if (rouletteMode === 'free_parking') {
        await handleCollect({ type: 'free_parking', gamblingLost: true });
      }
    } catch (err: any) {
      console.error('Roulette collect error', err);
    }
    setRouletteMode(null);
  };

  // Handle bankruptcy - send all money to another player and enter ghost mode
  const handleBankrupt = async (recipientId: string | null): Promise<void> => {
    if (!game || !player) return;
    try {
      const currentBalance = player.balance ?? 0;
      const toBank = recipientId === null;

      // Transfer all money to recipient (or return to bank — no processPayments needed, balance just zeroed)
      if (currentBalance > 0 && !toBank) {
        await processPayments(game.code, player.id, [{ to: recipientId, amount: currentBalance }], {
          mode: 'players',
          description: `${player.name} declared bankruptcy`
        });
      }

      // Transfer or clear properties
      try {
        const { data: ownedProps, error: ownedErr } = await supabase
          .from('property_ownership')
          .select('*')
          .eq('game_id', game.id)
          .eq('player_id', player.id);

        if (ownedErr) throw ownedErr;

        if (ownedProps && ownedProps.length) {
          for (const p of ownedProps) {
            try {
              if (toBank) {
                // Return properties to bank — delete ownership record so they become unowned
                await supabase.from('property_ownership').delete().eq('id', p.id);
              } else {
                await supabase
                  .from('property_ownership')
                  .update({ player_id: recipientId, houses: 0, updated_at: new Date().toISOString() })
                  .eq('id', p.id);
              }
            } catch (uErr) {
              console.warn('Failed to transfer property', p.id, uErr);
            }
          }
        }
      } catch (propErr) {
        console.warn('Property transfer during bankruptcy failed:', propErr);
      }

      // Mark player as bankrupt
      await supabase
        .from('players')
        .update({
          is_bankrupt: true,
          bankrupt_at: new Date().toISOString(),
          balance: 0
        })
        .eq('id', player.id);

      // Log bankruptcy event
      try {
        const recipient = recipientId ? playersList.find((p: any) => p.id === recipientId) : null;
        await supabase.from('money_events').insert([{
          game_id: game.id,
          actor_player_id: player.id,
          from_player_id: player.id,
          to_player_id: recipientId,
          amount: 0,
          type: 'bankruptcy',
          description: toBank
            ? `${player.name} declared bankruptcy and returned $${currentBalance.toLocaleString()} to the bank`
            : `${player.name} declared bankruptcy and sent $${currentBalance.toLocaleString()} to ${recipient?.name ?? 'another player'}`,
        }]);
      } catch (logErr) {
        console.warn('Failed to log bankruptcy', logErr);
      }

      // Record loss for the bankrupt user's account
      if (currentUser?.id) {
        try {
          await supabase
            .from('drunk_users')
            .update({ losses: (currentUser.losses ?? 0) + 1 })
            .eq('id', currentUser.id);
          persistAuthUser({ ...currentUser, losses: (currentUser.losses ?? 0) + 1 });
        } catch (lossErr) {
          console.warn('Failed to record loss', lossErr);
        }
      }

      // Refresh state
      const players = await fetchPlayers(game.code);
      setPlayersList(players);
      const updatedPlayer = players.find((p: any) => String(p.id) === String(player.id));
      if (updatedPlayer) setPlayer(updatedPlayer);

      try {
        toast({
          title: 'Bankruptcy Declared',
          description: 'You are now in ghost mode. You can spectate but cannot participate in payments.'
        });
      } catch (e) {
        // ignore toast errors
      }
    } catch (err: any) {
      console.error('Bankruptcy error:', err);
      try {
        toast({ 
          title: 'Bankruptcy failed', 
          description: err?.message || 'Failed to declare bankruptcy' 
        });
      } catch (e) {
        alert(err?.message || 'Failed to declare bankruptcy');
      }
      throw err;
    }
  };

  // Detect when the current player is the last one standing and show win screen
  useEffect(() => {
    if (!player || player.is_bankrupt || !playersList || playersList.length < 2) return;
    const nonBankrupt = playersList.filter((p: any) => !p.is_bankrupt);
    const anyBankrupt = playersList.some((p: any) => p.is_bankrupt);
    if (nonBankrupt.length === 1 && String(nonBankrupt[0].id) === String(player.id) && anyBankrupt) {
      setGameWon(true);
    }
  }, [playersList, player?.id, player?.is_bankrupt]);

  // Record win on the winner's own client when they are the last one standing
  const winRecordedRef = useRef(false);
  useEffect(() => {
    if (!gameWon || !currentUser?.id || winRecordedRef.current) return;
    winRecordedRef.current = true;
    (async () => {
      try {
        const { data: userData } = await supabase
          .from('drunk_users')
          .select('wins')
          .eq('id', currentUser.id)
          .single();
        if (userData) {
          await supabase
            .from('drunk_users')
            .update({ wins: (userData.wins ?? 0) + 1 })
            .eq('id', currentUser.id);
          persistAuthUser({ ...currentUser, wins: (currentUser.wins ?? 0) + 1 });
        }
      } catch (winErr) {
        console.warn('Failed to record win', winErr);
      }
    })();
  }, [gameWon, currentUser?.id]);

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

      // Prevent bankrupt (ghost) players from assigning sips to themselves
      try {
        const { data: actorRows, error: aErr } = await supabase
          .from('players')
          .select('*')
          .eq('id', actor_player_id)
          .eq('game_id', game.id)
          .limit(1);
        if (aErr) throw aErr;
        const actorRow = actorRows && actorRows.length ? actorRows[0] : null;
        if (actorRow && actorRow.is_bankrupt && String(actor_player_id) === String(to_player_id)) {
          throw new Error('Bankrupt players cannot assign sips to themselves');
        }
      } catch (checkErr) {
        // If the check failed because actor not found or is bankrupt-self, rethrow
        if ((checkErr as any)?.message) throw checkErr;
      }

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

  // Complete a single sip batch — clears the oldest pending sip_event for this player
  // so pending_sips drops in real-time as the player drinks each round
  const completeSipBatch = async (code: string, actor_player_id: string) => {
    try {
      const { data: games, error: gErr } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .limit(1);
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      const game = games[0];

      // Find the oldest pending sip_event for this player
      const { data: events, error: eErr } = await supabase
        .from('sip_events')
        .select('*')
        .eq('game_id', game.id)
        .eq('to_player_id', actor_player_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);
      if (eErr) throw eErr;
      if (!events || events.length === 0) return { ok: true, cleared: 0 };

      const event = events[0];
      const sipCount = Number(event.sip_count || 0);

      // Mark this event as cleared
      await supabase
        .from('sip_events')
        .update({ status: 'cleared', cleared_at: new Date().toISOString() })
        .eq('id', event.id);

      // Decrement pending_sips, increment total_sips
      const { data: pRows, error: pErr } = await supabase
        .from('players')
        .select('pending_sips,total_sips,name')
        .eq('id', actor_player_id)
        .eq('game_id', game.id)
        .limit(1);
      if (pErr) throw pErr;
      if (!pRows || pRows.length === 0) throw new Error('Player not found');

      const playerRow = pRows[0];
      const newPending = Math.max(0, (playerRow.pending_sips || 0) - sipCount);
      const newTotal = (playerRow.total_sips || 0) + sipCount;

      await supabase
        .from('players')
        .update({ pending_sips: newPending, total_sips: newTotal })
        .eq('id', actor_player_id);

      try {
        await supabase.from('money_events').insert([{
          game_id: game.id,
          actor_player_id,
          from_player_id: null,
          to_player_id: actor_player_id,
          amount: 0,
          type: 'sip_completed',
          description: `${playerRow.name || actor_player_id} completed ${sipCount} sip${sipCount !== 1 ? 's' : ''}`,
        }]);
      } catch (logErr) {
        console.warn('Failed to log sip batch completion', logErr);
      }

      return { ok: true, cleared: sipCount, new_pending: newPending, new_total: newTotal };
    } catch (err) {
      console.error('Complete sip batch error:', err);
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

  // Toggle show balances (only commissioner)
  const toggleShowBalances = async (enabled: boolean) => {
    if (!game || !player) return;
    if (!hasCommissionerAccess()) {
      try { toast({ title: 'Not allowed', description: 'Only the commissioner can change game settings.' }); } catch {}
      return;
    }
    try {
      const { data: updatedGames, error } = await supabase
        .from('games')
        .update({ show_balances: enabled, updated_at: new Date().toISOString() })
        .eq('id', game.id)
        .select()
        .limit(1);
      if (error) throw error;
      if (updatedGames && updatedGames.length > 0) setGame(updatedGames[0]);
      try { toast({ title: 'Updated', description: `Show player balances ${enabled ? 'enabled' : 'disabled'}.` }); } catch {}
    } catch (err: any) {
      console.error('Toggle show balances failed', err);
      try { toast({ title: 'Failed', description: err?.message || 'Unable to update setting' }); } catch {}
    }
  };

  // Toggle sips enabled (only commissioner)
  const toggleSipsEnabled = async (enabled: boolean) => {
    if (!game || !player) return;
    if (!hasCommissionerAccess()) {
      try { toast({ title: 'Not allowed', description: 'Only the commissioner can change game settings.' }); } catch {}
      return;
    }
    try {
      const { data: updatedGames, error } = await supabase
        .from('games')
        .update({ sips_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', game.id)
        .select()
        .limit(1);
      if (error) throw error;
      if (updatedGames && updatedGames.length > 0) setGame(updatedGames[0]);
      try { toast({ title: 'Updated', description: `Sips ${enabled ? 'enabled' : 'disabled'}.` }); } catch {}
    } catch (err: any) {
      console.error('Toggle sips failed', err);
      try { toast({ title: 'Failed', description: err?.message || 'Unable to update setting' }); } catch {}
    }
  };

  // Toggle expansion pack (only commissioner)
  const toggleExpansionEnabled = async (enabled: boolean) => {
    if (!game || !player) return;
    if (!hasCommissionerAccess()) {
      try { toast({ title: 'Not allowed', description: 'Only the commissioner can change game settings.' }); } catch {}
      return;
    }
    try {
      const { data: updatedGames, error } = await supabase
        .from('games')
        .update({ expansion_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', game.id)
        .select()
        .limit(1);
      if (error) throw error;
      if (updatedGames && updatedGames.length > 0) setGame(updatedGames[0]);
      try { toast({ title: 'Updated', description: `Expansion Pack ${enabled ? 'enabled' : 'disabled'}.` }); } catch {}
    } catch (err: any) {
      console.error('Toggle expansion failed', err);
      try { toast({ title: 'Failed', description: err?.message || 'Unable to update setting' }); } catch {}
    }
  };

  // Toggle gambling (only commissioner)
  const toggleGamblingEnabled = async (enabled: boolean) => {
    if (!game || !player) return;
    if (!hasCommissionerAccess()) {
      try { toast({ title: 'Not allowed', description: 'Only the commissioner can change game settings.' }); } catch {}
      return;
    }
    try {
      const { data: updatedGames, error } = await supabase
        .from('games')
        .update({ gambling_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', game.id)
        .select()
        .limit(1);
      if (error) throw error;
      if (updatedGames && updatedGames.length > 0) setGame(updatedGames[0]);
      try { toast({ title: 'Updated', description: `Gambling ${enabled ? 'enabled' : 'disabled'}.` }); } catch {}
    } catch (err: any) {
      console.error('Toggle gambling failed', err);
      try { toast({ title: 'Failed', description: err?.message || 'Unable to update setting' }); } catch {}
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

      // Track going to jail
      await trackWentToJail(game.id, targetPlayerId);

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
    // Prevent paying to get out if player doesn't have enough money
    if ((player.balance || 0) < 50) {
      try {
        toast({ title: 'Insufficient funds', description: "You don't have $50 to pay to get out of jail.", variant: 'destructive' });
      } catch (e) {
        // fallback
        alert('Insufficient funds to pay $50 to get out of jail');
      }
      setInsufficientFundsFlash(true);
      window.setTimeout(() => setInsufficientFundsFlash(false), 900);
      return;
    }
    setPayProcessing(true);
    // Fire jail payment orbital animation
    txMetaKeyRef.current++;
    setTransactionMeta({ type: 'jail', direction: 'out', key: txMetaKeyRef.current });
    try {
      // Deduct $50 from the jailed player and send it to Free Parking
      await processPayments(game.code, player.id, [{ to: null, amount: 50 }], { type: 'jail_payment', freeParking: true });
      
      // Track jail payment
      await trackJailPayment(game.id, player.id, 50);

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
            const restoreUpdate: any = { is_online: true, last_seen_at: new Date().toISOString() };
            if (currentUser?.avatar_url) restoreUpdate.avatar_url = currentUser.avatar_url;
            await supabase.from('players').update(restoreUpdate).eq('id', player.id);
            if (currentUser?.avatar_url) player = { ...player, avatar_url: currentUser.avatar_url };
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
            const { data: allPlayers } = await supabase
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
                avatar_url: currentUser?.avatar_url || null,
              }])
              .select()
              .single();

            if (newErr) throw newErr;
            player = newPlayer;

            // Initialize player statistics
            await initializePlayerStats(game.id, player.id);

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
        const [players, gameData, sipEvData] = await Promise.all([
          fetchPlayers(game.code),
          supabase.from('games').select('*').eq('code', game.code).limit(1).single(),
          supabase.from('sip_events').select('id,sip_count').eq('game_id', game.id).eq('to_player_id', player.id).eq('status', 'pending').order('created_at', { ascending: true }),
        ]);

        if (sipEvData.data) setPendingSipEvents(sipEvData.data);
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
                      if (soundEnabled) {
                        try {
                          const a = new Audio('/message.mp3');
                          const p = a.play();
                          if (p && typeof p.then === 'function') p.catch(() => {});
                        } catch (e) { /* ignore audio errors */ }
                      }
                    } else {
                      toast({ title: 'New message', description: md || 'You have a new message.' });
                      if (soundEnabled) {
                        try {
                          const a = new Audio('/message.mp3');
                          const p = a.play();
                          if (p && typeof p.then === 'function') p.catch(() => {});
                        } catch (e) { /* ignore audio errors */ }
                      }
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
            // Detect incoming payment and fire orbital animation.
            // This polling path serves as a reliable fallback for when the Supabase Realtime
            // subscription fires late or misses an event entirely.
            // prevBalanceRef is shared with the subscription so only one of the two paths fires.
            {
              const prevBal = prevBalanceRef.current ?? (player?.balance ?? 0);
              const newBal = Number(updatedPlayer.balance ?? 0);
              if (newBal > prevBal) {
                if (directAnimationFiredRef.current) {
                  // A direct action (collect, etc.) already fired the animation — consume the flag
                  directAnimationFiredRef.current = false;
                } else {
                  // Money arrived from another player — look up who paid us to show their avatar
                  let payerEntities: OrbitalEntity[] | undefined;
                  try {
                    const { data: recentPayment } = await supabase
                      .from('money_events')
                      .select('from_player_id')
                      .eq('game_id', gameData.data?.id ?? game?.id)
                      .eq('to_player_id', updatedPlayer.id)
                      .not('from_player_id', 'is', null)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single();
                    if (recentPayment?.from_player_id) {
                      const payer = players.find((p: any) => String(p.id) === String(recentPayment.from_player_id));
                      if (payer) payerEntities = [payer];
                    }
                  } catch {
                    // ignore — fall back to generic coins
                  }
                  txMetaKeyRef.current++;
                  setTransactionMeta({ type: 'player', direction: 'in', entities: payerEntities, key: txMetaKeyRef.current });
                }
              }
              prevBalanceRef.current = newBal;
            }
          } else {
            // Current player no longer exists in players list — they were removed
            try {
              setRemovedNoticeMsg('You were removed from the game.');
              setRemovedNoticeOpen(true);
            } catch (e) {
              console.warn('Failed to show removed notice', e);
            }
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

  // Poll unread chat count so we can show a badge in the header.
  useEffect(() => {
    if (screen !== 'home' || !game?.id || !player?.id) return;
    let stopped = false;
    let timer: number | null = null;

    const fetchUnread = async () => {
      try {
        const { data: memRows, error: memErr } = await supabase
          .from('drunkopoly_chat_members')
          .select('chat_id,last_read_at,player_id')
          .eq('player_id', player.id);
        if (memErr) throw memErr;

        const rows = (memRows || []) as any[];
        if (rows.length === 0) {
          setUnreadMessageCount(0);
          return;
        }

        let total = 0;
        for (const r of rows) {
          const since = r.last_read_at || '1970-01-01T00:00:00.000Z';
          const { count, error: cErr } = await supabase
            .from('drunkopoly_chat_messages')
            .select('id', { count: 'exact', head: true })
            .eq('chat_id', r.chat_id)
            .gt('created_at', since)
            .neq('sender_player_id', player.id);
          if (cErr) throw cErr;
          total += (count || 0);
        }

        setUnreadMessageCount(total);
      } catch (e) {
        // If messaging tables aren't deployed yet, keep badge at 0 without spamming logs.
        setUnreadMessageCount(0);
      }
    };

    const scheduleNext = () => {
      if (stopped) return;
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const delay = hidden ? 8000 : 3000;
      timer = window.setTimeout(async () => {
        await fetchUnread();
        scheduleNext();
      }, delay);
    };

    fetchUnread();
    scheduleNext();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnread();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [screen, game?.id, player?.id]);

  // Realtime subscription: update `game` and `playersList` when rows change so everyone sees
  // the trade lock overlay immediately when someone starts the timer.
  useEffect(() => {
    if (screen !== 'home' || !game) return;
    const gameId = game.id;
    let channel: any = null;
    try {
      channel = supabase
        .channel(`public-games-${gameId}`)
        .on('broadcast', { event: 'roulette_spin' }, (msg: any) => {
          const data: RouletteSpinBroadcast = msg.payload;
          // Only show spectator view to players who are NOT the spinner
          if (data.spinnerPlayerId && player && String(data.spinnerPlayerId) === String(player.id)) return;
          setSpectatorData(data);
          setSpectatorOpen(true);
        })
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
            if (updatedPlayer) {
              // Detect balance changes caused by another player paying us
              const prevBal = prevBalanceRef.current ?? (player?.balance ?? 0);
              const newBal = Number(updatedPlayer.balance ?? 0);
              if (newBal > prevBal) {
                if (directAnimationFiredRef.current) {
                  // A direct collect action already fired the animation — consume the flag
                  directAnimationFiredRef.current = false;
                } else {
                  // Money arrived from another player — look up who paid us so we can show their avatar
                  let payerEntities: OrbitalEntity[] | undefined;
                  try {
                    const { data: recentPayment } = await supabase
                      .from('money_events')
                      .select('from_player_id')
                      .eq('game_id', gameId)
                      .eq('to_player_id', player!.id)
                      .not('from_player_id', 'is', null)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .single();
                    if (recentPayment?.from_player_id) {
                      const payer = players.find((p: any) => String(p.id) === String(recentPayment.from_player_id));
                      if (payer) payerEntities = [payer];
                    }
                  } catch {
                    // ignore — fall back to generic coins
                  }
                  txMetaKeyRef.current++;
                  setTransactionMeta({ type: 'player', direction: 'in', entities: payerEntities, key: txMetaKeyRef.current });
                }
              }
              // Don't animate decreases here — direct pay actions already handle those
              prevBalanceRef.current = newBal;
              setPlayer(updatedPlayer);
            }
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
      realtimeChannelRef.current = channel;
    } catch (e) {
      console.warn('Supabase realtime subscribe failed', e);
    }

    return () => {
      realtimeChannelRef.current = null;
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
      if (!hasCommissionerAccess()) {
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
            // Clear or remove any sip_events referencing this player so foreign keys
            // don't block deletion. `from_player_id` is nullable so set it to null; 
            // `to_player_id` is NOT NULL so delete those sip_events.
            try {
              await supabase.from('sip_events').update({ from_player_id: null }).eq('from_player_id', id).eq('game_id', game.id);
            } catch (sErr) {
              console.warn('Failed to null sip_events.from_player_id for removed player', sErr);
            }
            try {
              await supabase.from('sip_events').delete().eq('to_player_id', id).eq('game_id', game.id);
            } catch (sErr) {
              console.warn('Failed to delete sip_events.to_player_id for removed player', sErr);
            }

            // Null any player references in money_events (nullable columns)
            await supabase.from('money_events').update({ actor_player_id: null }).eq('actor_player_id', id).eq('game_id', game.id);
            await supabase.from('money_events').update({ from_player_id: null }).eq('from_player_id', id).eq('game_id', game.id);
            await supabase.from('money_events').update({ to_player_id: null }).eq('to_player_id', id).eq('game_id', game.id);

            // Retry deletion of player
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
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <CardTitle className="text-3xl">Drunkopoly</CardTitle>
                <CardDescription className="mt-1">
                  Join an existing game or create a new one to get started.
                </CardDescription>
              </div>
              <button
                type="button"
                aria-label={currentUser ? 'View profile' : 'Sign in'}
                onClick={() => {
                  if (currentUser) {
                    setProfileFirstName(currentUser.first_name || '');
                    setProfileLastName(currentUser.last_name || '');
                    setProfileAvatarFile(null);
                    setProfileAvatarPreview(null);
                    setScreen('profile');
                  } else {
                    setStandaloneAuthMode('signin');
                    setAuthUsername('');
                    setAuthPassword('');
                    setScreen('auth');
                  }
                }}
                className="shrink-0 mt-0.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {currentUser ? (
                  <PlayerAvatar player={currentUser} size="md" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors">
                    <Users className="w-4 h-4" />
                  </div>
                )}
              </button>
            </div>
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

  // Auth screen — standalone sign-in / sign-up for users who aren't logged in
  if (screen === 'auth') {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2">
              <Button variant="ghost" size="sm" className="px-0" onClick={() => setScreen('join-create')} aria-label="Back">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex border-b border-border mb-4 pt-1">
              <button
                type="button"
                className={`flex-1 pb-3 text-sm font-medium transition-colors ${standaloneAuthMode === 'signin' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setStandaloneAuthMode('signin')}
              >Sign In</button>
              <button
                type="button"
                className={`flex-1 pb-3 text-sm font-medium transition-colors ${standaloneAuthMode === 'signup' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setStandaloneAuthMode('signup')}
              >Create Account</button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {standaloneAuthMode === 'signin' ? (
                <>
                  <Input placeholder="Username" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} autoFocus />
                  <Input placeholder="Password" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                  <Button
                    className="w-full"
                    disabled={loading || !authUsername || !authPassword}
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        const u = await signInUser();
                        setAuthUsername('');
                        setAuthPassword('');
                        toast({ title: 'Signed in', description: `Welcome back, ${u.first_name || u.username}!` });
                        setScreen('join-create');
                      } catch (e: any) {
                        setError(e.message || 'Sign in failed');
                      } finally { setLoading(false); }
                    }}
                  >{loading ? 'Please wait…' : 'Sign In'}</Button>
                  {error && <div className="text-destructive text-sm">{error}</div>}
                  <div className="text-center text-sm text-muted-foreground pt-1">
                    No account?{' '}
                    <button type="button" className="text-primary underline" onClick={() => { setError(null); setStandaloneAuthMode('signup'); }}>
                      Create one
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Input placeholder="Username" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} autoFocus />
                  <Input placeholder="Password" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                  <Input placeholder="First name" value={authFirstName} onChange={(e) => setAuthFirstName(e.target.value)} />
                  <Input placeholder="Last name (optional)" value={authLastName} onChange={(e) => setAuthLastName(e.target.value)} />
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Profile picture (optional)</label>
                    <div className="flex items-center gap-3">
                      {authAvatarPreview && (
                        <img src={authAvatarPreview} alt="Preview" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        className="text-sm"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;
                          setAuthAvatarFile(f);
                          setAuthAvatarPreview(f ? URL.createObjectURL(f) : null);
                        }}
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={loading || !authUsername || !authPassword || !authFirstName}
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        const u = await signUpUser();
                        setAuthUsername(''); setAuthPassword(''); setAuthFirstName(''); setAuthLastName('');
                        setAuthAvatarFile(null); setAuthAvatarPreview(null);
                        setAccountMode('none');
                        toast({ title: 'Account created', description: `Welcome, ${u.first_name || u.username}!` });
                        setScreen('join-create');
                      } catch (e: any) {
                        setError(e.message || 'Sign up failed');
                      } finally { setLoading(false); }
                    }}
                  >{loading ? 'Please wait…' : 'Create Account'}</Button>
                  {error && <div className="text-destructive text-sm">{error}</div>}
                  <div className="text-center text-sm text-muted-foreground pt-1">
                    Already have an account?{' '}
                    <button type="button" className="text-primary underline" onClick={() => { setError(null); setStandaloneAuthMode('signin'); }}>
                      Sign in
                    </button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Profile screen — manage name, avatar, view stats
  if (screen === 'profile' && currentUser) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2">
              <Button variant="ghost" size="sm" className="px-0" onClick={() => setScreen('join-create')} aria-label="Back">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <CardTitle className="text-2xl">Profile</CardTitle>
            <CardDescription>Manage your account details.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                {profileAvatarPreview ? (
                  <img src={profileAvatarPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <PlayerAvatar player={{ name: currentUser.first_name || currentUser.username, avatar_url: currentUser.avatar_url }} size="xl" />
                )}
                <label className="cursor-pointer text-sm text-primary underline">
                  Change photo
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setProfileAvatarFile(f);
                      setProfileAvatarPreview(f ? URL.createObjectURL(f) : null);
                    }}
                  />
                </label>
              </div>

              {/* Read-only username */}
              <div className="mb-4">
                <label className="text-xs text-muted-foreground block mb-1">Username</label>
                <div className="px-3 py-2 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground select-all">
                  {currentUser.username}
                </div>
              </div>

              {/* Editable name fields */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">First name</label>
                  <Input value={profileFirstName} onChange={(e) => setProfileFirstName(e.target.value)} placeholder="First name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Last name</label>
                  <Input value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 p-4 rounded-lg bg-muted/40 border border-border mb-6">
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-primary">{currentUser.wins ?? 0}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Wins</div>
                </div>
                <div className="w-px bg-border" />
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold">{currentUser.losses ?? 0}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Losses</div>
                </div>
                <div className="w-px bg-border" />
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold">
                    {(currentUser.wins ?? 0) + (currentUser.losses ?? 0) > 0
                      ? Math.round(((currentUser.wins ?? 0) / ((currentUser.wins ?? 0) + (currentUser.losses ?? 0))) * 100)
                      : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Win rate</div>
                </div>
              </div>

              {/* Save */}
              <Button
                className="w-full mt-6"
                disabled={profileSaving}
                onClick={async () => {
                  setProfileSaving(true);
                  try {
                    await updateUserProfile({ firstName: profileFirstName, lastName: profileLastName, avatarFile: profileAvatarFile });
                    setProfileAvatarFile(null);
                    setProfileAvatarPreview(null);
                    toast({ title: 'Profile updated' });
                  } catch (e: any) {
                    toast({ title: 'Save failed', description: e.message || 'Unable to save', variant: 'destructive' });
                  } finally { setProfileSaving(false); }
                }}
              >{profileSaving ? 'Saving…' : 'Save Changes'}</Button>

              {/* Sign out */}
              <Button
                variant="ghost"
                className="w-full mt-3 text-destructive hover:text-destructive"
                onClick={() => {
                  persistAuthUser(null);
                  toast({ title: 'Signed out' });
                  setScreen('join-create');
                }}
              >Sign Out</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: Enter Name
  if (screen === 'select-existing-player' && recentPlayers) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center px-4">
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
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-start justify-between w-full">
              <div>
                <div className="mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-0"
                    onClick={() => {
                      // If user is in sign-in/signup mode, treat Back as closing that mode.
                      if (accountMode === 'signin' || accountMode === 'signup') {
                        setAccountMode('none');
                        return;
                      }
                      // Otherwise go back to join/create screen and clear create mode.
                      setScreen('join-create');
                      setMode(null);
                    }}
                    aria-label="Back to games"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </div>
                <CardTitle className="text-2xl mb-2">
                  {accountMode === 'signin' ? 'Sign In' : accountMode === 'signup' ? 'Create Account' : currentUser ? 'Confirm Your Name' : 'Enter Your Name'}
                </CardTitle>
                <CardDescription>
                  {accountMode === 'signin' ? 'Enter your username and password to sign in.' : accountMode === 'signup' ? 'Create an account to save your profile and stats.' : currentUser ? `Signed in as ${(currentUser.first_name || currentUser.username)} — press Back to change.` : (mode === "create" ? "Create a new game and become the host." : `Joining game: ${gameCode}`)}
                </CardDescription>
              </div>

              {/* avatar intentionally only shown inline in the signed-in banner */}
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const cleaned = (name ?? '').trim();
                if (!cleaned) return;
                // Validate: only letters and spaces, 1-15 chars
                if (!/^[A-Z ]{1,15}$/.test(cleaned)) {
                  setError('Name must be letters and spaces only (max 15 characters)');
                  return;
                }
                setError(null);
                setLoading(true);
                try {
                  if (mode === "create") {
                    // go to confirm settings step before creating the game
                    setLoading(false);
                    setScreen("confirm-settings");
                    return;
                  } else {
                    // Join using helper
                    await joinGameWithName(cleaned);
                  }
                } catch (err: any) {
                  console.error("Join/Create error:", err);
                  setError(err.message || "Unexpected error");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {!(accountMode === 'signin' || accountMode === 'signup' || currentUser) && (
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
              )}
              {/* Signed-in banner: only show when not in signin/signup mode */}
              {currentUser && accountMode === 'none' ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-muted/40 rounded-md mt-3">
                  <PlayerAvatar player={currentUser} size="md" />
                  <div className="flex-1">
                    <div className="font-medium">Signed in as {(currentUser.first_name || currentUser.username)}{currentUser.last_name ? ` ${currentUser.last_name}` : ''}</div>
                    <div className="text-xs text-muted-foreground">{currentUser.username}</div>
                  </div>
                  {/* actions moved below: continue + sign out shown in the main action area */}
                </div>
              ) : (
                <div className="pt-2">
                  <div className="flex flex-col sm:flex-row gap-3 mb-3">
                    {!(accountMode === 'signin' || accountMode === 'signup') && (
                      <>
                        <Button
                          className={`w-full sm:flex-1 justify-center py-2`}
                          variant={'ghost'}
                          onClick={() => setAccountMode('signin')}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Sign In
                        </Button>

                        <Button
                          className={`w-full sm:flex-1 justify-center py-2`}
                          variant={'ghost'}
                          onClick={() => setAccountMode('signup')}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create Account
                        </Button>
                      </>
                    )}
                  </div>

                  {accountMode === 'signin' && (
                    <div className="space-y-2">
                      <Input placeholder="Username" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} />
                      <Input placeholder="Password" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                      <div className="flex gap-2">
                        <Button onClick={async () => {
                          setLoading(true);
                          try {
                            const u = await signInUser();
                            setAccountMode('none');
                            setAuthUsername('');
                            setAuthPassword('');
                            toast({ title: 'Signed in', description: `Welcome back ${u.first_name || u.username}` });
                            const preferred = (u.first_name || u.username || '').toString().toUpperCase();
                            setName(preferred);
                            await joinGameWithName(preferred);
                          } catch (e: any) {
                            toast({ title: 'Sign in failed', description: e.message || 'Unable to sign in' });
                          } finally { setLoading(false); }
                        }}>Sign In & Join</Button>
                      </div>
                      
                    </div>
                  )}

                  {accountMode === 'signup' && (
                    <div className="space-y-2">
                      <Input placeholder="Username" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} />
                      <Input placeholder="Password" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                      <Input placeholder="First name" value={authFirstName} onChange={(e) => setAuthFirstName(e.target.value)} />
                      <Input placeholder="Last name" value={authLastName} onChange={(e) => setAuthLastName(e.target.value)} />
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Profile picture (optional)</label>
                        <div className="flex items-center gap-3">
                          {authAvatarPreview && (
                            <img src={authAvatarPreview} alt="Preview" className="w-10 h-10 rounded-full object-cover shrink-0" />
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            className="text-sm"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setAuthAvatarFile(f);
                              if (f) {
                                const prev = URL.createObjectURL(f);
                                setAuthAvatarPreview(prev);
                              } else {
                                setAuthAvatarPreview(null);
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={async () => {
                          setLoading(true);
                          try {
                            const u = await signUpUser();
                            setAccountMode('none');
                            setAuthUsername('');
                            setAuthPassword('');
                            setAuthFirstName('');
                            setAuthLastName('');
                            setAuthAvatarFile(null);
                            setAuthAvatarPreview(null);
                            toast({ title: 'Account created', description: `Welcome ${u.first_name || u.username}` });
                            const preferred = (u.first_name || u.username || '').toString().toUpperCase();
                            setName(preferred);
                            await joinGameWithName(preferred);
                          } catch (e: any) {
                            toast({ title: 'Create failed', description: e.message || 'Unable to create account' });
                          } finally { setLoading(false); }
                        }}>Create & Join</Button>
                      </div>
                      
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {accountMode === 'none' && (
                  currentUser ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button className="w-full sm:flex-1" type="button" onClick={async () => {
                        const preferred = (currentUser.first_name || currentUser.username || '').toString().toUpperCase();
                        setName(preferred);
                        // If user is creating a new game, go to confirm settings instead of joining
                        if (mode === 'create') {
                          setScreen('confirm-settings');
                          return;
                        }
                        setLoading(true);
                        try {
                          await joinGameWithName(preferred);
                        } catch (e) { console.warn('Join failed', e); }
                        setLoading(false);
                      }}>
                        {loading ? 'Please wait...' : `Continue as ${((currentUser.first_name || currentUser.username)||'You')}`}
                      </Button>
                      <Button variant="ghost" className="w-full sm:w-auto sm:flex-1" onClick={() => { persistAuthUser(null); toast({ title: 'Signed out' }); }}>
                        Sign Out
                      </Button>
                    </div>
                  ) : (
                    <Button className="w-full" type="submit" disabled={!/^[A-Z ]{1,10}$/.test((name||'').trim()) || loading}>
                      {loading ? "Please wait..." : "Continue"}
                    </Button>
                  )
                )}
                {error && accountMode === 'none' && <div className="text-destructive text-sm">{error}</div>}
                {accountMode === 'none' && !(currentUser) && name.length > 10 && (
                  <div className="text-destructive text-sm">Name must be 10 characters or less.</div>
                )}
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
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2">
              <Button variant="ghost" size="sm" className="px-0" onClick={() => { setScreen('enter-name'); }} aria-label="Back to name">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
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
                      sips_enabled: tempSipsEnabled,
                      expansion_enabled: tempExpansionEnabled,
                      gambling_enabled: tempGamblingEnabled,
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

                  // Initialize player statistics
                  await initializePlayerStats(newGame.id, newPlayer.id);

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
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 mt-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">Play With Sips</div>
                    <div className="text-xs text-muted-foreground">Enable sip counters and Give Sips features</div>
                  </div>
                  <Switch
                    checked={tempSipsEnabled}
                    onCheckedChange={(checked) => setTempSipsEnabled(checked)}
                  />
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 mt-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">Expansion Pack</div>
                    <div className="text-xs text-muted-foreground">When enabled, all payments to the bank go into Free Parking</div>
                  </div>
                  <Switch
                    checked={tempExpansionEnabled}
                    onCheckedChange={(checked) => setTempExpansionEnabled(checked)}
                  />
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 mt-2">
                  <div className="flex-1">
                    <div className="font-medium text-sm">Gambling</div>
                    <div className="text-xs text-muted-foreground">Lets players gamble Pass Go or Free Parking on a roulette spin</div>
                  </div>
                  <Switch
                    checked={tempGamblingEnabled}
                    onCheckedChange={(checked) => setTempGamblingEnabled(checked)}
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
    <div className="min-h-screen bg-gradient-bg flex flex-col" style={sipsOverlayOpen ? { paddingBottom: `${110 + Math.min(sipBatches.length - 1, 2) * 10}px` } : undefined}>
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
        <div className="flex items-center gap-2">
            <div
              className="px-3 py-1 rounded-md flex items-center gap-3"
              style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
            >
              <div className="font-semibold text-lg">{player?.name ?? name}</div>
              {(game?.sips_enabled ?? true) && (
                <div
                  className="text-sm opacity-90 cursor-pointer hover:opacity-100 hover:underline"
                  onClick={() => setSipLeaderboardOpen(true)}
                >
                  {(player?.total_sips ?? 0)} sips
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
          {!isNarrow && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/drunk/drunkopoly/rules')}>Rules</Button>
          )}
          {/* Messages moved into the code popover; header icon removed for a cleaner UI */}
          <GameCodePopover
            code={game?.code ?? gameCode}
            onLogout={handleLogoutOfGame}
            players={playersList}
            currentPlayer={player}
            game={game}
            onRemovePlayer={handleRemovePlayer}
            soundEnabled={soundEnabled}
            showRulesInPopover={isNarrow && (game?.sips_enabled ?? true)}
            showBalances={game?.show_balances ?? true}
            onToggleSound={(enabled) => {
              setSoundEnabled(enabled);
              try {
                localStorage.setItem("drunkopoly:soundEnabled", String(enabled));
              } catch (e) {
                // ignore localStorage errors
              }
            }}
            onToggleShowBalances={toggleShowBalances}
            onToggleSipsEnabled={toggleSipsEnabled}
            onToggleExpansion={toggleExpansionEnabled}
            onToggleGambling={toggleGamblingEnabled}
            commPinOpen={commPinOpen}
            setCommPinOpen={setCommPinOpen}
            commToolsOpen={commToolsOpen}
            setCommToolsOpen={setCommToolsOpen}
            commPinValue={commPinValue}
            setCommPinValue={setCommPinValue}
            commUnlocked={commUnlocked}
            openCommissionerTools={openCommissionerTools}
            tryUnlockCommissionerTools={tryUnlockCommissionerTools}
            setCommUnlockedUntil={setCommUnlockedUntil}
            hasCommissionerAccess={hasCommissionerAccess}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        {player?.is_bankrupt ? (
          /* Ghost Mode UI for bankrupt players */
          <>
            <div className="mb-8 text-center">
              <div className="text-2xl font-bold text-muted-foreground mb-4">
                You are bankrupt
              </div>
              <div className="text-sm text-muted-foreground max-w-md">
                You can monitor the game and use actions like trade timers and jail but you cannot participate in payments.
              </div>
            </div>

            {/* Show all players' balances (override show_balances setting for ghosts) */}
            <Section title="Player Balances" className="mt-8">
              <div className="grid grid-cols-1 gap-2 w-64">
                {playersList
                  .filter((p: any) => !p.is_bankrupt)
                  .sort((a: any, b: any) => (b.balance ?? 0) - (a.balance ?? 0))
                  .map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 border rounded bg-card w-full">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-lg font-bold text-primary">${(p.balance ?? 0).toLocaleString()}</div>
                    </div>
                  ))}
              </div>
            </Section>

            {/* Ghost mode can still give sips if enabled */}
            {(game?.sips_enabled ?? true) && (
              <Section title="Sips" className="mt-8">
                <div className="grid grid-cols-1 gap-4 w-64">
                  <Button variant="secondary" className="py-6" onClick={() => setSipModalOpen(true)}>
                    <UserPlus className="h-5 w-5" />
                    Give Sips
                  </Button>
                </div>
              </Section>
            )}

            {/* Ghost mode can still use actions */}
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
                <Button
                  variant="secondary"
                  className="w-full py-6"
                  onClick={() => setPropertiesModalOpen(true)}
                >
                  <Building2 className="h-5 w-5" />
                  Properties
                </Button>
                <Button
                  variant="secondary"
                  className="w-full py-6"
                  onClick={() => setRankingsModalOpen(true)}
                >
                  <Crown className="h-5 w-5" />
                  Rankings
                </Button>
                <Button
                  variant="secondary"
                  className="w-full py-6"
                  onClick={() => setBankruptStatusOpen(true)}
                >
                  <Info className="h-5 w-5" />
                  View Stats
                </Button>
              </div>
            </Section>
            <BankruptStatus
              open={bankruptStatusOpen}
              onOpenChange={setBankruptStatusOpen}
              currentPlayer={player}
              gameId={game?.id}
            />
          </>
        ) : (
          /* Normal UI for active players */
          <>
            <div className="mb-8 flex flex-col items-center">
              <div className="text-muted-foreground text-lg mb-2 text-center">
                Current Balance
              </div>
              <MoneyOrbitals
                transactionMeta={transactionMeta}
              >
                <div className="text-6xl font-extrabold text-primary text-center px-8 py-4">
                  <AnimatedNumber
                    value={player?.balance ?? game?.initial_balance ?? 1500}
                    soundEnabled={soundEnabled}
                    maskIfGameHidden={!((game && game.show_balances) ?? true)}
                    gameCode={game?.code ?? null}
                  />
                </div>
              </MoneyOrbitals>
            </div>

            {/* SIP section (hidden when sips_enabled is false) */}
            {(game?.sips_enabled ?? true) && (
              <Section title="Sips">
                <div className="grid grid-cols-1 gap-4 w-64">
                  <Button variant="secondary" className="py-6" onClick={() => setSipModalOpen(true)}>
                    <UserPlus className="h-5 w-5" />
                    Give Sips
                  </Button>
                </div>
              </Section>
            )}

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
                <Button
                  variant="secondary"
                  className="w-full py-6"
                  onClick={() => setPropertiesModalOpen(true)}
                >
                  <Building2 className="h-5 w-5" />
                  Properties
                </Button>
                <Button
                  variant="secondary"
                  className="w-full py-6"
                  onClick={() => setRankingsModalOpen(true)}
                >
                  <Crown className="h-5 w-5" />
                  Rankings
                </Button>
                {!player?.is_bankrupt && (
                  <Button
                    variant="secondary"
                    className="w-full py-6 border-2 border-red-500 text-foreground shadow-sm"
                    style={{ borderColor: '#ef4444' }}
                    onClick={() => setBankruptModalOpen(true)}
                  >
                    <DollarSign className="h-5 w-5" />
                    Declare Bankruptcy
                  </Button>
                )}
              </div>
            </Section>
          </>
        )}
        
        

        <PayPopup
          open={payModalOpen}
          onOpenChange={(v) => setPayModalOpen(v)}
          mode={payMode}
          currentPlayer={player}
          players={playersList}
          showBalances={game?.show_balances ?? true}
          onSubmit={async (payments, opts) => {
            if (!game || !player) return;
            // Fire orbital animation before the balance update lands
            const payType: TransactionType =
              payMode === 'players' ? 'player' :
              payMode === 'tax' ? 'tax' :
              'bank';
            const payEntities: OrbitalEntity[] = payMode === 'players'
              ? (payments as any[]).map((pmt: any) => playersList.find((pl: any) => String(pl.id) === String(pmt.to))).filter(Boolean)
              : [];
            txMetaKeyRef.current++;
            setTransactionMeta({ type: payType, direction: 'out', entities: payEntities.length ? payEntities : undefined, key: txMetaKeyRef.current });
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
              const msg = err?.message || 'Failed to process payment';
              if (msg && msg.toLowerCase().includes('insufficient')) {
                try {
                  toast({ title: 'Insufficient funds', description: "You don't have enough money to complete this payment.", variant: 'destructive' });
                } catch (e) {
                  alert(msg);
                }
                setInsufficientFundsFlash(true);
                window.setTimeout(() => setInsufficientFundsFlash(false), 900);
              } else {
                try { toast({ title: 'Payment failed', description: msg }); } catch (e) { alert(msg); }
              }
            }
          }}
        />

        {/* Blocked payment message modal */}
        <BlockedPaymentDialog blockedPaymentMessage={blockedPaymentMessage} setBlockedPaymentMessage={setBlockedPaymentMessage} />

        <CollectPopup
          open={collectModalOpen}
          onOpenChange={(v) => setCollectModalOpen(v)}
          mode={collectMode}
          currentPlayer={player}
          game={game}
          onCollect={async (opts) => { await handleCollect(opts); }}
          gamblingEnabled={!!(game?.gambling_enabled)}
          onGamble={handleGamble}
        />

        <RoulettePopup
          open={rouletteOpen}
          onOpenChange={(v) => setRouletteOpen(v)}
          amount={rouletteAmount}
          onResult={async (won, multiplier) => { await handleRouletteResult(won, multiplier); }}
          onSpin={handleRouletteSpin}
        />

        <RouletteSpectatorPopup
          open={spectatorOpen}
          onOpenChange={setSpectatorOpen}
          data={spectatorData}
        />

        <SipPopup
          open={sipModalOpen}
          onOpenChange={(v) => setSipModalOpen(v)}
          currentPlayer={player}
          players={playersList}
          allowSelf={!!(player && !player.is_bankrupt)}
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

        <BankruptPopup
          open={bankruptModalOpen}
          onOpenChange={(v) => setBankruptModalOpen(v)}
          currentPlayer={player}
          players={playersList}
          showBalances={game?.show_balances ?? true}
          onSubmit={handleBankrupt}
          gameId={game?.id}
        />

        <PropertiesPopup
          open={propertiesModalOpen}
          onOpenChange={(v) => setPropertiesModalOpen(v)}
          gameCode={gameCode}
          players={playersList}
        />

        <RankingsPopup
          open={rankingsModalOpen}
          onOpenChange={(v) => setRankingsModalOpen(v)}
          gameCode={gameCode}
          players={playersList}
        />

        <SipLeaderboardPopup
          open={sipLeaderboardOpen}
          onOpenChange={setSipLeaderboardOpen}
          players={playersList}
          currentPlayerId={player?.id}
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
          payInsufficientFlash={insufficientFundsFlash}
          players={playersList}
          showBalances={game?.show_balances ?? true}
          currentPlayerId={player?.id}
          currentPlayer={player}
          allowGiveSips={game?.sips_enabled ?? true}
          onAssignSips={async (to, sip_count) => {
            if (!game || !player) return;
            try {
              if (Array.isArray(to)) {
                for (const t of to) {
                  await assignSips(game.code, player.id, t, sip_count);
                }
              } else {
                await assignSips(game.code, player.id, to, sip_count);
              }
              const players = await fetchPlayers(game.code);
              setPlayersList(players);
              const { data: gameData } = await supabase.from('games').select('*').eq('code', game.code).single();
              if (gameData) setGame(gameData);
            } catch (err: any) {
              console.error('Assign sips error:', err);
              const msg = err?.message || 'Failed to assign sips';
              try { toast({ title: 'Action failed', description: msg }); } catch (e) { alert(msg); }
            }
          }}
          onPaySubmit={async (payments, opts) => {
            if (!game || !player) return;
            try {
              const result = await processPayments(game.code, player.id, payments, { ...(opts || {}), mode: opts?.mode || 'bank' });

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

              // Refresh state
              const players = await fetchPlayers(game.code);
              setPlayersList(players);
              const updatedPlayer = players.find((p: any) => p.id === player.id);
              if (updatedPlayer) setPlayer(updatedPlayer);
              const { data: gameData } = await supabase.from('games').select('*').eq('code', game.code).single();
              if (gameData) setGame(gameData);
            } catch (err: any) {
              console.error('Pay submit error from JailLockOverlay:', err);
              const msg = err?.message || 'Failed to process payment';
              if (msg && msg.toLowerCase().includes('insufficient')) {
                try { toast({ title: 'Insufficient funds', description: "You don't have enough money to complete this payment.", variant: 'destructive' }); } catch (e) { alert(msg); }
                setInsufficientFundsFlash(true);
                window.setTimeout(() => setInsufficientFundsFlash(false), 900);
              } else {
                try { toast({ title: 'Payment failed', description: msg }); } catch (e) { alert(msg); }
              }
            }
          }}
          onOpenCollect={() => { setCollectModalOpen(true); setCollectMode('bank'); }}
          onCollect={handleCollect}
        />

        <TradeLockOverlay
          open={!!game?.trade_locked}
          expiresAt={game?.trade_timer_expires_at}
          startedByName={playersList?.find((p: any) => p.id === game?.trade_started_by)?.name ?? null}
          onDone={() => stopTradeTimer()}
          soundEnabled={soundEnabled}
          currentBalance={player?.balance ?? 0}
          players={playersList}
          showBalances={game?.show_balances ?? true}
          currentPlayerId={player?.id}
          currentPlayer={player}
          allowGiveSips={game?.sips_enabled ?? true}
          onAssignSips={async (to, sip_count) => {
            if (!game || !player) return;
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
            const updatedPlayer = players.find((p: any) => p.id === player.id);
            if (updatedPlayer) setPlayer(updatedPlayer);
          }}
          onPaySubmit={async (payments, opts) => {
            if (!game || !player) return;
            try {
              const result = await processPayments(game.code, player.id, payments, { ...(opts || {}), mode: opts?.mode || 'bank' });

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

              // Refresh state
              const players = await fetchPlayers(game.code);
              setPlayersList(players);
              const updatedPlayer = players.find((p: any) => p.id === player.id);
              if (updatedPlayer) setPlayer(updatedPlayer);
              const { data: gameData } = await supabase.from('games').select('*').eq('code', game.code).single();
              if (gameData) setGame(gameData);
            } catch (err: any) {
              console.error('Pay submit error from TradeLockOverlay:', err);
              const msg = err?.message || 'Failed to process payment';
              if (msg && msg.toLowerCase().includes('insufficient')) {
                try { toast({ title: 'Insufficient funds', description: "You don't have enough money to complete this payment.", variant: 'destructive' }); } catch (e) { alert(msg); }
                setInsufficientFundsFlash(true);
                window.setTimeout(() => setInsufficientFundsFlash(false), 900);
              } else {
                try { toast({ title: 'Payment failed', description: msg }); } catch (e) { alert(msg); }
              }
            }
          }}
          onOpenCollect={() => { setCollectModalOpen(true); setCollectMode('bank'); }}
          onCollect={handleCollect}
        />

        {/* Win overlay — shown when this player is the last one standing */}
        {gameWon && (
          <div className="fixed inset-0 z-[100001] pointer-events-auto overflow-auto" style={{ backgroundColor: 'hsl(var(--background))' }}>
            <div className="min-h-screen flex items-center justify-center px-6 py-12">
              <div className="max-w-sm w-full text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h1 className="text-4xl font-extrabold mb-2" style={{ color: 'hsl(var(--primary))' }}>You Won!</h1>
                <p className="text-lg mb-1" style={{ color: 'hsl(var(--foreground))' }}>
                  Everyone else has gone bankrupt.
                </p>
                <p className="text-muted-foreground mb-8">
                  Final balance: <span className="font-semibold text-foreground">${(player?.balance ?? 0).toLocaleString()}</span>
                </p>
                <button
                  className="w-full px-4 py-3 rounded text-lg font-semibold"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  onClick={() => setGameWon(false)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        <SipsLockOverlay
          open={sipsOverlayOpen}
          batches={sipBatches}
          onDismissBatch={async () => {
            if (!game || !player) return;
            // Optimistically remove the front (oldest) sip event for smooth animation
            setPendingSipEvents((prev) => prev.slice(1));
            try {
              setCompletingSips(true);
              await completeSipBatch(game.code, player.id);
              const [players, sipEvData] = await Promise.all([
                fetchPlayers(game.code),
                supabase.from('sip_events').select('id,sip_count').eq('game_id', game.id).eq('to_player_id', player.id).eq('status', 'pending').order('created_at', { ascending: true }),
              ]);
              setPlayersList(players);
              const updatedPlayer = players.find((p: any) => p.id === player.id);
              if (updatedPlayer) setPlayer(updatedPlayer);
              if (sipEvData.data) setPendingSipEvents(sipEvData.data);
            } catch (err: any) {
              console.error('Complete sips error:', err);
              alert(err.message || 'Failed to complete sips');
            } finally {
              setCompletingSips(false);
            }
          }}
          processing={completingSips}
          currentBalance={player?.balance ?? 0}
          players={playersList}
          showBalances={game?.show_balances ?? true}
          currentPlayerId={player?.id}
          currentPlayer={player}
          allowGiveSips={game?.sips_enabled ?? true}
          onAssignSips={async (to, sip_count) => {
            if (!game || !player) return;
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
            const updatedPlayer = players.find((p: any) => p.id === player.id);
            if (updatedPlayer) setPlayer(updatedPlayer);
          }}
          onPaySubmit={async (payments, opts) => {
            if (!game || !player) return;
            try {
              const result = await processPayments(game.code, player.id, payments, { ...(opts || {}), mode: opts?.mode || 'bank' });

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

              // Refresh state
              const players = await fetchPlayers(game.code);
              setPlayersList(players);
              const updatedPlayer = players.find((p: any) => p.id === player.id);
              if (updatedPlayer) setPlayer(updatedPlayer);
              const { data: gameData } = await supabase.from('games').select('*').eq('code', game.code).single();
              if (gameData) setGame(gameData);
            } catch (err: any) {
              console.error('Pay submit error from SipsLockOverlay:', err);
              const msg = err?.message || 'Failed to process payment';
              if (msg && msg.toLowerCase().includes('insufficient')) {
                try { toast({ title: 'Insufficient funds', description: "You don't have enough money to complete this payment.", variant: 'destructive' }); } catch (e) { alert(msg); }
                setInsufficientFundsFlash(true);
                window.setTimeout(() => setInsufficientFundsFlash(false), 900);
              } else {
                try { toast({ title: 'Payment failed', description: msg }); } catch (e) { alert(msg); }
              }
            }
          }}
          onClearAll={async () => {
            if (!game || !player) return;
            try {
              setCompletingSips(true);
              await completeSips(game.code, player.id);
              const players = await fetchPlayers(game.code);
              setPlayersList(players);
              const updatedPlayer = players.find((p: any) => p.id === player.id);
              if (updatedPlayer) setPlayer(updatedPlayer);
              setPendingSipEvents([]);
            } catch (err: any) {
              console.error('Clear all sips failed', err);
              try { toast({ title: 'Clear failed', description: err.message || 'Unable to clear sips', variant: 'destructive' }); } catch {}
            } finally {
              setCompletingSips(false);
            }
          }}
          onOpenCollect={() => { setCollectModalOpen(true); setCollectMode('bank'); }}
          onCollect={handleCollect}
        />
      </div>
      <ActivityLog gameCode={game?.code ?? gameCode} players={playersList} currentPlayer={player} soundEnabled={soundEnabled} />
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

// ─── Money Tower Orbital Animation ───────────────────────────────────────────
//
// Renders animated entities (player avatars, bank icons, etc.) that fly toward
// or away from the money tower whenever the player's balance changes.
//
type OrbitalTransactionType = 'bank' | 'player' | 'tax' | 'free_parking' | 'pass_go' | 'jail' | null;

interface OrbitalParticle {
  id: string;
  node: React.ReactNode;
  angleDeg: number;
  radius: number;
  delay: number;
  size: number;
}

function MoneyOrbitals({
  transactionMeta,
  children,
}: {
  transactionMeta: { type: OrbitalTransactionType; direction: 'in' | 'out'; entities?: { id: string; name: string; avatar_url?: string | null }[]; key: number } | null;
  children: React.ReactNode;
}) {
  const [activeParticles, setActiveParticles] = useState<{ key: number; direction: 'in' | 'out'; particles: OrbitalParticle[] } | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!transactionMeta) return;

    const { type, direction, entities, key } = transactionMeta;

    // Tint colors matching the AnimatedNumber green/red
    const col = direction === 'in' ? '#34D399' : '#EF4444';
    const colFaint = direction === 'in' ? '#6EE7B7' : '#FCA5A5';

    // Build particle list based on transaction type
    const particleNodes: { id: string; node: React.ReactNode; size: number }[] = [];

    if (type === 'bank') {
      particleNodes.push(
        { id: 'b0', size: 28, node: <Building2 className="money-orbital-icon" style={{ width: 28, height: 28, color: col }} /> },
        { id: 'b1', size: 22, node: <DollarSign className="money-orbital-icon" style={{ width: 22, height: 22, color: colFaint }} /> },
        { id: 'b2', size: 26, node: <Building2 className="money-orbital-icon" style={{ width: 26, height: 26, color: col }} /> },
        { id: 'b3', size: 20, node: <DollarSign className="money-orbital-icon" style={{ width: 20, height: 20, color: colFaint }} /> },
      );
    } else if (type === 'tax') {
      particleNodes.push(
        { id: 't0', size: 28, node: <Percent className="money-orbital-icon" style={{ width: 28, height: 28, color: col }} /> },
        { id: 't1', size: 22, node: <DollarSign className="money-orbital-icon" style={{ width: 22, height: 22, color: colFaint }} /> },
        { id: 't2', size: 26, node: <Percent className="money-orbital-icon" style={{ width: 26, height: 26, color: col }} /> },
        { id: 't3', size: 20, node: <DollarSign className="money-orbital-icon" style={{ width: 20, height: 20, color: colFaint }} /> },
      );
    } else if (type === 'free_parking') {
      particleNodes.push(
        { id: 'fp0', size: 28, node: <PiggyBank className="money-orbital-icon" style={{ width: 28, height: 28, color: col }} /> },
        { id: 'fp1', size: 22, node: <DollarSign className="money-orbital-icon" style={{ width: 22, height: 22, color: colFaint }} /> },
        { id: 'fp2', size: 26, node: <PiggyBank className="money-orbital-icon" style={{ width: 26, height: 26, color: col }} /> },
        { id: 'fp3', size: 20, node: <DollarSign className="money-orbital-icon" style={{ width: 20, height: 20, color: colFaint }} /> },
      );
    } else if (type === 'pass_go') {
      particleNodes.push(
        { id: 'g0', size: 30, node: <Crown className="money-orbital-icon" style={{ width: 30, height: 30, color: col }} /> },
        { id: 'g1', size: 22, node: <DollarSign className="money-orbital-icon" style={{ width: 22, height: 22, color: colFaint }} /> },
        { id: 'g2', size: 26, node: <Crown className="money-orbital-icon" style={{ width: 26, height: 26, color: col }} /> },
        { id: 'g3', size: 20, node: <DollarSign className="money-orbital-icon" style={{ width: 20, height: 20, color: colFaint }} /> },
      );
    } else if (type === 'jail') {
      particleNodes.push(
        { id: 'j0', size: 28, node: <span className="money-orbital-icon" style={{ fontSize: 28, lineHeight: 1 }}>⛓️</span> },
        { id: 'j1', size: 22, node: <DollarSign className="money-orbital-icon" style={{ width: 22, height: 22, color: col }} /> },
        { id: 'j2', size: 26, node: <span className="money-orbital-icon" style={{ fontSize: 24, lineHeight: 1 }}>🔒</span> },
        { id: 'j3', size: 20, node: <DollarSign className="money-orbital-icon" style={{ width: 20, height: 20, color: colFaint }} /> },
      );
    } else if (type === 'player' && entities && entities.length > 0) {
      entities.slice(0, 4).forEach((e, i) => {
        particleNodes.push({
          id: e.id,
          size: 32,
          node: <PlayerAvatar player={e} size="sm" className="money-orbital-avatar" />,
        });
      });
      // Pad with generic coins if fewer than 4 players
      while (particleNodes.length < 4) {
        particleNodes.push({ id: `coin-${particleNodes.length}`, size: 20, node: <DollarSign className="money-orbital-icon" style={{ width: 20, height: 20, color: col }} /> });
      }
    } else {
      // generic: money coins flying in/out
      particleNodes.push(
        { id: 'gen0', size: 28, node: <DollarSign className="money-orbital-icon" style={{ width: 28, height: 28, color: col }} /> },
        { id: 'gen1', size: 22, node: <DollarSign className="money-orbital-icon" style={{ width: 22, height: 22, color: colFaint }} /> },
        { id: 'gen2', size: 26, node: <DollarSign className="money-orbital-icon" style={{ width: 26, height: 26, color: col }} /> },
        { id: 'gen3', size: 20, node: <DollarSign className="money-orbital-icon" style={{ width: 20, height: 20, color: colFaint }} /> },
      );
    }

    // Spread particles evenly around a circle, with slight phase offset for visual variety
    const baseAngles = [320, 40, 130, 220];
    const radii = [115, 105, 120, 100];
    const delays = [0, 90, 55, 145];

    const particles: OrbitalParticle[] = particleNodes.slice(0, 4).map((p, i) => ({
      id: p.id,
      node: p.node,
      angleDeg: baseAngles[i],
      radius: radii[i],
      delay: delays[i],
      size: p.size,
    }));

    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setActiveParticles({ key, direction, particles });
    clearTimerRef.current = window.setTimeout(() => setActiveParticles(null), 1800);
  }, [transactionMeta]);

  // Cleanup on unmount
  useEffect(() => () => { if (clearTimerRef.current) clearTimeout(clearTimerRef.current); }, []);

  return (
    <div className="relative money-tower-wrap" style={{ isolation: 'isolate' }}>
      {children}
      {activeParticles && (
        <div
          aria-hidden="true"
          className="money-orbital-layer"
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 20 }}
        >
          {activeParticles.particles.map((p) => {
            const angleRad = (p.angleDeg * Math.PI) / 180;
            const dx = Math.cos(angleRad) * p.radius;
            const dy = Math.sin(angleRad) * p.radius;
            const isIn = activeParticles.direction === 'in';

            return (
              <div
                key={`${activeParticles.key}-${p.id}`}
                className={isIn ? 'money-orbital-in' : 'money-orbital-out'}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: p.size,
                  height: p.size,
                  marginLeft: -(p.size / 2),
                  marginTop: -(p.size / 2),
                  '--dx-start': isIn ? `${dx}px` : '0px',
                  '--dy-start': isIn ? `${dy}px` : '0px',
                  '--dx-end': isIn ? '0px' : `${dx}px`,
                  '--dy-end': isIn ? '0px' : `${dy}px`,
                  '--anim-delay': `${p.delay}ms`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: isIn
                    ? 'drop-shadow(0 0 6px rgba(52,211,153,0.7))'
                    : 'drop-shadow(0 0 6px rgba(239,68,68,0.65))',
                } as React.CSSProperties}
              >
                {p.node}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedNumber({ value, soundEnabled = true, maskIfGameHidden = false, gameCode, }: { value: number; soundEnabled?: boolean; maskIfGameHidden?: boolean; gameCode?: string | null }) {
  const [display, setDisplay] = useState<number>(value ?? 0);
  const prevRef = useRef<number>(value ?? 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [bump, setBump] = useState<'up' | 'down' | 'neutral'>('neutral');
  const timeoutRef = useRef<number | null>(null);
  const SHOW_KEY_PREFIX = 'drunkopoly:show_my_balance:';
  const storageKey = SHOW_KEY_PREFIX + (gameCode || 'global');

  // When the game has `show_balances` disabled we allow the user to locally
  // toggle visibility of their own big balance. This persists to localStorage
  // per-game (or global if no code).
  const [localShown, setLocalShown] = useState<boolean>(() => {
    try {
      if (!maskIfGameHidden) return true;
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      return raw === 'true';
    } catch (e) {
      return false;
    }
  });

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

  const isMasked = maskIfGameHidden && !localShown;

  return (
    <div aria-live="polite" className="relative inline-flex items-baseline gap-1">
      <div
        className={`inline-flex items-baseline gap-1`} 
        style={{
          transition: 'filter 220ms ease, opacity 220ms',
          filter: isMasked ? 'blur(14px) saturate(.85)' : 'none',
        }}
      >
        <span className={`text-2xl align-baseline ${colorClass}`} style={{ ...styleToUse, color: colorHex }}>{"$"}</span>
        <span className={`align-baseline ${colorClass}`} style={{ ...styleToUse, fontVariantNumeric: 'tabular-nums', color: colorHex }}>{formatted}</span>
      </div>

      {maskIfGameHidden ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            try {
              const next = !localShown;
              setLocalShown(next);
              if (typeof window !== 'undefined') localStorage.setItem(storageKey, String(next));
            } catch (err) {
              // ignore storage errors
            }
          }}
          aria-pressed={localShown}
          aria-label={localShown ? 'Hide balance' : 'Show balance'}
          title={localShown ? 'Hide balance' : 'Show balance'}
          className="drunk-eye-toggle inline-flex items-center justify-center -ml-4 mt-8 w-9 h-9 rounded-full border border-border text-foreground bg-transparent transition-transform duration-150 hover:-translate-y-1 focus:outline-none focus:ring-2"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {localShown ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}

function GameCodePopover({ code, onLogout, players, currentPlayer, game, onRemovePlayer, soundEnabled, onToggleSound, showBalances = true, onToggleShowBalances, onToggleSipsEnabled, onToggleExpansion, onToggleGambling, showRulesInPopover,
  // centralized commissioner state/handlers from parent
  commPinOpen, setCommPinOpen, commToolsOpen, setCommToolsOpen, commPinValue, setCommPinValue, commUnlocked, openCommissionerTools, tryUnlockCommissionerTools, setCommUnlockedUntil, hasCommissionerAccess
}: { code: string; onLogout?: () => void; players?: any[]; currentPlayer?: any; game?: any; onRemovePlayer?: (id: string) => Promise<void>; soundEnabled?: boolean; onToggleSound?: (enabled: boolean) => void; showBalances?: boolean; onToggleShowBalances?: (enabled: boolean) => void; onToggleSipsEnabled?: (enabled: boolean) => void; onToggleExpansion?: (enabled: boolean) => void; onToggleGambling?: (enabled: boolean) => void; showRulesInPopover?: boolean; commPinOpen: boolean; setCommPinOpen: (v:boolean)=>void; commToolsOpen: boolean; setCommToolsOpen: (v:boolean)=>void; commPinValue: string; setCommPinValue: (v:string)=>void; commUnlocked: boolean; openCommissionerTools: ()=>void; tryUnlockCommissionerTools: ()=>void; setCommUnlockedUntil: (n:number)=>void; hasCommissionerAccess: ()=>boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsOpenSection, setSettingsOpenSection] = useState<'game' | 'players' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name?: string } | null>(null);
  const [commSelectedPlayerId, setCommSelectedPlayerId] = useState<string>('');
  const [commBalanceMode, setCommBalanceMode] = useState<'set' | 'delta'>('delta');
  const [commBalanceValue, setCommBalanceValue] = useState<string>('');
  const [commPendingSipsValue, setCommPendingSipsValue] = useState<string>('');
  const navigate = useNavigate();

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

  

  const commissionerAdjustBalance = async () => {
    if (!hasCommissionerAccess()) return;
    if (!game?.id) return;
    const targetId = String(commSelectedPlayerId || '');
    const parsed = Number(commBalanceValue);
    if (!targetId) {
      try { toast({ title: 'Missing player', description: 'Select a player first.', variant: 'destructive' }); } catch { /* ignore */ }
      return;
    }
    if (!Number.isFinite(parsed)) {
      try { toast({ title: 'Invalid amount', description: 'Enter a valid number.', variant: 'destructive' }); } catch { /* ignore */ }
      return;
    }

    try {
      // Fetch freshest player row so we compute delta off the latest balance.
      const { data: targetRows, error: tErr } = await supabase
        .from('players')
        .select('*')
        .eq('id', targetId)
        .eq('game_id', game.id)
        .limit(1);
      if (tErr) throw tErr;
      const target = targetRows && targetRows.length ? targetRows[0] : null;
      if (!target) throw new Error('Player not found');

      const currentBal = Number(target.balance || 0);
      const nextBal = commBalanceMode === 'set' ? parsed : (currentBal + parsed);
      if (!Number.isFinite(nextBal)) throw new Error('Invalid resulting balance');
      if (nextBal < 0) throw new Error('Balance cannot be negative');

      await supabase.from('players').update({ balance: nextBal }).eq('id', targetId).eq('game_id', game.id);

      const delta = nextBal - currentBal;
      const modeDesc = commBalanceMode === 'set' ? `set balance to $${Number(nextBal).toLocaleString()}` : `adjusted balance by $${Number(parsed).toLocaleString()}`;
      await supabase.from('money_events').insert([{
        game_id: game.id,
        actor_player_id: currentPlayer?.id ?? null,
        from_player_id: null,
        to_player_id: targetId,
        amount: delta,
        type: 'admin_balance_adjust',
        description: `Commissioner ${modeDesc} for ${target?.name || targetId}.`,
      }]);

      try { toast({ title: 'Balance updated', description: `${target?.name || 'Player'} now has $${Number(nextBal).toLocaleString()}.` }); } catch { /* ignore */ }

      // Clear inputs but keep tools open.
      setCommBalanceValue('');
    } catch (err: any) {
      console.error('Commissioner adjust balance failed', err);
      try { toast({ title: 'Update failed', description: err?.message || 'Failed to update balance.', variant: 'destructive' }); } catch { /* ignore */ }
    }
  };

  const commissionerSetPendingSips = async () => {
    if (!hasCommissionerAccess()) return;
    if (!game?.id) return;
    const targetId = String(commSelectedPlayerId || '');
    const parsed = Number(commPendingSipsValue);
    if (!targetId) {
      try { toast({ title: 'Missing player', description: 'Select a player first.', variant: 'destructive' }); } catch { /* ignore */ }
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      try { toast({ title: 'Invalid sips', description: 'Enter a whole number 0 or greater.', variant: 'destructive' }); } catch { /* ignore */ }
      return;
    }

    try {
      const { data: targetRows, error: tErr } = await supabase
        .from('players')
        .select('*')
        .eq('id', targetId)
        .eq('game_id', game.id)
        .limit(1);
      if (tErr) throw tErr;
      const target = targetRows && targetRows.length ? targetRows[0] : null;
      if (!target) throw new Error('Player not found');

      const prev = Number(target.pending_sips || 0);
      await supabase.from('players').update({ pending_sips: parsed }).eq('id', targetId).eq('game_id', game.id);

      await supabase.from('money_events').insert([{
        game_id: game.id,
        actor_player_id: currentPlayer?.id ?? null,
        from_player_id: null,
        to_player_id: targetId,
        amount: 0,
        type: 'admin_pending_sips_set',
        description: `Commissioner set pending sips for ${target?.name || targetId} from ${prev} to ${parsed}.`,
      }]);

      try { toast({ title: 'Pending sips updated', description: `${target?.name || 'Player'} now has ${parsed} pending sip${parsed !== 1 ? 's' : ''}.` }); } catch { /* ignore */ }
      setCommPendingSipsValue('');
    } catch (err: any) {
      console.error('Commissioner set pending sips failed', err);
      try { toast({ title: 'Update failed', description: err?.message || 'Failed to update pending sips.', variant: 'destructive' }); } catch { /* ignore */ }
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
          <Button variant="secondary" className="w-full mt-1" onClick={() => { setQrCodeOpen(false); setSettingsOpen(false); onLogout && /* no-op */ null; navigate('/drunk/drunkopoly/rules'); }}>
            <Info size={16} />
            Rules
          </Button>
          <Button
            variant="secondary"
            className="w-full mt-1"
            onClick={() => {
              setQrCodeOpen(false);
              setSettingsOpen(false);
              navigate('/drunk/drunkopoly/messages');
            }}
          >
            <MessagesSquare size={16} />
            Messages
          </Button>
          <Button variant="secondary" className="w-full mt-1" onClick={() => setSettingsOpen(true)}>
            <Settings size={16} />
            Settings
          </Button>
          <Button variant="destructive" className="w-full mt-1 ring-2 ring-red-500/10 shadow-sm shadow-red-500/20" onClick={onLogout}>
            Leave Game
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-2">
          <div>
            <button
              type="button"
              onClick={() => setSettingsOpenSection((v) => (v === 'game' ? null : 'game'))}
              className="w-full flex items-center justify-between gap-3 p-3 rounded bg-muted/30 hover:bg-muted/40"
              aria-expanded={settingsOpenSection === 'game'}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-medium">Game Settings</div>
                  <div className="text-sm text-muted-foreground">App-wide game options</div>
                </div>
              </div>
              <ChevronDown
                className="w-5 h-5 transform-gpu"
                style={{ transform: settingsOpenSection === 'game' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
              />
            </button>

            {settingsOpenSection === 'game' && (
              <div className="mt-3 px-0">
                <div className="rounded bg-muted/30 border border-muted p-3 space-y-2">
                  {/* Always-visible items: Theme and App Sounds */}
                  <ThemeSelector />

                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10">
                    <div className="flex-1">
                      <div className="font-medium text-sm">App Sounds</div>
                      <div className="text-xs text-muted-foreground">Play sounds for money changes</div>
                    </div>
                    <Switch
                      checked={soundEnabled ?? true}
                      onCheckedChange={(checked) => { if (onToggleSound) onToggleSound(checked); }}
                    />
                  </div>

                  {/* Additional game-level settings visible only to the commissioner */}
                  {currentPlayer?.is_commissioner && (
                    <>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10">
                        <div className="flex-1">
                          <div className="font-medium text-sm">Show Player Balances</div>
                          <div className="text-xs text-muted-foreground">Allow players to see each other's money</div>
                        </div>
                        <Switch
                          checked={!!(game?.show_balances ?? showBalances)}
                          onCheckedChange={(checked) => { if (onToggleShowBalances) onToggleShowBalances(checked); }}
                        />
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10">
                        <div className="flex-1">
                          <div className="font-medium text-sm">Play With Sips</div>
                          <div className="text-xs text-muted-foreground">Enable sip counters and Give Sips features</div>
                        </div>
                        <Switch
                          checked={!!(game?.sips_enabled ?? true)}
                          onCheckedChange={(checked) => { if (onToggleSipsEnabled) onToggleSipsEnabled(checked); }}
                        />
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10">
                        <div className="flex-1">
                          <div className="font-medium text-sm">Expansion Pack</div>
                          <div className="text-xs text-muted-foreground">Route payments to the bank into Free Parking</div>
                        </div>
                        <Switch
                          checked={!!(game?.expansion_enabled ?? false)}
                          onCheckedChange={(checked) => { if (onToggleExpansion) onToggleExpansion(checked); }}
                        />
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/10">
                        <div className="flex-1">
                          <div className="font-medium text-sm">Gambling</div>
                          <div className="text-xs text-muted-foreground">Lets players gamble Pass Go or Free Parking on a roulette spin</div>
                        </div>
                        <Switch
                          checked={!!(game?.gambling_enabled ?? false)}
                          onCheckedChange={(checked) => { if (onToggleGambling) onToggleGambling(checked); }}
                        />
                      </div>
                    </>
                  )}

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full justify-center"
                      onClick={() => {
                        const fallback = (currentPlayer?.id ? String(currentPlayer.id) : (players && players.length ? String(players[0]?.id) : '')) || '';
                        setCommSelectedPlayerId((prev) => (prev ? prev : fallback));
                        openCommissionerTools();
                      }}
                      title="Commissioner-only tools (audited)"
                    >
                      Advanced (Commissioner)
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setSettingsOpenSection((v) => (v === 'players' ? null : 'players'))}
              className="w-full flex items-center justify-between gap-3 p-3 rounded bg-muted/30 hover:bg-muted/40"
              aria-expanded={settingsOpenSection === 'players'}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-medium">Players</div>
                  <div className="text-sm text-muted-foreground">Manage players in this game</div>
                </div>
              </div>
              <ChevronDown
                className="w-5 h-5 transform-gpu"
                style={{ transform: settingsOpenSection === 'players' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
              />
            </button>

            {settingsOpenSection === 'players' && (
              <div className="mt-3 px-0">
                <div className="rounded bg-muted/30 border border-muted p-3 space-y-2">
                  <div className="space-y-2">
                    {(players && players.length > 0) ? (
                      players.map((p: any) => {
                          const isSelf = currentPlayer && String(currentPlayer.id) === String(p.id);
                          const isCommissioner = !!p.is_commissioner;
                          // Only the current commissioner may remove other players.
                          const canRemove = !!(currentPlayer && currentPlayer.is_commissioner) && !isCommissioner && !isSelf;
                        const canSeeBalance = showBalances;
                        return (
                          <div key={p.id} className="flex items-center gap-3 py-2 px-2 border rounded">
                            <PlayerAvatar player={p} size="md" />
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
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Commissioner PIN gate (soft gate; real protection must be enforced in Supabase policies) */}
    <Dialog open={commPinOpen} onOpenChange={(v) => { setCommPinOpen(v); if (!v) setCommPinValue(''); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Commissioner Tools</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Enter the commissioner PIN to unlock tools for this session.
          </div>
          <Input
            type="password"
            value={commPinValue}
            placeholder="PIN"
            onChange={(e) => setCommPinValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tryUnlockCommissionerTools(); } }}
          />
          <div className="text-xs text-muted-foreground">
            Note: this is a UI-only gate. Security must be enforced with Supabase RLS.
          </div>
        </div>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => setCommPinOpen(false)}>Cancel</Button>
          <Button onClick={tryUnlockCommissionerTools}>Unlock</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Commissioner Tools (audited) */}
    <Dialog open={commToolsOpen} onOpenChange={setCommToolsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Commissioner Tools</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded border border-muted bg-muted/20 p-3 space-y-2">
            <div className="text-sm font-medium">Target Player</div>
            <select
              className="w-full h-10 px-3 rounded border border-input bg-background text-foreground"
              value={commSelectedPlayerId}
              onChange={(e) => setCommSelectedPlayerId(e.target.value)}
            >
              {(players || []).map((p: any) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}{p.is_commissioner ? ' (Commissioner)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded border border-muted bg-muted/20 p-3 space-y-3">
            <div className="text-sm font-medium">Adjust Balance</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={commBalanceMode === 'delta' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setCommBalanceMode('delta')}
              >
                Delta (+/-)
              </Button>
              <Button
                type="button"
                variant={commBalanceMode === 'set' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setCommBalanceMode('set')}
              >
                Set Exact
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => {
                setCommBalanceValue((prev) => {
                  if (!prev) return '-';
                  return String(prev).startsWith('-') ? String(prev).slice(1) : `-${prev}`;
                });
              }} title="Toggle sign">+/-</Button>
              <Input
                type="text"
                inputMode="numeric"
                value={commBalanceValue}
                placeholder={commBalanceMode === 'set' ? 'New balance (e.g. 1500)' : 'Delta (e.g. -200 or 200)'}
                onChange={(e) => setCommBalanceValue(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={commissionerAdjustBalance}>
                Apply Balance Change
              </Button>
            </div>
          </div>

          <div className="rounded border border-muted bg-muted/20 p-3 space-y-3">
            <div className="text-sm font-medium">Set Pending Sips</div>
            <Input
              inputMode="numeric"
              value={commPendingSipsValue}
              placeholder="Pending sips (e.g. 0)"
              onChange={(e) => setCommPendingSipsValue(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="button" onClick={commissionerSetPendingSips}>
                Apply Sips Change
              </Button>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setCommToolsOpen(false)}>Close</Button>
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

// BlockedPaymentDialog component moved outside Drunkopoly to avoid type and JSX errors
interface BlockedPaymentDialogProps {
  blockedPaymentMessage: string | null;
  setBlockedPaymentMessage: (msg: string | null) => void;
}

const BlockedPaymentDialog: React.FC<BlockedPaymentDialogProps> = ({
  blockedPaymentMessage,
  setBlockedPaymentMessage,
}) => (
  <Dialog open={!!blockedPaymentMessage} onOpenChange={(v: boolean) => { if (!v) setBlockedPaymentMessage(null); }}>
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
);
