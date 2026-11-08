import { useEffect, useState, useRef } from "react";
import PayPopup from "../components/PayPopup";
import JailPopup from "../components/JailPopup";
import BankruptPopup from "../components/BankruptPopup";
import BankruptStatus from "../components/BankruptStatus";
import SipsLockOverlay from "../components/SipsLockOverlay";
import SipLeaderboardPopup from "../components/SipLeaderboardPopup";
import { UserPlus, DollarSign, Users, Percent, Crown, PiggyBank, Clock, Copy, Settings, QrCode, ChevronDown, ChevronLeft, ChevronRight, Info, Eye, EyeOff, Building2, MessagesSquare, LogOut, UserRound } from "lucide-react";
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
import RestoringGame from "../components/RestoringGame";
import { PLAYER_SELECT, withLiveAvatars } from "../lib/playerAvatars";
import PlayerAvatar from "../components/PlayerAvatar";
import { ColorBand, DeedFan } from "../components/BoardArt";
import { Board, BoardSpace, BoardLine, WideSpace } from "../components/BoardSpace";
import { LiveDot } from "../components/LiveDot";
import HallOfFame from "../components/HallOfFame";
import { cn } from "../lib/utils";
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
import { drunkSupabase as supabase } from "../lib/drunkSupabase";
import { useDrunkAccount, patchProfile, signOutAccount } from "../lib/drunkAccount";
import AccountShell, { HeroLogo } from "../components/account/AccountShell";
import AccountFlow from "../components/account/AccountFlow";
import ProfilePanel from "../components/account/ProfilePanel";
import ProfileStats from "../components/account/ProfileStats";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "../components/ui/use-toast";
import { drunkAlert } from "../lib/drunkNotify";
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

// Every public drunk_users column (phone/password/auth link are never readable).
const DRUNK_USER_COLUMNS = 'id, username, first_name, last_name, avatar_url, bio, wins, losses, created_at, total_sips';

type Screen = "join-create" | "enter-name" | "confirm-settings" | "select-existing-player" | "home" | "auth" | "profile";

// ---- Presentational helpers (home-page visual language) ----
const BACK_PILL_CLASS =
  "inline-flex min-h-[40px] items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const SECTION_LABEL_CLASS = "text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground";
const META_LABEL_CLASS = "text-[11px] uppercase tracking-widest text-muted-foreground";
const INNER_ROW_CLASS = "rounded-xl border border-foreground/10 bg-foreground/[0.03]";

// Game art (transparent cut-outs in /public/drunkopoly).
const ART = {
  bank: "/drunkopoly/bank.webp",
  money: "/drunkopoly/play_money.webp",
  players: "/drunkopoly/players.webp",
  tax: "/drunkopoly/luxury_tax.webp",
  passGo: "/drunkopoly/pass_go.webp",
  freeParking: "/drunkopoly/free_parking.webp",
  tradeTimer: "/drunkopoly/trade_timer.webp",
  police: "/drunkopoly/police.webp",
  sips: "/drunkopoly/sips.webp",
} as const;

const SectionLabel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`${SECTION_LABEL_CLASS} ${className}`}>
    {children}
  </div>
);

const LobbyHero = ({
  onBack,
  backLabel,
  eyebrow,
  title,
}: {
  onBack?: () => void;
  backLabel?: string;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
}) => (
  <div className="w-full max-w-md">
    {onBack && (
      <button
        type="button"
        onClick={onBack}
        className={`${BACK_PILL_CLASS} motion-safe:animate-rise`}
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel ?? 'Back'}
      </button>
    )}
    <p
      className={`${onBack ? 'mt-8' : ''} flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground motion-safe:animate-rise`}
      style={{ animationDelay: '70ms' }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
      {eyebrow}
    </p>
    <h1
      className="mt-3 pb-2 font-display text-4xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-5xl motion-safe:animate-rise"
      style={{ animationDelay: '140ms' }}
    >
      {title}
    </h1>
  </div>
);

/** Decorative property-colour accent at the top of lobby cards. */
const CardBand = () => (
  <div aria-hidden className="pointer-events-none px-6 pt-5">
    <ColorBand className="h-1 opacity-80" />
  </div>
);

const Drunkopoly = () => {
  const STORAGE_KEY_CODE = "drunkopoly:gameCode";
  const STORAGE_KEY_NAME = "drunkopoly:name";
  const STORAGE_KEY_RECENT = "drunkopoly:recentGames";
  const STORAGE_KEY_SOUND = "drunkopoly:soundEnabled";

  // Other Drunkopoly pages (e.g. a player's stats) can open the profile via router state.
  const location = useLocation();
  const [screen, setScreen] = useState<Screen>(() =>
    (location.state as { screen?: Screen } | null)?.screen === 'profile' ? 'profile' : 'join-create',
  );
  const [gameCode, setGameCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"join" | "create" | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True while a saved session (code + name in localStorage) is being restored on
  // mount. Decided synchronously so the first paint is the loader, not the join
  // screen. Invite links skip restoring (the invite effect clears the session).
  const [restoring, setRestoring] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return false;
      const params = new URLSearchParams(window.location.search);
      if (params.get('invite') || params.get('code')) return false;
      return !!(localStorage.getItem(STORAGE_KEY_CODE) && localStorage.getItem(STORAGE_KEY_NAME));
    } catch { return false; }
  });
  // temporary settings used when creating a new game (strings so inputs can be cleared)
  const [tempInitialBalance, setTempInitialBalance] = useState<string>("1500");
  const [tempPassGoAmount, setTempPassGoAmount] = useState<string>("200");
  const [tempFreeParkingBalance, setTempFreeParkingBalance] = useState<string>("0");
  const [tempShowBalances, setTempShowBalances] = useState<boolean>(true);
  const [tempSipsEnabled, setTempSipsEnabled] = useState<boolean>(true);
  const [tempExpansionEnabled, setTempExpansionEnabled] = useState<boolean>(false);
  const [tempGamblingEnabled, setTempGamblingEnabled] = useState<boolean>(true);
  const [game, setGame] = useState<any | null>(null);
  const [player, setPlayer] = useState<any | null>(null);
  const [recentGames, setRecentGames] = useState<string[]>([]);
  const [recentPlayers, setRecentPlayers] = useState<any[] | null>(null);
  const [playersList, setPlayersList] = useState<any[]>([]);
  const alertedMessengerRef = useRef<Map<string, string | null>>(new Map());
  const soundEnabledRef = useRef<boolean>(
    (() => { try { const s = typeof window !== 'undefined' ? localStorage.getItem('drunkopoly:soundEnabled') : null; return s !== null ? s === 'true' : true; } catch { return true; } })()
  );
  const [removedNoticeOpen, setRemovedNoticeOpen] = useState(false);
  const [removedNoticeMsg, setRemovedNoticeMsg] = useState<string | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payMode, setPayMode] = useState<"bank" | "players" | "tax" | null>(null);
  const [sipModalOpen, setSipModalOpen] = useState(false);
  const [tradeTimerModalOpen, setTradeTimerModalOpen] = useState(false);
  const [tradeTimerSelected, setTradeTimerSelected] = useState<number>(60);
  const [jailModalOpen, setJailModalOpen] = useState(false);
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

  // Header morph: full-width bar at the top of the page, floating island once scrolled.
  const [headerScrolled, setHeaderScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // When the big balance card scrolls up under the header, dock a compact copy
  // of the balance into the island so it's always visible.
  const [balanceCardEl, setBalanceCardEl] = useState<HTMLDivElement | null>(null);
  const [balanceDocked, setBalanceDocked] = useState(false);
  useEffect(() => {
    if (!balanceCardEl) { setBalanceDocked(false); return; }
    const io = new IntersectionObserver(
      ([entry]) => setBalanceDocked(!entry.isIntersecting && entry.boundingClientRect.top < 80),
      // Top margin matches the island's height so it docks as the number slides beneath it.
      { rootMargin: '-72px 0px 0px 0px', threshold: 0 },
    );
    io.observe(balanceCardEl);
    return () => io.disconnect();
  }, [balanceCardEl]);

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

  // Account (phone number + password, Supabase Auth). See lib/drunkAccount.ts.
  const account = useDrunkAccount();
  const currentUser = account.profile;
  // Guests skip the account gate for this browser session only.
  const [guestMode, setGuestModeState] = useState<boolean>(() => {
    try { return sessionStorage.getItem('drunkopoly:guest') === '1'; } catch { return false; }
  });
  const setGuestMode = (v: boolean) => {
    setGuestModeState(v);
    try { if (v) sessionStorage.setItem('drunkopoly:guest', '1'); else sessionStorage.removeItem('drunkopoly:guest'); } catch { /* ignore */ }
  };
  // In-game profile / sign-in dialog
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);

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
  // Keep ref in sync so polling closures always read the latest value
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
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
      if (currentUser?.id && (!p.user_id || p.user_id === currentUser.id)) onlineUpdate.user_id = currentUser.id;
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

  // Stats writes elsewhere patch the cached profile; null signs out.
  const persistAuthUser = (u: any | null) => {
    if (!u) { void signOutAccount(); return; }
    patchProfile(u);
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
        .select(PLAYER_SELECT)
        .eq('game_id', game.id)
        .order('created_at', { ascending: true });
      
      if (pErr) throw pErr;
      return withLiveAvatars(players);
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
      if (currentUser?.id && (!newOrExistingPlayer.user_id || newOrExistingPlayer.user_id === currentUser.id)) rejoinUpdate.user_id = currentUser.id;
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

      // Log every player-to-player transfer into the pair's chat as a payment card
      // (Messages renders these like Apple Pay in iMessage). Payment cards never
      // raise a notification or count as unread on their own; only an attached
      // note pings the recipient, via has_new_messenger above.
      {
        const note = String(opts?.description || '').trim();
        const actorName = actor?.name || 'Unknown';
        const playerTransfers = (meData || []).filter((me: any) => !!me?.to_player_id && (me?.amount || 0) > 0);
        if (playerTransfers.length > 0) {
          for (const tr of playerTransfers) {
            try {
              const toId = String(tr.to_player_id);
              const fromId = String(tr.from_player_id || actor_player_id);
              if (toId === fromId) continue;
              const ids = [fromId, toId].sort();

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
                  .insert([{ game_id: game.id, title: null, created_by_player_id: fromId }])
                  .select()
                  .limit(1)
                  .single();
                if (cErr) throw cErr;
                chatId = chatCreated.id;
                await supabase.from('drunkopoly_chat_members').insert([
                  { chat_id: chatId, player_id: fromId, last_read_at: new Date().toISOString() },
                  { chat_id: chatId, player_id: toId, last_read_at: null },
                ]);
              }

              await supabase.from('drunkopoly_chat_messages').insert([{
                chat_id: chatId,
                game_id: game.id,
                sender_player_id: fromId,
                body: note,
                kind: 'payment',
                meta: {
                  amount: tr.amount ?? null,
                  from: fromId,
                  to: toId,
                  actor_name: actorName,
                  type: tr.type ?? opts?.type ?? null,
                  note: note || null,
                },
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
      drunkAlert(err.message || 'Failed to collect');
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
        drunkAlert(err?.message || 'Failed to declare bankruptcy');
      }
      throw err;
    }
  };

  // Detect when the current player is the last one standing and show win screen
  const winDismissedRef = useRef(false);
  useEffect(() => {
    if (!player || player.is_bankrupt || !playersList || playersList.length < 2) return;
    if (winDismissedRef.current) return;
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

      // Increment user account total_sips if this player is linked to a user account
      if (totalCompleted > 0 && playerRow.user_id) {
        try {
          const { data: uRow } = await supabase.from('drunk_users').select('total_sips').eq('id', playerRow.user_id).limit(1).single();
          const newUserSips = (uRow?.total_sips ?? 0) + totalCompleted;
          await supabase.from('drunk_users').update({ total_sips: newUserSips }).eq('id', playerRow.user_id);
          if (currentUser?.id === playerRow.user_id) {
            persistAuthUser({ ...currentUser, total_sips: newUserSips });
          }
        } catch (userSipErr) {
          console.warn('Failed to update user total_sips', userSipErr);
        }
      }

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
        .select('pending_sips,total_sips,name,user_id')
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

      // Increment user account total_sips if this player is linked to a user account
      if (playerRow.user_id) {
        try {
          const { data: uRow } = await supabase.from('drunk_users').select('total_sips').eq('id', playerRow.user_id).limit(1).single();
          const newUserSips = (uRow?.total_sips ?? 0) + sipCount;
          await supabase.from('drunk_users').update({ total_sips: newUserSips }).eq('id', playerRow.user_id);
          if (currentUser?.id === playerRow.user_id) {
            persistAuthUser({ ...currentUser, total_sips: newUserSips });
          }
        } catch (userSipErr) {
          console.warn('Failed to update user total_sips', userSipErr);
        }
      }

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
      drunkAlert(err.message || 'Failed to start timer');
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
      drunkAlert(err.message || 'Failed to send to jail');
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
        drunkAlert("You don't have $50 to pay your way out of jail.", 'Insufficient funds');
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
      drunkAlert(err.message || 'Failed to pay to get out of jail');
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
      drunkAlert(err.message || 'Failed to use card');
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
      drunkAlert(err.message || 'Failed to stop timer');
    }
  };

  // Auto-join on mount
  useEffect(() => {
    const savedCode = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_CODE) : null;
    const savedName = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_NAME) : null;
    
    if (!restoring) return;
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
            if (currentUser?.id && (!player.user_id || player.user_id === currentUser.id)) restoreUpdate.user_id = currentUser.id;
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
                user_id: currentUser?.id || null,
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

          // Load the player list up front so the board renders fully populated
          // in one go instead of filling in after it appears.
          const players = await fetchPlayers(game.code);

          setGame(game);
          setPlayer(player);
          setPlayersList(players);
          setGameCode(game.code);
          setName((savedName ?? '').toUpperCase());
          setScreen("home");
        } catch (err) {
          console.error("Auto-join failed:", err);
          localStorage.removeItem(STORAGE_KEY_CODE);
          localStorage.removeItem(STORAGE_KEY_NAME);
        } finally {
          setLoading(false);
          setRestoring(false);
        }
      })();
    } else {
      setRestoring(false);
    }
  }, []);

  // Keep this device's player linked to the signed-in account, so everyone sees
  // the account's photo even if the player joined before signing in, signed in
  // mid-game, or changed their photo. Never takes over a player already linked
  // to a different account.
  useEffect(() => {
    if (screen !== 'home' || !player?.id || !currentUser?.id) return;
    if (player.user_id && player.user_id !== currentUser.id) return;
    const wantAvatar = currentUser.avatar_url ?? null;
    if (player.user_id === currentUser.id && (!wantAvatar || player.avatar_url === wantAvatar)) return;
    const upd: any = { user_id: currentUser.id };
    if (wantAvatar) upd.avatar_url = wantAvatar;
    const playerId = player.id;
    (async () => {
      const { error } = await supabase.from('players').update(upd).eq('id', playerId);
      if (error) { console.error('Avatar link failed', error); return; }
      setPlayer((prev: any) => (prev && prev.id === playerId ? { ...prev, ...upd } : prev));
      setPlayersList((prev) => prev.map((x: any) => (x.id === playerId ? { ...x, ...upd } : x)));
    })();
  }, [screen, player?.id, player?.user_id, player?.avatar_url, currentUser?.id, currentUser?.avatar_url]);

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
                      if (soundEnabledRef.current) {
                        try {
                          const a = new Audio('/message.mp3');
                          const p = a.play();
                          if (p && typeof p.then === 'function') p.catch(() => {});
                        } catch (e) { /* ignore audio errors */ }
                      }
                    } else {
                      toast({ title: 'New message', description: md || 'You have a new message.' });
                      if (soundEnabledRef.current) {
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
            .neq('sender_player_id', player.id)
            // Payment cards are a ledger, not mail: they never count as unread
            // on their own. A payment note still does (it pings via has_new_messenger).
            .or('kind.is.null,kind.neq.payment,body.neq.""');
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

  // Leaves the game only — the player's account stays signed in.
  const handleLogoutOfGame = async () => {
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

  // Restoring a saved session after a refresh: show the dice loader until the
  // game, player and player list are all in hand, then go straight to the board.
  if (restoring) {
    return (
      <RestoringGame
        gameCode={(() => { try { return localStorage.getItem(STORAGE_KEY_CODE); } catch { return null; } })()}
        name={(() => { try { return localStorage.getItem(STORAGE_KEY_NAME); } catch { return null; } })()}
      />
    );
  }

  // ---- Accounts --------------------------------------------------------
  // Lobby/account screens share the Drunkopoly header + footer. Everyone signs
  // in with their phone number before playing (guests can opt out per visit).
  const shellProps = {
    onOpenProfile: () => setScreen('profile'),
    onSignIn: () => setGuestMode(false),
    onSignedOut: () => setScreen('join-create'),
  };
  const onLobby = screen !== 'home';

  if (onLobby && !account.ready) {
    return (
      <AccountShell {...shellProps}>
        <Clock className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </AccountShell>
    );
  }

  if (onLobby && !currentUser && !guestMode) {
    const joining = mode === 'join' && gameCode && screen !== 'join-create';
    return (
      <AccountShell
        {...shellProps}
        hideAccount
        back={screen !== 'join-create'
          ? { label: 'Back', onClick: () => { setScreen('join-create'); setMode(null); } }
          : { label: 'Games', onClick: () => navigate('/drunk') }}
      >
        <AccountFlow
          logo
          eyebrow={joining ? <>Joining <span className="font-mono text-foreground">{gameCode}</span></> : 'Drunkopoly account'}
          onGuest={() => setGuestMode(true)}
          onDone={({ kind, firstName }) => {
            const who = firstName ? `, ${firstName}` : '';
            toast({
              title: kind === 'signin' ? `Welcome back${who}!` : kind === 'claimed' ? 'Account moved over' : `Welcome${who}!`,
              description: kind === 'claimed' ? 'Your old stats, wins and photo are now on this number.' : undefined,
            });
          }}
        />
      </AccountShell>
    );
  }

  // Step 1: Join/Create Game
  if (screen === "join-create") {
    return (
      <AccountShell {...shellProps} back={{ label: 'Games', onClick: () => navigate('/drunk') }}>
        <div className="relative w-full max-w-md">
          <h1 className="motion-safe:animate-rise" style={{ animationDelay: '140ms' }}>
            <HeroLogo className="w-full max-w-md" />
          </h1>
        </div>
        <Card className="mt-8 w-full max-w-md motion-safe:animate-rise" style={{ animationDelay: '210ms' }}>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Play
                </h2>
                <CardDescription className="mt-2">
                  Join an existing game or create a new one to get started.
                </CardDescription>
              </div>
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
                <div className="flex-1 border-t border-foreground/10" />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">or</span>
                <div className="flex-1 border-t border-foreground/10" />
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
                  <div className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground">Recent games</div>
                  <div className="flex flex-wrap gap-2">
                    {recentGames.map((c) => (
                      <Button key={c} variant="outline" className="rounded-full border-foreground/10 bg-foreground/[0.03] px-4 font-mono hover:border-brand/40" onClick={() => handleRecentClick(c)}>
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <HallOfFame supabase={supabase} className="mt-14 max-w-md" />
      </AccountShell>
    );
  }

  // Profile screen — the signed-in account, inside the lobby shell
  if (screen === 'profile' && currentUser) {
    return (
      <AccountShell {...shellProps}>
        <LobbyHero
          onBack={() => setScreen('join-create')}
          eyebrow={`@${currentUser.username}`}
          title="Your profile"
        />
        <ProfileStats onSignedOut={() => setScreen('join-create')} />
      </AccountShell>
    );
  }

  // Step 2: Enter Name
  if (screen === 'select-existing-player' && recentPlayers) {
    return (
      <AccountShell {...shellProps}>
        <LobbyHero
          eyebrow={<>Game <span className="font-mono text-foreground">{gameCode}</span></>}
          title="Who are you?"
        />
        <Card className="mt-8 w-full max-w-md motion-safe:animate-rise" style={{ animationDelay: '210ms' }}>
          <CardBand />
          <CardHeader>
            <SectionLabel>Select your name</SectionLabel>
            <CardDescription className="mt-2">Choose which player you are in game {gameCode}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {recentPlayers.map((p: any) => (
                <Button key={p.id} variant="outline" className="h-12 w-full justify-start px-4 font-display text-base font-semibold tracking-tight" onClick={() => signInAsExistingPlayer(p)}>
                  {p.name}
                </Button>
              ))}
              <div className="mt-4 border-t border-foreground/10 pt-4">
                <Button variant="ghost" className="w-full" onClick={() => setScreen('enter-name')}>Not me / Use different name</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </AccountShell>
    );
  }
  if (screen === "enter-name") {
    const signedInName = currentUser ? String(currentUser.first_name || currentUser.username || '').toUpperCase() : '';
    const continueSignedIn = async () => {
      const preferred = signedInName.replace(/[^A-Z ]+/g, '').slice(0, 15) || 'PLAYER';
      setName(preferred);
      if (mode === 'create') {
        setScreen('confirm-settings');
        return;
      }
      setError(null);
      setLoading(true);
      try {
        await joinGameWithName(preferred);
      } catch (e: any) {
        console.warn('Join failed', e);
        setError(e?.message || 'Unable to join');
      } finally {
        setLoading(false);
      }
    };
    return (
      <AccountShell {...shellProps}>
        <LobbyHero
          onBack={() => { setScreen('join-create'); setMode(null); }}
          backLabel="Back"
          eyebrow={mode === "create" ? 'New game · you host' : <>Joining <span className="font-mono text-foreground">{gameCode}</span></>}
          title="Who’s playing?"
        />
        <Card className="mt-8 w-full max-w-md motion-safe:animate-rise" style={{ animationDelay: '210ms' }}>
          <CardBand />
          <CardHeader>
            <SectionLabel>{currentUser ? 'Confirm your seat' : 'Enter your name'}</SectionLabel>
            <CardDescription className="mt-2">
              {currentUser
                ? (mode === "create" ? "You’ll host this game." : `You’re joining game ${gameCode}.`)
                : (mode === "create" ? "Create a new game and become the host." : `Joining game: ${gameCode}`)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentUser ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setScreen('profile')}
                  className="flex w-full items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-left shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition-colors hover:border-brand/40"
                >
                  <PlayerAvatar player={currentUser} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-semibold tracking-tight">
                      {(currentUser.first_name || currentUser.username)}{currentUser.last_name ? ` ${currentUser.last_name}` : ''}
                    </div>
                    <div className="truncate font-mono text-xs text-muted-foreground">@{currentUser.username}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                <Button className="w-full py-4 text-base font-semibold" size="lg" type="button" disabled={loading} onClick={continueSignedIn}>
                  {loading ? 'Please wait...' : `Continue as ${currentUser.first_name || currentUser.username}`}
                </Button>
                {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20">{error}</div>}
                <button
                  type="button"
                  onClick={async () => { await signOutAccount(); toast({ title: 'Signed out' }); }}
                  className="block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Not you? Switch account
                </button>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const cleaned = (name ?? '').trim();
                  if (!cleaned) return;
                  if (!/^[A-Z ]{1,15}$/.test(cleaned)) {
                    setError('Name must be letters and spaces only (max 15 characters)');
                    return;
                  }
                  setError(null);
                  if (mode === "create") {
                    setScreen("confirm-settings");
                    return;
                  }
                  setLoading(true);
                  try {
                    await joinGameWithName(cleaned);
                  } catch (err: any) {
                    console.error("Join error:", err);
                    setError(err.message || "Unexpected error");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => {
                    const filtered = (e.target.value ?? '').toUpperCase().replace(/[^A-Z ]+/g, '').slice(0, 10);
                    setName(filtered);
                  }}
                  maxLength={10}
                  autoFocus
                />
                <Button className="w-full" type="submit" disabled={!/^[A-Z ]{1,10}$/.test((name || '').trim()) || loading}>
                  {loading ? "Please wait..." : "Continue as guest"}
                </Button>
                {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20">{error}</div>}
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-sm text-muted-foreground">
                  Guests don’t keep stats, wins or a photo.{' '}
                  <button type="button" onClick={() => setGuestMode(false)} className="font-medium text-foreground underline-offset-4 hover:underline">
                    Sign in with your phone number
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </AccountShell>
    );
  }

  // Step 2b: Confirm Settings (only for creating a new game)
  if (screen === "confirm-settings") {
    // allow non-negative integers (0 and positive integers), no decimals
    const isNonNegativeInteger = (s: string) => /^\d+$/.test(s) && Number(s) >= 0;
    const canCreate = isNonNegativeInteger(tempInitialBalance) && isNonNegativeInteger(tempPassGoAmount) && isNonNegativeInteger(tempFreeParkingBalance);

    return (
      <AccountShell {...shellProps}>
        <div className="w-full max-w-md">
          <Button variant="ghost" className={`${BACK_PILL_CLASS} h-auto motion-safe:animate-rise`} onClick={() => { setScreen('enter-name'); }} aria-label="Back to name">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <p
            className="mt-8 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground motion-safe:animate-rise"
            style={{ animationDelay: '70ms' }}
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
            New game · house rules
          </p>
          <h1
            className="mt-3 pb-2 font-display text-4xl font-bold leading-[0.95] tracking-tight text-foreground sm:text-5xl motion-safe:animate-rise"
            style={{ animationDelay: '140ms' }}
          >
            Set the table
          </h1>
        </div>
        <Card className="mt-8 w-full max-w-md motion-safe:animate-rise" style={{ animationDelay: '210ms' }}>
          <CardBand />
          <CardHeader>
            <SectionLabel>Confirm Game Settings</SectionLabel>
            <CardDescription className="mt-2">Set starting balances and game options before creating the game.</CardDescription>
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
              <SectionLabel>Money</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                <label className={META_LABEL_CLASS}>Starting Balance</label>
                <Input
                  type="number"
                  min={0}
                  value={tempInitialBalance}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^[0-9]*$/.test(v)) setTempInitialBalance(v);
                  }}
                />

                <label className={`${META_LABEL_CLASS} mt-1`}>Pass Go Amount</label>
                <Input
                  type="number"
                  min={0}
                  value={tempPassGoAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^[0-9]*$/.test(v)) setTempPassGoAmount(v);
                  }}
                />

                <label className={`${META_LABEL_CLASS} mt-1`}>Free Parking Starting Pot</label>
                <Input
                  type="number"
                  min={0}
                  value={tempFreeParkingBalance}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^[0-9]*$/.test(v)) setTempFreeParkingBalance(v);
                  }}
                />
              </div>

              <SectionLabel className="pt-2">Rules</SectionLabel>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                  <div className="flex-1">
                    <div className="font-display font-semibold text-sm tracking-tight">Show Player Balances</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Allow players to see each other's money</div>
                  </div>
                  <Switch
                    checked={tempShowBalances}
                    onCheckedChange={(checked) => setTempShowBalances(checked)}
                  />
                </div>
                <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                  <div className="flex-1">
                    <div className="font-display font-semibold text-sm tracking-tight">Play With Sips</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Enable sip counters and Give Sips features</div>
                  </div>
                  <Switch
                    checked={tempSipsEnabled}
                    onCheckedChange={(checked) => setTempSipsEnabled(checked)}
                  />
                </div>
                <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                  <div className="flex-1">
                    <div className="font-display font-semibold text-sm tracking-tight">Gambling</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Lets players gamble Pass Go or Free Parking on a roulette spin</div>
                  </div>
                  <Switch
                    checked={tempGamblingEnabled}
                    onCheckedChange={(checked) => setTempGamblingEnabled(checked)}
                  />
                </div>
                <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                  <div className="flex-1">
                    <div className="font-display font-semibold text-sm tracking-tight">Expansion Pack</div>
                    <div className="text-xs text-muted-foreground mt-0.5">When enabled, all payments to the bank go into Free Parking</div>
                  </div>
                  <Switch
                    checked={tempExpansionEnabled}
                    onCheckedChange={(checked) => setTempExpansionEnabled(checked)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" size="lg" className="flex-1 text-base font-semibold" disabled={!canCreate || loading}>{loading ? 'Creating...' : 'Create Game'}</Button>
              </div>
              {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive ring-1 ring-inset ring-destructive/20">{error}</div>}
            </form>
          </CardContent>
        </Card>
      </AccountShell>
    );
  }

  // Step 3: Home (main game screen)
  const headerIsland = headerScrolled || balanceDocked;
  const showDockedBalance = balanceDocked && !player?.is_bankrupt;
  const passGoAmount = Number(game?.pass_go_amount ?? 200);
  const tradeTimerSecs = Number(game?.trade_timer_seconds ?? 60);
  const tradeTimerLabel = tradeTimerSecs >= 60 && tradeTimerSecs % 60 === 0 ? `${tradeTimerSecs / 60} min` : `${tradeTimerSecs} sec`;
  const openTradeTimer = () => {
    setTradeTimerSelected(tradeTimerSecs);
    setTradeTimerModalOpen(true);
  };
  return (
    <div className="min-h-screen bg-gradient-bg flex flex-col" style={sipsOverlayOpen ? { paddingBottom: `${110 + Math.min(sipBatches.length - 1, 2) * 10}px` } : undefined}>
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="max-w-md flex flex-col" style={{ maxHeight: 'calc(100dvh - 48px)' }}>
          <DialogHeader className="shrink-0">
            <DialogTitle>{currentUser ? 'Your profile' : 'Sign in'}</DialogTitle>
          </DialogHeader>
          <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-1">
            {currentUser ? (
              <ProfilePanel onSignedOut={() => setAccountDialogOpen(false)} />
            ) : (
              <div className="[&>div]:mt-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none">
                <AccountFlow
                  compact
                  onDone={({ kind, firstName }) => {
                    setAccountDialogOpen(false);
                    toast({
                      title: kind === 'claimed' ? 'Account moved over' : `Signed in${firstName ? ` as ${firstName}` : ''}`,
                      description: 'This seat is now linked to your account.',
                    });
                  }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
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
      {/* Top bar: full-width at the top, floating island once scrolled (mirrors SiteHeader). */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[padding] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          headerIsland ? "px-3 pt-3 sm:px-6" : "px-0 pt-0",
        )}
      >
        <div
          className={cn(
            "mx-auto overflow-hidden border transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            headerIsland
              ? "max-w-3xl rounded-2xl border-foreground/10 bg-background/55 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.55),inset_0_1px_0_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl backdrop-saturate-150"
              : "max-w-5xl rounded-none border-transparent bg-transparent",
          )}
        >
        <div
          className={cn(
            "flex items-center justify-between gap-2 transition-all duration-500",
            headerIsland ? "py-2 pl-3 pr-2" : "py-3 pl-4 pr-3 sm:pl-6 sm:pr-5",
          )}
        >
        <div className="flex min-w-0 items-center gap-2">
            <div
              className="flex min-w-0 items-center gap-2.5"
            >
              <LiveDot />
              <div className="truncate font-display font-semibold text-lg tracking-tight">{player?.name ?? name}</div>
              {(game?.sips_enabled ?? true) && (
                <div
                  className="relative flex h-8 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-foreground/10 bg-foreground/[0.03] px-2.5 text-xs after:absolute after:-inset-1 after:content-[''] text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                  onClick={() => setSipLeaderboardOpen(true)}
                >
                  <span className="font-board font-semibold tabular-nums text-foreground">{(player?.total_sips ?? 0)}</span> sips
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
          {!isNarrow && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/drunk/drunkopoly/rules')}>Rules</Button>
          )}
          {/* Messages moved into the code popover; header icon removed for a cleaner UI */}
          <GameCodePopover
            code={game?.code ?? gameCode}
            onLogout={handleLogoutOfGame}
            onOpenAccount={() => setAccountDialogOpen(true)}
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

        {/* Docked balance: expands out of the island's bottom edge once the big card scrolls away */}
        <div
          aria-hidden={!showDockedBalance}
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            showDockedBalance ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <button
              type="button"
              tabIndex={showDockedBalance ? 0 : -1}
              onClick={() => balanceCardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="flex w-full items-center justify-between gap-3 border-t border-foreground/10 py-2 pl-3 pr-4 text-left"
            >
              <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
                Balance
              </span>
              <span className="font-display text-xl font-bold tracking-tight">
                <AnimatedNumber
                  compact
                  value={player?.balance ?? game?.initial_balance ?? 1500}
                  soundEnabled={false}
                  maskIfGameHidden={!((game && game.show_balances) ?? true)}
                  gameCode={game?.code ?? null}
                />
              </span>
            </button>
          </div>
        </div>
        </div>
      </header>
      {/* Spacer for the fixed header */}
      <div aria-hidden className="h-[4.25rem] shrink-0" />
      {/* Decorative property-colour strip under the header */}
      <ColorBand className="pointer-events-none mx-auto h-0.5 w-full max-w-[12rem] opacity-60" />

      <div className="flex flex-col items-center w-full max-w-md sm:max-w-xl mx-auto px-4 pt-6 pb-8 sm:px-6">
        {player?.is_bankrupt ? (
          /* Ghost Mode UI for bankrupt players */
          <>
            <div className="mb-8 w-full text-center">
              <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground motion-safe:animate-rise">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                Ghost mode
              </p>
              <div
                className="mt-3 pb-1 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl motion-safe:animate-rise"
                style={{ animationDelay: '70ms' }}
              >
                You are bankrupt
              </div>
              <div className="mx-auto mt-3 text-sm text-muted-foreground max-w-sm motion-safe:animate-rise" style={{ animationDelay: '140ms' }}>
                You can monitor the game and use actions like trade timers and jail but you cannot participate in payments.
              </div>
            </div>

            {/* Show all players' balances (override show_balances setting for ghosts) */}
            <Section title="Player Balances" className="mt-2">
              <div className="grid grid-cols-1 gap-2 w-full">
                {playersList
                  .filter((p: any) => !p.is_bankrupt)
                  .sort((a: any, b: any) => (b.balance ?? 0) - (a.balance ?? 0))
                  .map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] w-full">
                      <div className="truncate font-display font-semibold tracking-tight">{p.name}</div>
                      <div className="shrink-0 font-display text-lg font-bold tabular-nums tracking-tight">${(p.balance ?? 0).toLocaleString()}</div>
                    </div>
                  ))}
              </div>
            </Section>

            {/* Ghost mode can still give sips if enabled */}
            {(game?.sips_enabled ?? true) && (
              <Board className="mt-8">
                <WideSpace band="yellow" art={ART.sips} title="Give Sips" value="Hand out drinks to other players" onClick={() => setSipModalOpen(true)} />
              </Board>
            )}

            {/* Ghost mode can still use actions */}
            <Board title="Actions" className="mt-6">
              <BoardSpace art={ART.tradeTimer} label="Trade Timer" showLabel={false} value={tradeTimerLabel} onClick={openTradeTimer} />
              <BoardSpace art={ART.police} label="Jail" value="Send a player" onClick={() => setJailModalOpen(true)} />
              <BoardSpace icon={<Info />} label="Stats" value="Your game" onClick={() => setBankruptStatusOpen(true)} />
            </Board>
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
            {/* Balance, set like a title deed: inverted header strip inside a double rule */}
            <div ref={setBalanceCardEl} className="relative mb-6 w-full rounded-[6px] border-2 border-foreground/70 bg-background p-1.5 motion-safe:animate-rise">
              <div className="border border-foreground/25">
                <div className="bg-foreground py-1.5 text-center font-board text-[12px] font-semibold uppercase leading-none tracking-[0.32em] text-background">
                  Current Balance
                </div>
                <div className="flex justify-center px-4 py-1">
                  <MoneyOrbitals transactionMeta={transactionMeta}>
                    <div className="px-6 py-2 text-center font-board text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">
                      <AnimatedNumber
                        value={player?.balance ?? game?.initial_balance ?? 1500}
                        soundEnabled={soundEnabled}
                        maskIfGameHidden={!((game && game.show_balances) ?? true)}
                        gameCode={game?.code ?? null}
                      />
                    </div>
                  </MoneyOrbitals>
                </div>
              </div>
            </div>

            {/* Sips (hidden when sips_enabled is false) */}
            {(game?.sips_enabled ?? true) && (
              <Board className="mb-6 motion-safe:animate-rise" style={{ animationDelay: '60ms' }}>
                <WideSpace band="yellow" art={ART.sips} title="Give Sips" value="Hand out drinks to other players" onClick={() => setSipModalOpen(true)} />
              </Board>
            )}

            <Board title="Pay" note="Money out" className="motion-safe:animate-rise" style={{ animationDelay: '120ms' }}>
              <BoardSpace band="red" art={ART.bank} label="Pay Bank" showLabel={false} value="Property & fees" onClick={() => { setPayMode("bank"); setPayModalOpen(true); }} />
              <BoardSpace band="red" art={ART.players} label="Pay Players" showLabel={false} value="Rent & deals" onClick={() => { setPayMode("players"); setPayModalOpen(true); }} />
              <BoardSpace band="red" art={ART.tax} label="Tax" value="To Parking" onClick={() => { setPayMode("tax"); setPayModalOpen(true); }} />
            </Board>

            <Board title="Collect" note="Money in" className="mt-6 motion-safe:animate-rise" style={{ animationDelay: '180ms' }}>
              <BoardSpace band="green" art={ART.money} label="Bank" value="Sales & payouts" onClick={() => { setCollectMode('bank'); setCollectModalOpen(true); }} />
              <BoardSpace
                band="green"
                art={ART.passGo}
                label="Pass Go"
                showLabel={false}
                value={`+$${passGoAmount.toLocaleString()}`}
                onClick={() => { setCollectMode('pass_go'); setCollectModalOpen(true); }}
              />
              <BoardSpace
                band="green"
                art={ART.freeParking}
                label="Free Parking"
                showLabel={false}
                value={`Pot $${Number(freeParkingPot || 0).toLocaleString()}`}
                onClick={() => { setCollectMode('free_parking'); setCollectModalOpen(true); }}
              />
            </Board>

            <Board title="Actions" cols={2} className="mt-6 motion-safe:animate-rise" style={{ animationDelay: '240ms' }}>
              <BoardSpace art={ART.tradeTimer} label="Trade Timer" showLabel={false} value={tradeTimerLabel} className="aspect-[5/4]" onClick={openTradeTimer} />
              <BoardSpace art={ART.police} label="Jail" value="Send a player" className="aspect-[5/4]" onClick={() => setJailModalOpen(true)} />
              <BoardLine tone="danger" onClick={() => setBankruptModalOpen(true)}>Declare Bankruptcy</BoardLine>
            </Board>
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
                  drunkAlert(msg);
                }
                setInsufficientFundsFlash(true);
                window.setTimeout(() => setInsufficientFundsFlash(false), 900);
              } else {
                try { toast({ title: 'Payment failed', description: msg }); } catch (e) { drunkAlert(msg); }
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
              drunkAlert(err.message || 'Failed to assign sips');
            }
          }}
        />

        <Dialog open={tradeTimerModalOpen} onOpenChange={(v) => setTradeTimerModalOpen(v)}>
          <DialogContent>
            <div>
              <DialogHeader className="items-center sm:items-start">
                <img src={ART.tradeTimer} alt="" aria-hidden draggable={false} className="mb-2 h-20 w-auto max-w-[70%] select-none object-contain" />
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
              try { toast({ title: 'Action failed', description: msg }); } catch (e) { drunkAlert(msg); }
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
                try { toast({ title: 'Insufficient funds', description: "You don't have enough money to complete this payment.", variant: 'destructive' }); } catch (e) { drunkAlert(msg); }
                setInsufficientFundsFlash(true);
                window.setTimeout(() => setInsufficientFundsFlash(false), 900);
              } else {
                try { toast({ title: 'Payment failed', description: msg }); } catch (e) { drunkAlert(msg); }
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
                try { toast({ title: 'Insufficient funds', description: "You don't have enough money to complete this payment.", variant: 'destructive' }); } catch (e) { drunkAlert(msg); }
                setInsufficientFundsFlash(true);
                window.setTimeout(() => setInsufficientFundsFlash(false), 900);
              } else {
                try { toast({ title: 'Payment failed', description: msg }); } catch (e) { drunkAlert(msg); }
              }
            }
          }}
          onOpenCollect={() => { setCollectModalOpen(true); setCollectMode('bank'); }}
          onCollect={handleCollect}
        />

        {/* Win overlay — shown when this player is the last one standing */}
        {gameWon && (
          <div className="fixed inset-0 z-[100001] pointer-events-auto overflow-auto bg-background">
            <div className="min-h-screen flex items-center justify-center px-6 py-12">
              <div className="max-w-sm w-full text-center">
                <DeedFan className="pointer-events-none mx-auto mb-6 h-28 w-32 motion-safe:animate-rise" />
                <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground motion-safe:animate-rise" style={{ animationDelay: '70ms' }}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
                  <span aria-hidden>🏆</span> Last one standing
                </p>
                <h1 className="mt-3 mb-3 pb-1 font-display text-5xl font-bold tracking-tight text-foreground motion-safe:animate-rise" style={{ animationDelay: '140ms' }}>You Won!</h1>
                <p className="text-lg mb-1 text-foreground">
                  Everyone else has gone bankrupt.
                </p>
                <ColorBand className="pointer-events-none mx-auto my-5 h-1 max-w-[12rem]" />
                <div className="mb-8 rounded-2xl border border-foreground/10 bg-foreground/[0.03] px-4 py-4 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)]">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Final balance</div>
                  <div className="mt-1 font-display text-4xl font-bold tracking-tight tabular-nums text-foreground">${(player?.balance ?? 0).toLocaleString()}</div>
                </div>
                <button
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-primary text-primary-foreground text-lg font-semibold shadow-[inset_0_1px_0_0_hsl(var(--primary-foreground)/0.12)] transition hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => { winDismissedRef.current = true; setGameWon(false); }}
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
              drunkAlert(err.message || 'Failed to complete sips');
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
                try { toast({ title: 'Insufficient funds', description: "You don't have enough money to complete this payment.", variant: 'destructive' }); } catch (e) { drunkAlert(msg); }
                setInsufficientFundsFlash(true);
                window.setTimeout(() => setInsufficientFundsFlash(false), 900);
              } else {
                try { toast({ title: 'Payment failed', description: msg }); } catch (e) { drunkAlert(msg); }
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
    <div className={`w-full flex flex-col ${className}`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="font-board text-[13px] font-semibold uppercase tracking-[0.22em] text-foreground">
          {title}
        </div>
        <div aria-hidden className="h-px flex-1 bg-foreground/10" />
      </div>
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

const BALANCE_VISIBILITY_EVENT = 'drunkopoly:balance-visibility';

function AnimatedNumber({ value, soundEnabled = true, maskIfGameHidden = false, gameCode, compact = false }: { value: number; soundEnabled?: boolean; maskIfGameHidden?: boolean; gameCode?: string | null; compact?: boolean }) {
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

  // Keep every instance (big balance card + compact header copy) in sync when
  // the user toggles their local balance visibility.
  useEffect(() => {
    const onVis = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string; shown: boolean }>).detail;
      if (detail?.key === storageKey) setLocalShown(detail.shown);
    };
    window.addEventListener(BALANCE_VISIBILITY_EVENT, onVis);
    return () => window.removeEventListener(BALANCE_VISIBILITY_EVENT, onVis);
  }, [storageKey]);

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
    if (end > start && soundEnabled && !compact) {
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

  const styleToUse = compact ? baseStyle : bump === 'up' ? upStyle : bump === 'down' ? downStyle : baseStyle;
  // Use either the internal bump state OR the external flash prop
  // to determine color so external flashes (from payments) always reflect
  // increase/decrease visually even if the internal animation timing differs.
  const isUp = bump === 'up';
  const isDown = bump === 'down';
  const colorClass = isUp ? 'text-green-400' : isDown ? 'text-destructive' : 'text-foreground';

  // Inline hex color to ensure it overrides any inherited text color
  const colorHex = isUp ? '#34D399' /* green-400 */ : isDown ? '#EF4444' /* red-500 */ : undefined;

  const isMasked = maskIfGameHidden && !localShown;

  return (
    <div aria-live="polite" className="relative inline-flex items-baseline gap-1">
      <div
        className={`inline-flex items-baseline gap-1`} 
        style={{
          transition: 'filter 220ms ease, opacity 220ms',
          filter: isMasked ? `blur(${compact ? 6 : 14}px) saturate(.85)` : 'none',
        }}
      >
        <span className={`${compact ? 'text-[0.7em]' : 'text-2xl'} align-baseline ${colorClass} ${!isUp && !isDown ? 'opacity-70' : ''}`} style={{ ...styleToUse, color: colorHex }}>{"$"}</span>
        <span className={`${compact ? '' : 'pb-1'} align-baseline ${colorClass}`} style={{ ...styleToUse, fontVariantNumeric: 'tabular-nums', color: colorHex }}>{formatted}</span>
      </div>

      {maskIfGameHidden && !compact ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            try {
              const next = !localShown;
              setLocalShown(next);
              window.dispatchEvent(new CustomEvent(BALANCE_VISIBILITY_EVENT, { detail: { key: storageKey, shown: next } }));
              if (typeof window !== 'undefined') localStorage.setItem(storageKey, String(next));
            } catch (err) {
              // ignore storage errors
            }
          }}
          aria-pressed={localShown}
          aria-label={localShown ? 'Hide balance' : 'Show balance'}
          title={localShown ? 'Hide balance' : 'Show balance'}
          className="drunk-eye-toggle inline-flex items-center justify-center -ml-4 mt-8 w-10 h-10 rounded-full border border-foreground/10 bg-background/60 text-muted-foreground backdrop-blur-xl shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6),inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition duration-150 hover:-translate-y-1 hover:border-brand/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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

function GameCodePopover({ code, onLogout, onOpenAccount, players, currentPlayer, game, onRemovePlayer, soundEnabled, onToggleSound, showBalances = true, onToggleShowBalances, onToggleSipsEnabled, onToggleExpansion, onToggleGambling, showRulesInPopover,
  // centralized commissioner state/handlers from parent
  commPinOpen, setCommPinOpen, commToolsOpen, setCommToolsOpen, commPinValue, setCommPinValue, commUnlocked, openCommissionerTools, tryUnlockCommissionerTools, setCommUnlockedUntil, hasCommissionerAccess
}: { code: string; onLogout?: () => void; onOpenAccount?: () => void; players?: any[]; currentPlayer?: any; game?: any; onRemovePlayer?: (id: string) => Promise<void>; soundEnabled?: boolean; onToggleSound?: (enabled: boolean) => void; showBalances?: boolean; onToggleShowBalances?: (enabled: boolean) => void; onToggleSipsEnabled?: (enabled: boolean) => void; onToggleExpansion?: (enabled: boolean) => void; onToggleGambling?: (enabled: boolean) => void; showRulesInPopover?: boolean; commPinOpen: boolean; setCommPinOpen: (v:boolean)=>void; commToolsOpen: boolean; setCommToolsOpen: (v:boolean)=>void; commPinValue: string; setCommPinValue: (v:string)=>void; commUnlocked: boolean; openCommissionerTools: ()=>void; tryUnlockCommissionerTools: ()=>void; setCommUnlockedUntil: (n:number)=>void; hasCommissionerAccess: ()=>boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsOpenSection, setSettingsOpenSection] = useState<'game' | 'players' | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<{ id: string; name?: string } | null>(null);
  const [commSelectedPlayerId, setCommSelectedPlayerId] = useState<string>('');
  const [commBalanceMode, setCommBalanceMode] = useState<'set' | 'delta'>('delta');
  const [commBalanceValue, setCommBalanceValue] = useState<string>('');
  const [commPendingSipsValue, setCommPendingSipsValue] = useState<string>('');
  const [menuOpen, setMenuOpen] = useState(false);
  const { profile: accountProfile } = useDrunkAccount();
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
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2 pl-1.5 pr-3 font-mono text-sm font-bold uppercase tracking-widest text-foreground"
        >
          {accountProfile ? (
            <PlayerAvatar player={{ name: accountProfile.first_name || accountProfile.username, avatar_url: accountProfile.avatar_url }} size="sm" />
          ) : null}
          {code}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        {/* Account: profile for signed-in players, a sign-in prompt for guests */}
        <button
          type="button"
          onClick={() => { setMenuOpen(false); onOpenAccount?.(); }}
          className="mb-1 flex w-full items-center gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-2 text-left transition-colors hover:border-brand/40"
        >
          {accountProfile ? (
            <>
              <PlayerAvatar player={{ name: accountProfile.first_name || accountProfile.username, avatar_url: accountProfile.avatar_url }} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-semibold tracking-tight text-foreground">
                  {[accountProfile.first_name, accountProfile.last_name].filter(Boolean).join(' ') || accountProfile.username}
                </div>
                <div className="truncate font-mono text-xs text-muted-foreground">@{accountProfile.username}</div>
                <div className="text-[11px] text-muted-foreground">View profile & stats</div>
              </div>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-foreground/[0.03] text-muted-foreground"><UserRound size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">Playing as guest</div>
                <div className="text-[11px] text-muted-foreground">Sign in to save stats & photo</div>
              </div>
            </>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <div className="px-2 pt-1 pb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
          Game <span className="font-mono text-foreground">{code}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <Button variant="ghost" className="w-full h-11 justify-start gap-3 px-2 text-foreground" onClick={() => setQrCodeOpen(true)}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-inset ring-brand/20"><QrCode size={16} /></span>
            QR Code
          </Button>
          <Button variant="ghost" className="w-full h-11 justify-start gap-3 px-2 text-foreground" onClick={handleCopyInvite}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-inset ring-brand/20"><Copy size={16} /></span>
            Invite Link
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11 justify-start gap-3 px-2 text-foreground"
            onClick={() => {
              setQrCodeOpen(false);
              setSettingsOpen(false);
              navigate('/drunk/drunkopoly/messages');
            }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-inset ring-brand/20"><MessagesSquare size={16} /></span>
            Messages
          </Button>
          <Button variant="ghost" className="w-full h-11 justify-start gap-3 px-2 text-foreground" onClick={() => setSettingsOpen(true)}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-inset ring-brand/20"><Settings size={16} /></span>
            Settings
          </Button>
          <div aria-hidden className="my-1 h-px bg-foreground/10" />
          <Button variant="ghost" className="w-full h-11 justify-start gap-3 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onLogout}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20"><LogOut size={16} /></span>
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
          <div className="bg-white p-3 rounded-2xl shadow-[0_24px_60px_-20px_rgb(0_0_0/0.75)] ring-1 ring-foreground/10">
            <QRCodeSVG 
              value={`${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(code)}`} 
              size={256}
              level="H"
              includeMargin={true}
            />
          </div>
          <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground mt-5">
            Scan this code to join the game
          </p>
          <p className="text-center font-mono font-bold text-2xl tracking-[0.2em] mt-2">
            {code}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => setQrCodeOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-lg flex flex-col" style={{ maxHeight: 'calc(100dvh - 160px)' }}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2 overflow-y-auto flex-1 pr-1">
          <div>
            <button
              type="button"
              onClick={() => setSettingsOpenSection((v) => (v === 'game' ? null : 'game'))}
              className="w-full min-h-[56px] flex items-center justify-between gap-3 p-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-expanded={settingsOpenSection === 'game'}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-display font-semibold tracking-tight">Game Settings</div>
                  <div className="text-sm text-muted-foreground">App-wide game options</div>
                </div>
              </div>
              <ChevronDown
                className="w-5 h-5 shrink-0 text-muted-foreground transform-gpu"
                style={{ transform: settingsOpenSection === 'game' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
              />
            </button>

            {settingsOpenSection === 'game' && (
              <div className="mt-3 px-0">
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 space-y-2">

                  <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                    <div className="flex-1">
                      <div className="font-display font-semibold text-sm tracking-tight">App Sounds</div>
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
                      <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                        <div className="flex-1">
                          <div className="font-display font-semibold text-sm tracking-tight">Show Player Balances</div>
                          <div className="text-xs text-muted-foreground">Allow players to see each other's money</div>
                        </div>
                        <Switch
                          checked={!!(game?.show_balances ?? showBalances)}
                          onCheckedChange={(checked) => { if (onToggleShowBalances) onToggleShowBalances(checked); }}
                        />
                      </div>
                      <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                        <div className="flex-1">
                          <div className="font-display font-semibold text-sm tracking-tight">Play With Sips</div>
                          <div className="text-xs text-muted-foreground">Enable sip counters and Give Sips features</div>
                        </div>
                        <Switch
                          checked={!!(game?.sips_enabled ?? true)}
                          onCheckedChange={(checked) => { if (onToggleSipsEnabled) onToggleSipsEnabled(checked); }}
                        />
                      </div>
                      <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                        <div className="flex-1">
                          <div className="font-display font-semibold text-sm tracking-tight">Gambling</div>
                          <div className="text-xs text-muted-foreground">Lets players gamble Pass Go or Free Parking on a roulette spin</div>
                        </div>
                        <Switch
                          checked={!!(game?.gambling_enabled ?? false)}
                          onCheckedChange={(checked) => { if (onToggleGambling) onToggleGambling(checked); }}
                        />
                      </div>
                      <div className="flex min-h-[56px] items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                        <div className="flex-1">
                          <div className="font-display font-semibold text-sm tracking-tight">Expansion Pack</div>
                          <div className="text-xs text-muted-foreground">Route payments to the bank into Free Parking</div>
                        </div>
                        <Switch
                          checked={!!(game?.expansion_enabled ?? false)}
                          onCheckedChange={(checked) => { if (onToggleExpansion) onToggleExpansion(checked); }}
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
              className="w-full min-h-[56px] flex items-center justify-between gap-3 p-3 rounded-xl border border-foreground/10 bg-foreground/[0.03] shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-expanded={settingsOpenSection === 'players'}
            >
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <div className="font-display font-semibold tracking-tight">Players</div>
                  <div className="text-sm text-muted-foreground">Manage players in this game</div>
                </div>
              </div>
              <ChevronDown
                className="w-5 h-5 shrink-0 text-muted-foreground transform-gpu"
                style={{ transform: settingsOpenSection === 'players' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms ease-in-out', willChange: 'transform' }}
              />
            </button>

            {settingsOpenSection === 'players' && (
              <div className="mt-3 px-0">
                <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 space-y-2">
                  <div className="space-y-2">
                    {(players && players.length > 0) ? (
                      players.map((p: any) => {
                          const isSelf = currentPlayer && String(currentPlayer.id) === String(p.id);
                          const isCommissioner = !!p.is_commissioner;
                          // Only the current commissioner may remove other players.
                          const canRemove = !!(currentPlayer && currentPlayer.is_commissioner) && !isCommissioner && !isSelf;
                        const canSeeBalance = showBalances;
                        return (
                          <div key={p.id} className="flex items-center gap-3 py-2 px-3 rounded-xl border border-foreground/10 bg-foreground/[0.03]">
                            <PlayerAvatar player={p} size="md" />
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-display font-semibold tracking-tight">{p.name}{isCommissioner ? ' • Commissioner' : isSelf ? ' • You' : ''}</div>
                              {canSeeBalance && (
                                <div className="text-xs text-muted-foreground tabular-nums">Balance: ${Number(p.balance || 0).toLocaleString()}</div>
                              )}
                            </div>
                            <div>
                              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive" disabled={!canRemove} onClick={() => requestRemove(p.id, p.name)}>
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

        <DialogFooter className="shrink-0">
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
          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Target Player</div>
            <select
              className="w-full h-10 px-3 rounded-xl border border-foreground/10 bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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

          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Adjust Balance</div>
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
              <Button size="sm" variant="secondary" className="h-10 shrink-0 font-mono" onClick={() => {
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

          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Set Pending Sips</div>
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
          <AlertDialogAction onClick={handleConfirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
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
      <div>
        <DialogHeader>
          <DialogTitle>Payment Blocked</DialogTitle>
        </DialogHeader>
        <div className="my-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-foreground ring-1 ring-inset ring-destructive/20">{blockedPaymentMessage}</div>
        <DialogFooter>
          <Button onClick={() => setBlockedPaymentMessage(null)}>OK</Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
);
