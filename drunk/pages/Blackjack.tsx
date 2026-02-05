import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { Copy, QrCode, Users, Crown, DollarSign, Plus, Minus, Play, Clock, Check, X } from "lucide-react";
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from "react-router-dom";
import { toast } from "../components/ui/use-toast";
import { Toaster } from "../components/ui/toaster";
import JoinCreateScreen from "../components/blackjack/JoinCreateScreen";
import EnterNameScreen from "../components/blackjack/EnterNameScreen";
import ConfirmSettingsScreen from "../components/blackjack/ConfirmSettingsScreen";
import LobbyScreen from "../components/blackjack/LobbyScreen";
import DealerGameView from "../components/blackjack/DealerGameView";
import PlayerGameView from "../components/blackjack/PlayerGameView";
import { BlackjackHeader } from "../components/blackjack/BlackjackHeader";

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CARDS_PER_DECK = 52;
const RESHUFFLE_THRESHOLD_PERCENT = 25;

type Screen = "join-create" | "enter-name" | "confirm-settings" | "lobby" | "game";
type GameStatus = "lobby" | "betting" | "dealing" | "insurance" | "playing" | "dealer_turn" | "resolving" | "finished" | "table_idle";

// Types for our data
interface BlackjackGame {
  id: string;
  code: string;
  name: string;
  status: GameStatus;
  dealer_id: string | null;
  current_round_id: string | null;
  remaining_cards: string[];
  discard_pile: string[];
  dealer_hand: string[];
  dealer_visible_card: string | null;
  dealer_status: string;
  turn_order: string[];
  current_turn_index: number | null;
  last_reshuffle_at?: string | null;
  settings: {
    num_decks: number;
    hit_on_soft_17: boolean;
    blackjack_payout: number;
    insurance_enabled: boolean;
    double_down_enabled: boolean;
    split_enabled: boolean;
    max_splits: number;
    min_bet: number;
    max_bet: number;
    bet_increments: number[];
  };
}

interface BlackjackPlayer {
  id: string;
  game_id: string;
  name: string;
  is_dealer: boolean;
  is_online: boolean;
  seat_position: number | null;
  balance: number;
  total_bought_in: number;
  current_bet: number;
  has_placed_bet: boolean;
  // Stats
  hands_played: number;
  hands_won: number;
  hands_lost: number;
  blackjacks: number;
  times_hit: number;
  times_stood: number;
  times_doubled: number;
  times_split: number;
  times_surrendered: number;
  times_insurance: number;
  hands_pushed: number;
  busts: number;
  total_won: number;
  total_lost: number;
  total_wagered: number;
  biggest_win: number;
  biggest_bet: number;
  current_streak: number;
  best_streak: number;
  worst_streak: number;
}

interface ChipRequest {
  id: string;
  player_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface BlackjackHand {
  id: string;
  round_id: string;
  player_id: string;
  hand_index: number;
  cards: string[];
  bet_amount: number;
  insurance_bet: number;
  status: string;
  is_active: boolean;
  result: string | null;
  payout: number;
}

const Blackjack = () => {
  const STORAGE_KEY_CODE = "blackjack:gameCode";
  const STORAGE_KEY_NAME = "blackjack:name";
  const STORAGE_KEY_RECENT = "blackjack:recentGames";
  const STORAGE_KEY_PLAYER_ID = "blackjack:playerId";

  const [screen, setScreen] = useState<Screen>("join-create");
  const [gameCode, setGameCode] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"join" | "create" | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Settings for new game
  const [tempDealerStandsOnSoft17, setTempDealerStandsOnSoft17] = useState<boolean>(true);
  const [tempInsuranceEnabled, setTempInsuranceEnabled] = useState<boolean>(true);
  const [tempDoubleDownEnabled, setTempDoubleDownEnabled] = useState<boolean>(true);
  const [tempSplitEnabled, setTempSplitEnabled] = useState<boolean>(true);
  const [tempMaxSplits, setTempMaxSplits] = useState<string>("3");
  const [tempNumberOfDecks, setTempNumberOfDecks] = useState<string>("6");
  
  // Game state
  const [game, setGame] = useState<BlackjackGame | null>(null);
  const [player, setPlayer] = useState<BlackjackPlayer | null>(null);
  const [playersList, setPlayersList] = useState<BlackjackPlayer[]>([]);
  const [recentGames, setRecentGames] = useState<string[]>([]);
  const [chipRequests, setChipRequests] = useState<ChipRequest[]>([]);
  const [hands, setHands] = useState<BlackjackHand[]>([]);
  const [insuranceResponses, setInsuranceResponses] = useState<Record<string, 'taken' | 'declined'>>({});
  
  // Betting state
  const [selectedBet, setSelectedBet] = useState<number>(5);
  
  // QR Dialog
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  // Settings Dialog (accessible at all times)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  
  // Chip request dialog (for players)
  const [chipRequestDialogOpen, setChipRequestDialogOpen] = useState(false);
  const [chipRequestAmount, setChipRequestAmount] = useState<string>("");

  const navigate = useNavigate();
  const channelRef = useRef<any>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const playersListRef = useRef<BlackjackPlayer[]>([]);
  const gameRef = useRef<BlackjackGame | null>(null);
  const playerRef = useRef<BlackjackPlayer | null>(null);
  const dealingTriggeredRef = useRef<boolean>(false);
  const insuranceResolveRef = useRef<boolean>(false);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
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

  // Generate and shuffle deck
  const generateDeck = (numDecks: number): string[] => {
    const suits = ['S', 'H', 'D', 'C'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deck: string[] = [];
    for (let i = 0; i < numDecks; i++) {
      for (const suit of suits) {
        for (const rank of ranks) {
          deck.push(`${rank}${suit}`);
        }
      }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  };

  // Generate unique game code
  const generateCode = (len = 6) => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const createUniqueGameCode = async (attempts = 5): Promise<string> => {
    for (let i = 0; i < attempts; i++) {
      const code = generateCode();
      const { data, error } = await supabase
        .from('blackjack_games')
        .select('id')
        .eq('code', code)
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return code;
    }
    throw new Error('Unable to generate unique game code');
  };

  // Calculate hand value
  const calculateHandValue = (cards: string[]): { value: number; soft: boolean } => {
    let total = 0;
    let aces = 0;
    
    for (const card of cards) {
      const rank = card.slice(0, -1);
      if (rank === 'A') {
        aces++;
        total += 11;
      } else if (['K', 'Q', 'J'].includes(rank)) {
        total += 10;
      } else {
        total += parseInt(rank);
      }
    }
    
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    
    return { value: total, soft: aces > 0 && total <= 21 };
  };

  const isBlackjackHand = (cards: string[]) =>
    cards.length === 2 && calculateHandValue(cards).value === 21;

  const getCardRank = (card: string) => card.slice(0, -1);

  const normalizeRank = (rank: string) =>
    ['10', 'J', 'Q', 'K'].includes(rank) ? '10' : rank;

  const canSplitCards = (cards: string[]) => {
    if (!cards || cards.length !== 2) return false;
    const rank1 = normalizeRank(getCardRank(cards[0]));
    const rank2 = normalizeRank(getCardRank(cards[1]));
    return rank1 === rank2;
  };

  // Format card for display
  const formatCard = (card: string): string => {
    const suit = card.slice(-1);
    const rank = card.slice(0, -1);
    const suitSymbols: Record<string, string> = { 'S': '\u2660', 'H': '\u2665', 'D': '\u2666', 'C': '\u2663' };
    return `${rank}${suitSymbols[suit] || suit}`;
  };

  const isRedSuit = (card: string): boolean => {
    if (!card || typeof card !== 'string') return false;
    const suit = card.slice(-1).toUpperCase();
    return suit === 'H' || suit === 'D';
  };

  const getTotalCards = (numDecks: number) => numDecks * CARDS_PER_DECK;

  const getReshuffleThreshold = (numDecks: number) =>
    Math.ceil(getTotalCards(numDecks) * (RESHUFFLE_THRESHOLD_PERCENT / 100));

  const updateShoeState = async (
    deck: string[],
    discard: string[],
    lastReshuffleAt?: string | null
  ) => {
    if (!game) return;
    const payload: any = { remaining_cards: deck, discard_pile: discard };
    if (lastReshuffleAt !== undefined) {
      payload.last_reshuffle_at = lastReshuffleAt;
    }

    await supabase
      .from('blackjack_games')
      .update(payload)
      .eq('id', game.id);

    setGame(prev => prev ? {
      ...prev,
      remaining_cards: [...deck],
      discard_pile: [...discard],
      ...(lastReshuffleAt !== undefined ? { last_reshuffle_at: lastReshuffleAt } : {})
    } : prev);
  };

  const reshuffleShoe = async (reason: string, options?: { silent?: boolean }) => {
    if (!game) return null;
    const deck = generateDeck(game.settings.num_decks);
    const discard: string[] = [];
    const now = new Date().toISOString();

    await updateShoeState(deck, discard, now);

    const actionPayload: any = {
      game_id: game.id,
      action_type: 'shoe_reshuffled',
      details: { reason }
    };
    if (game.current_round_id) actionPayload.round_id = game.current_round_id;
    const actorId = player?.id || game.dealer_id;
    if (actorId) actionPayload.player_id = actorId;

    await supabase.from('blackjack_actions').insert([actionPayload]);

    if (!options?.silent) {
      toast({ title: 'Shoe reshuffled', description: 'A new shoe is now in play' });
    }

    return { deck, discard };
  };

  const ensureShoeReady = async (
    deck: string[],
    discard: string[],
    options: { requiredCards?: number; reason?: string; silent?: boolean } = {}
  ) => {
    if (!game) return { deck, discard, reshuffled: false };
    const threshold = getReshuffleThreshold(game.settings.num_decks);
    const needsReshuffle =
      deck.length < threshold ||
      (options.requiredCards ? deck.length < options.requiredCards : false);

    if (!needsReshuffle) {
      return { deck, discard, reshuffled: false };
    }

    const reshuffled = await reshuffleShoe(options.reason || 'auto_low_cards', {
      silent: options.silent ?? true
    });

    if (reshuffled) {
      return { deck: reshuffled.deck, discard: reshuffled.discard, reshuffled: true };
    }

    return { deck, discard, reshuffled: false };
  };

  const drawFromShoe = async (
    deck: string[],
    discard: string[]
  ): Promise<{ card: string | null; deck: string[]; discard: string[] }> => {
    if (!game) return { card: null, deck, discard };
    if (deck.length === 0) return { card: null, deck, discard };

    const card = deck.pop()!;
    discard.push(card);
    await updateShoeState(deck, discard);
    return { card, deck, discard };
  };

  const fetchHiddenDealerCard = async (roundId: string): Promise<string | null> => {
    try {
      const { data } = await supabase
        .from('blackjack_actions')
        .select('card')
        .eq('round_id', roundId)
        .eq('action_type', 'card_dealt_dealer_hidden')
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.card || null;
    } catch (e) {
      console.error('Failed to fetch hidden dealer card', e);
      return null;
    }
  };

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchGame = async (code: string): Promise<BlackjackGame | null> => {
    const { data, error } = await supabase
      .from('blackjack_games')
      .select('*')
      .eq('code', code.toUpperCase())
      .limit(1)
      .single();
    
    if (error) {
      console.error('Fetch game error:', error);
      return null;
    }
    return data;
  };

  const fetchPlayers = async (gameId: string): Promise<BlackjackPlayer[]> => {
    const { data, error } = await supabase
      .from('blackjack_players')
      .select('*')
      .eq('game_id', gameId)
      .order('seat_position', { ascending: true, nullsFirst: false });
    
    if (error) {
      console.error('Fetch players error:', error);
      return [];
    }
    return data || [];
  };

  const fetchChipRequests = async (gameId: string): Promise<ChipRequest[]> => {
    const { data, error } = await supabase
      .from('blackjack_chip_requests')
      .select('*')
      .eq('game_id', gameId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Fetch chip requests error:', error);
      return [];
    }
    return data || [];
  };

  const fetchHands = async (roundId: string): Promise<BlackjackHand[]> => {
    const { data, error } = await supabase
      .from('blackjack_hands')
      .select('*')
      .eq('round_id', roundId)
      .order('hand_index', { ascending: true });
    
    if (error) {
      console.error('Fetch hands error:', error);
      return [];
    }
    return data || [];
  };

  const refreshGameState = useCallback(async () => {
    if (!game?.id) return;
    
    try {
      const [updatedGame, players, requests] = await Promise.all([
        fetchGame(game.code),
        fetchPlayers(game.id),
        fetchChipRequests(game.id),
      ]);
      
      if (updatedGame) setGame(updatedGame);
      setPlayersList(players);
      setChipRequests(requests);
      
      // Update current player
      if (player) {
        const updatedPlayer = players.find(p => p.id === player.id);
        if (updatedPlayer) setPlayer(updatedPlayer);
      }
      
      // Fetch hands if in a round
      if (updatedGame?.current_round_id) {
        const roundHands = await fetchHands(updatedGame.current_round_id);
        setHands(roundHands);
      }
    } catch (e) {
      console.error('Refresh state error:', e);
    }
  }, [game?.id, game?.code, player?.id]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      refreshGameState();
    }, 150);
  }, [refreshGameState]);

  useEffect(() => {
    playersListRef.current = playersList;
  }, [playersList]);

  useEffect(() => {
    gameRef.current = game;
    // If game left betting state, clear the dealing trigger
    if (gameRef.current && gameRef.current.status !== 'betting') {
      dealingTriggeredRef.current = false;
    }
  }, [game]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // ============================================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================================

  useEffect(() => {
    if (!game?.id || (screen !== 'lobby' && screen !== 'game')) return;

    const channel = supabase
      .channel(`blackjack-${game.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'blackjack_games', filter: `id=eq.${game.id}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setGame(payload.new as BlackjackGame);
            scheduleRefresh();
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_players', filter: `game_id=eq.${game.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // New player joined - fetch all to maintain order
            const players = await fetchPlayers(game.id);
            setPlayersList(players);
            scheduleRefresh();
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            // Player updated - update in state directly
            setPlayersList(prev => {
              const updated = prev.map(p => 
                p.id === payload.new.id ? payload.new as BlackjackPlayer : p
              );

              // If we're in a betting round, detect whether all non-dealer players
              // have placed bets. If so, the dealer client should automatically
              // start dealing.
              try {
                const allBetsIn = updated.filter(pl => !pl.is_dealer).length > 0 &&
                  updated.filter(pl => !pl.is_dealer).every(pl => pl.has_placed_bet);
                const g = gameRef.current;
                const p = playerRef.current;
                if (allBetsIn && g && g.status === 'betting' && p && p.is_dealer && !dealingTriggeredRef.current) {
                  // Prevent duplicate triggers
                  dealingTriggeredRef.current = true;
                  // Fire-and-forget: dealer starts dealing automatically
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  handleDealCards();
                }
              } catch (e) {
                // ignore any runtime issues here
              }

              return updated;
            });
            // Update current player if it's them
            if (player && payload.new.id === player.id) {
              setPlayer(payload.new as BlackjackPlayer);
            }
            scheduleRefresh();
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // Player left
            setPlayersList(prev => prev.filter(p => p.id !== payload.old.id));
            scheduleRefresh();
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_chip_requests', filter: `game_id=eq.${game.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const requests = await fetchChipRequests(game.id);
            setChipRequests(requests);
            scheduleRefresh();
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            // Request approved/denied - remove from pending list
            setChipRequests(prev => prev.filter(r => r.id !== payload.new.id));
            // Show toast if it's for current player
            if (player && payload.new.player_id === player.id) {
              const status = payload.new.status;
              if (status === 'approved') {
                toast({ title: 'Chips approved!', description: `You received $${payload.new.amount}` });
              } else if (status === 'denied') {
                toast({ title: 'Request denied', description: 'Your chip request was denied' });
              }
            }
            scheduleRefresh();
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_hands' },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            setHands(prev => [...prev, payload.new as BlackjackHand]);
            scheduleRefresh();
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setHands(prev => prev.map(h => 
              h.id === payload.new.id ? payload.new as BlackjackHand : h
            ));
            scheduleRefresh();
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_actions', filter: `game_id=eq.${game.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const action = payload.new;
            // Show notifications for relevant actions
            if (action.action_type === 'bet_placed' && action.player_id !== player?.id) {
              const playerName = playersListRef.current.find(p => p.id === action.player_id)?.name;
              if (playerName) {
                toast({ title: 'Bet placed', description: `${playerName} placed a bet` });
              }
            }
            if (action.action_type === 'insurance_taken' || action.action_type === 'insurance_declined') {
              if (action.hand_id) {
                setInsuranceResponses(prev => ({
                  ...prev,
                  [action.hand_id]: action.action_type === 'insurance_taken' ? 'taken' : 'declined'
                }));
              }
            }
            scheduleRefresh();
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blackjack_rounds' },
        async (payload) => {
          if (payload.eventType === 'INSERT' && payload.new && payload.new.game_id === game.id) {
            // New round started - clear old hands
            setHands([]);
            setInsuranceResponses({});
            scheduleRefresh();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [game?.id, game?.code, screen, player?.id, scheduleRefresh]);

  // Auto-navigate players based on game status changes
  useEffect(() => {
    if (!game || !player) return;

    // If a betting round starts and the user is currently in the lobby screen,
    // bring them into the game automatically.
    if (game.status === 'betting' && screen === 'lobby') {
      setScreen('game');
    }

    // If the dealer forces everyone back to the lobby (status set to 'lobby')
    if (game.status === 'lobby' && screen === 'game') {
      setScreen('lobby');
    }
  }, [game?.status, screen, player?.id]);

  useEffect(() => {
    if (!game?.current_round_id || game.status !== 'insurance') return;
    (async () => {
      try {
        const { data } = await supabase
          .from('blackjack_actions')
          .select('hand_id, action_type')
          .eq('round_id', game.current_round_id)
          .in('action_type', ['insurance_taken', 'insurance_declined']);

        if (!data) return;
        const updates: Record<string, 'taken' | 'declined'> = {};
        data.forEach((action: any) => {
          if (action.hand_id) {
            updates[action.hand_id] = action.action_type === 'insurance_taken' ? 'taken' : 'declined';
          }
        });
        if (Object.keys(updates).length > 0) {
          setInsuranceResponses(prev => ({ ...prev, ...updates }));
        }
      } catch (e) {
        console.error('Failed to sync insurance responses', e);
      }
    })();
  }, [game?.status, game?.current_round_id]);

  useEffect(() => {
    if (!game || !player?.is_dealer) return;
    if (game.status !== 'insurance') {
      insuranceResolveRef.current = false;
      return;
    }

    const activeHands = hands.filter(h => {
      const handPlayer = playersList.find(p => p.id === h.player_id);
      return handPlayer && !handPlayer.is_dealer && handPlayer.has_placed_bet;
    });

    if (activeHands.length === 0) return;

    const allResponded = activeHands.every(h => insuranceResponses[h.id]);
    if (!allResponded) return;
    if (insuranceResolveRef.current) return;

    insuranceResolveRef.current = true;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    resolveInsurancePhase();
  }, [game?.status, player?.is_dealer, hands, insuranceResponses, playersList]);

  useEffect(() => {
    if (!game?.id || (screen !== 'lobby' && screen !== 'game')) return;

    const pollTimer = window.setInterval(() => {
      refreshGameState();
    }, 500); // Changed from 2000ms to 500ms for faster updates

    return () => {
      clearInterval(pollTimer);
    };
  }, [game?.id, screen, refreshGameState]);

  // ============================================================================
  // INITIALIZATION & STORAGE
  // ============================================================================

  useEffect(() => {
    const storedCode = localStorage.getItem(STORAGE_KEY_CODE);
    const storedName = localStorage.getItem(STORAGE_KEY_NAME);
    const storedPlayerId = localStorage.getItem(STORAGE_KEY_PLAYER_ID);

    if (storedName) setName(storedName);

    // Load recent games
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_RECENT);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const codes = parsed.filter(Boolean).map((s: any) => String(s));
        if (codes.length === 0) return;

        const { data: existing } = await supabase
          .from('blackjack_games')
          .select('code')
          .in('code', codes);
        
        const existingSet = new Set((existing || []).map((g: any) => g.code));
        const filtered = codes.filter((c: string) => existingSet.has(c));
        setRecentGames(filtered);
        persistRecentGames(filtered);
      } catch (e) { /* ignore */ }
    })();

    // Try to restore session
    if (storedCode && storedPlayerId) {
      (async () => {
        try {
          const gameData = await fetchGame(storedCode);
          if (!gameData) return;

          const { data: playerData } = await supabase
            .from('blackjack_players')
            .select('*')
            .eq('id', storedPlayerId)
            .single();

          // Only auto-restore if the stored player record matches the stored name
          // (prevents another tab's stored player id -- e.g. the dealer's id --
          // from being applied to this tab). If the name doesn't match, clear
          // the cached player id so the user can join as a different player.
          const storedName = localStorage.getItem(STORAGE_KEY_NAME);

          if (playerData && playerData.game_id === gameData.id && storedName && playerData.name === storedName.toUpperCase()) {
            // Mark online
            await supabase
              .from('blackjack_players')
              .update({ is_online: true, last_seen_at: new Date().toISOString() })
              .eq('id', playerData.id);

            setGame(gameData);
            setPlayer(playerData);
            setGameCode(gameData.code);
            
            const players = await fetchPlayers(gameData.id);
            setPlayersList(players);
            
            setScreen(gameData.status === 'lobby' ? 'lobby' : 'game');
          } else {
            // If mismatch or missing name, clear the stale stored player id
            try {
              localStorage.removeItem(STORAGE_KEY_PLAYER_ID);
            } catch (e) {
              // ignore
            }
          }
        } catch (e) {
          console.error('Session restore failed:', e);
        }
      })();
    }
  }, []);

  // If the URL contains an invite or code param, auto-fill and go to enter-name
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite') || params.get('code');
      if (invite) {
        try {
          // Clear any cached session identifiers but preserve a stored name
          localStorage.removeItem(STORAGE_KEY_CODE);
          localStorage.removeItem(STORAGE_KEY_PLAYER_ID);
        } catch (e) {
          // ignore
        }

        const normalized = invite.toUpperCase();
        setGameCode(normalized);
        setMode('join');

        // If a user name is already stored, attempt to auto-join the invite
        const storedName = (() => {
          try { return localStorage.getItem(STORAGE_KEY_NAME); } catch { return null; }
        })();

        // remove query params from URL to keep it clean
        try {
          navigate(window.location.pathname, { replace: true });
        } catch (e) {
          // ignore navigate errors
        }

        if (storedName) {
          (async () => {
            try {
              const gameData = await fetchGame(normalized);
              if (!gameData) {
                // fall back to enter-name flow
                setName('');
                setScreen('enter-name');
                return;
              }

              // prefill and attempt to join with the stored name
              setGame(gameData);
              setName(storedName);
              setScreen('enter-name');

              // call the same submit handler to join (will create or re-use player)
              // delay slightly to ensure state updates propagate
              setTimeout(() => {
                void handleNameSubmit();
              }, 50);
            } catch (e) {
              setName('');
              setScreen('enter-name');
            }
          })();
        } else {
          // No stored name - show enter-name so user can type
          setName('');
          setScreen('enter-name');
        }
      }
    } catch (err) {
      // ignore
    }
  }, [navigate]);

  // ============================================================================
  // GAME ACTIONS
  // ============================================================================

  const handleJoinGame = async () => {
    if (!gameCode.trim()) {
      setError("Please enter a game code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const gameData = await fetchGame(gameCode);
      if (!gameData) {
        setError("Game not found");
        return;
      }

      setGame(gameData);
      setMode("join");
      pushRecentGame(gameCode.toUpperCase());
      // Clear any previously typed name to avoid autofill from other sessions
      setName("");
      setScreen("enter-name");
    } catch (err: any) {
      setError(err.message || "Failed to find game");
    } finally {
      setLoading(false);
    }
  };

  const handleNameSubmit = async () => {
    const cleaned = (name ?? '').trim();
    if (!cleaned) return;
    if (!/^[A-Z ]{1,10}$/.test(cleaned)) {
      setError('Name must be letters and spaces only (max 10 characters)');
      return;
    }
    setError(null);

    if (mode === "create") {
      setScreen("confirm-settings");
    } else {
      // Joining an existing game as a player
      setLoading(true);
      try {
        // Ensure we have a game object; if not, try to fetch using the code
        let gameToUse = game;
        if (!gameToUse) {
          if (!gameCode || !gameCode.trim()) throw new Error('No game selected');
          const fetched = await fetchGame(gameCode);
          if (!fetched) {
            setError('Game not found');
            setLoading(false);
            return;
          }
          gameToUse = fetched;
          setGame(fetched);
        }

        // Check if player already exists
        const { data: existingPlayers } = await supabase
          .from('blackjack_players')
          .select('*')
          .eq('game_id', gameToUse.id)
          .eq('name', cleaned.toUpperCase());

        let currentPlayer: BlackjackPlayer;
        
        if (existingPlayers && existingPlayers.length > 0) {
          currentPlayer = existingPlayers[0];
          await supabase
            .from('blackjack_players')
            .update({ is_online: true, last_seen_at: new Date().toISOString() })
            .eq('id', currentPlayer.id);
        } else {
          // Create new player (not dealer)
          const { data: newPlayer, error: joinErr } = await supabase
            .from('blackjack_players')
            .insert([{
              game_id: gameToUse.id,
              name: cleaned.toUpperCase(),
              is_dealer: false,
              balance: 0, // Players start with 0 until dealer gives chips
            }])
            .select()
            .single();

          if (joinErr) throw joinErr;
          currentPlayer = newPlayer;

          // Log action
          await supabase.from('blackjack_actions').insert([{
            game_id: gameToUse.id,
            player_id: currentPlayer.id,
            action_type: 'player_joined',
            details: { name: cleaned.toUpperCase() }
          }]);
        }

        setPlayer(currentPlayer);
        localStorage.setItem(STORAGE_KEY_NAME, cleaned.toUpperCase());
        localStorage.setItem(STORAGE_KEY_CODE, gameToUse.code);
        localStorage.setItem(STORAGE_KEY_PLAYER_ID, currentPlayer.id);
        
        const players = await fetchPlayers(gameToUse.id);
        setPlayersList(players);
        
        setScreen(gameToUse.status === 'lobby' ? 'lobby' : 'game');
      } catch (err: any) {
        setError(err.message || "Failed to join game");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSettingsConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const code = await createUniqueGameCode();
      const numDecks = parseInt(tempNumberOfDecks);
      const deck = generateDeck(numDecks);

      // Create the blackjack game
      const { data: newGame, error: createErr } = await supabase
        .from('blackjack_games')
        .insert([{
          code,
          name: `${name}'s Table`,
          status: 'lobby',
          remaining_cards: deck,
          discard_pile: [],
          dealer_hand: [],
          dealer_visible_card: null,
          dealer_status: 'waiting',
          turn_order: [],
          current_turn_index: null,
          settings: {
            num_decks: numDecks,
            hit_on_soft_17: !tempDealerStandsOnSoft17,
            blackjack_payout: 1.5,
            insurance_enabled: tempInsuranceEnabled,
            double_down_enabled: tempDoubleDownEnabled,
            split_enabled: tempSplitEnabled,
            max_splits: parseInt(tempMaxSplits),
            min_bet: 1,
            max_bet: 100,
            bet_increments: [1, 2, 5, 10, 25]
          }
        }])
        .select()
        .single();

      if (createErr) throw createErr;

      // Create dealer player
      const { data: dealerPlayer, error: dealerErr } = await supabase
        .from('blackjack_players')
        .insert([{
          game_id: newGame.id,
          name: name.toUpperCase(),
          is_dealer: true,
          balance: 999999, // Dealer has unlimited chips (the house)
        }])
        .select()
        .single();

      if (dealerErr) throw dealerErr;

      // Update game with dealer_id
      await supabase
        .from('blackjack_games')
        .update({ dealer_id: dealerPlayer.id })
        .eq('id', newGame.id);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: newGame.id,
        player_id: dealerPlayer.id,
        action_type: 'game_created',
        details: { dealer_name: name.toUpperCase() }
      }]);

      setGame({ ...newGame, dealer_id: dealerPlayer.id });
      setPlayer(dealerPlayer);
      setGameCode(code);
      setPlayersList([dealerPlayer]);
      
      localStorage.setItem(STORAGE_KEY_CODE, code);
      localStorage.setItem(STORAGE_KEY_NAME, name.toUpperCase());
      localStorage.setItem(STORAGE_KEY_PLAYER_ID, dealerPlayer.id);
      pushRecentGame(code);
      
      setScreen("lobby");
    } catch (err: any) {
      console.error('Create failed:', err);
      setError(err?.message || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handleRecentGameSelect = async (code: string) => {
    setGameCode(code);
    setLoading(true);
    try {
      const gameData = await fetchGame(code);
      if (gameData) {
        setGame(gameData);
        setMode('join');
        // Clear name when opening join flow for a recent game to prevent
        // accidental prefilling with another player's name.
        setName('');
        setScreen('enter-name');
      } else {
        setError("Game no longer exists.");
      }
    } catch (e) {
      setError("Failed to fetch game details.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // DEALER ACTIONS
  // ============================================================================

  const handleGiveChips = async (playerId: string, amount: number) => {
    if (!game || !player?.is_dealer) return;
    
    try {
      // Update player balance
      const targetPlayer = playersList.find(p => p.id === playerId);
      if (!targetPlayer) return;

      await supabase
        .from('blackjack_players')
        .update({ 
          balance: targetPlayer.balance + amount,
          total_bought_in: targetPlayer.total_bought_in + amount
        })
        .eq('id', playerId);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        player_id: playerId,
        action_type: 'buy_in',
        amount,
        details: { approved_by: player.id }
      }]);

      toast({ title: 'Chips given', description: `Gave $${amount} to ${targetPlayer.name}` });
    } catch (e) {
      console.error('Give chips error:', e);
      toast({ title: 'Error', description: 'Failed to give chips' });
    }
  };

  const handleApproveChipRequest = async (requestId: string, approve: boolean) => {
    if (!game || !player?.is_dealer) return;
    
    try {
      const request = chipRequests.find(r => r.id === requestId);
      if (!request) return;

      if (approve) {
        // Update player balance
        const targetPlayer = playersList.find(p => p.id === request.player_id);
        if (targetPlayer) {
          await supabase
            .from('blackjack_players')
            .update({ 
              balance: targetPlayer.balance + request.amount,
              total_bought_in: targetPlayer.total_bought_in + request.amount
            })
            .eq('id', request.player_id);
        }
      }

      // Update request status
      await supabase
        .from('blackjack_chip_requests')
        .update({ 
          status: approve ? 'approved' : 'denied',
          handled_by: player.id,
          handled_at: new Date().toISOString()
        })
        .eq('id', requestId);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        player_id: request.player_id,
        action_type: approve ? 'chip_approved' : 'chip_denied',
        amount: request.amount,
        details: { handled_by: player.id }
      }]);
    } catch (e) {
      console.error('Handle chip request error:', e);
    }
  };

  const handleSetPlayerOrder = async (orderedPlayerIds: string[]) => {
    if (!game || !player?.is_dealer) return;
    
    try {
      await supabase
        .from('blackjack_games')
        .update({ turn_order: orderedPlayerIds })
        .eq('id', game.id);
      
      // Update seat positions
      for (let i = 0; i < orderedPlayerIds.length; i++) {
        await supabase
          .from('blackjack_players')
          .update({ seat_position: i + 1 })
          .eq('id', orderedPlayerIds[i]);
      }
    } catch (e) {
      console.error('Set player order error:', e);
    }
  };

  const handleStartBetting = async () => {
    if (!game || !player?.is_dealer) return;
    
    try {
      const deck = [...(game.remaining_cards || [])];
      const discard = [...(game.discard_pile || [])];
      await ensureShoeReady(deck, discard, { reason: 'auto_low_cards_before_round', silent: false });

      // Create a new round
      const { data: round, error: roundErr } = await supabase
        .from('blackjack_rounds')
        .insert([{
          game_id: game.id,
          status: 'betting',
          betting_started_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (roundErr) throw roundErr;

      // Reset player bets
      await supabase
        .from('blackjack_players')
        .update({ current_bet: 0, has_placed_bet: false })
        .eq('game_id', game.id)
        .eq('is_dealer', false);

      // Update game status
      await supabase
        .from('blackjack_games')
        .update({ 
          status: 'betting',
          current_round_id: round.id,
          dealer_hand: [],
          dealer_visible_card: null,
          dealer_status: 'waiting',
          current_turn_index: null
        })
        .eq('id', game.id);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: round.id,
        action_type: 'round_started',
        sequence_number: 1
      }]);

      setInsuranceResponses({});
      setScreen('game');
    } catch (e) {
      console.error('Start betting error:', e);
      toast({ title: 'Error', description: 'Failed to start betting' });
    }
  };

  const handleUpdatePlayerOrder = async (orderedPlayerIds: string[]) => {
    if (!game || !player?.is_dealer) return;

    try {
      // Optimistically update local game state to prevent UI reordering jitter
      setGame(prev => prev ? { ...prev, turn_order: orderedPlayerIds } : prev);
      // Update the turn_order in the game
      await supabase
        .from('blackjack_games')
        .update({ turn_order: orderedPlayerIds })
        .eq('id', game.id);

      toast({ title: 'Order updated', description: 'Player dealing order set' });
    } catch (e) {
      console.error('Update player order error:', e);
      toast({ title: 'Error', description: 'Failed to update player order' });
    }
  };

  const handleReshuffleShoe = async () => {
    if (!game || !player?.is_dealer) return;
    const inRound = ['betting', 'dealing', 'insurance', 'playing', 'dealer_turn', 'resolving'].includes(game.status);
    if (inRound) {
      const ok = window.confirm(
        'Reshuffle the shoe mid-round? This will reset the remaining deck during an active hand.'
      );
      if (!ok) return;
    }

    try {
      await reshuffleShoe('manual', { silent: false });
    } catch (e) {
      console.error('Manual reshuffle error:', e);
      toast({ title: 'Error', description: 'Failed to reshuffle the shoe' });
    }
  };

  // ============================================================================
  // PLAYER ACTIONS
  // ============================================================================

  const handleRequestChips = async () => {
    if (!game || !player || player.is_dealer) return;
    
    const amount = parseInt(chipRequestAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid chip amount' });
      return;
    }

    try {
      await supabase
        .from('blackjack_chip_requests')
        .insert([{
          game_id: game.id,
          player_id: player.id,
          amount
        }]);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        player_id: player.id,
        action_type: 'chip_request',
        amount
      }]);

      setChipRequestDialogOpen(false);
      toast({ title: 'Request sent', description: `Requested $${amount} chips from dealer` });
    } catch (e) {
      console.error('Request chips error:', e);
      toast({ title: 'Error', description: 'Failed to request chips' });
    }
  };

  const handlePlaceBet = async (amount: number) => {
    if (!game || !player || player.is_dealer) return;
    if (game.status !== 'betting') return;
    if (amount > player.balance) {
      toast({ title: 'Insufficient balance', description: 'You don\'t have enough chips' });
      return;
    }

    try {
      await supabase
        .from('blackjack_players')
        .update({ current_bet: amount, has_placed_bet: true })
        .eq('id', player.id);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        player_id: player.id,
        action_type: 'bet_placed',
        amount
      }]);
    } catch (e) {
      console.error('Place bet error:', e);
      toast({ title: 'Error', description: 'Failed to place bet' });
    }
  };

  // ============================================================================
  // DEALING & GAME FLOW
  // ============================================================================

  const handleDealCards = async () => {
    if (!game || !player?.is_dealer || !game.current_round_id) return;
    
    const activePlayers = playersList.filter(p => !p.is_dealer && p.has_placed_bet);
    if (activePlayers.length === 0) {
      toast({ title: 'No bets', description: 'No players have placed bets' });
      return;
    }

    setLoading(true);
    try {
      // Determine turn order - use existing turn_order if set, otherwise use seat order
      let turnOrder = game.turn_order && game.turn_order.length > 0 
        ? game.turn_order.filter(id => activePlayers.find(p => p.id === id)) // Filter to only active players
        : activePlayers.sort((a, b) => (a.seat_position || 0) - (b.seat_position || 0)).map(p => p.id);
      
      // If turn_order wasn't set, save it now
      if (!game.turn_order || game.turn_order.length === 0) {
        await supabase
          .from('blackjack_games')
          .update({ turn_order: turnOrder })
          .eq('id', game.id);
      }

      let deck = [...(game.remaining_cards || [])];
      let discard = [...(game.discard_pile || [])];
      const requiredCards = (activePlayers.length * 2) + 2;
      const ensured = await ensureShoeReady(deck, discard, {
        requiredCards,
        reason: 'auto_low_cards_before_deal',
        silent: false
      });
      deck = ensured.deck;
      discard = ensured.discard;

      // Deduct bets from player balances and create hand records
      for (const p of activePlayers) {
        await supabase
          .from('blackjack_players')
          .update({ balance: p.balance - p.current_bet })
          .eq('id', p.id);

        // Create hand record with empty cards initially
        await supabase
          .from('blackjack_hands')
          .insert([{
            round_id: game.current_round_id,
            player_id: p.id,
            hand_index: 0,
            cards: [],
            bet_amount: p.current_bet,
            status: 'active',
            is_active: false
          }]);
      }

      // Helper function to deal a card with delay
      const dealCardWithDelay = async (delayMs: number) => {
        return new Promise(resolve => setTimeout(resolve, delayMs));
      };

      let sequenceNum = 1;
      const orderedPlayers = turnOrder.map(id => activePlayers.find(p => p.id === id)).filter(Boolean) as BlackjackPlayer[];

      // ROUND 1: Deal first card to each player (clockwise)
      for (const p of orderedPlayers) {
        const draw = await drawFromShoe(deck, discard);
        if (!draw.card) throw new Error('No cards left to deal');
        deck = draw.deck;
        discard = draw.discard;
        const card = draw.card;
        
        // Fetch the hand
        const { data: handData } = await supabase
          .from('blackjack_hands')
          .select('*')
          .eq('round_id', game.current_round_id)
          .eq('player_id', p.id)
          .eq('hand_index', 0)
          .single();

        if (handData) {
          await supabase
            .from('blackjack_hands')
            .update({ cards: [...handData.cards, card] })
            .eq('id', handData.id);

          // Log action
          await supabase.from('blackjack_actions').insert([{
            game_id: game.id,
            round_id: game.current_round_id,
            player_id: p.id,
            hand_id: handData.id,
            action_type: 'card_dealt_player',
            card,
            sequence_number: sequenceNum++
          }]);
        }

        // Wait 1 second before dealing next card
        await dealCardWithDelay(1000);
      }

      // Deal first card to dealer (face up) - everyone sees this
      const dealerDraw1 = await drawFromShoe(deck, discard);
      if (!dealerDraw1.card) throw new Error('No cards left to deal');
      deck = dealerDraw1.deck;
      discard = dealerDraw1.discard;
      const dealerCard1 = dealerDraw1.card;
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        action_type: 'card_dealt_dealer',
        card: dealerCard1,
        sequence_number: sequenceNum++
      }]);

      // Update game state so the first dealer card is visible immediately
      await supabase
        .from('blackjack_games')
        .update({ dealer_hand: [dealerCard1], dealer_visible_card: dealerCard1 })
        .eq('id', game.id);

      await dealCardWithDelay(1000);

      // ROUND 2: Deal second card to each player
      for (const p of orderedPlayers) {
        const draw = await drawFromShoe(deck, discard);
        if (!draw.card) throw new Error('No cards left to deal');
        deck = draw.deck;
        discard = draw.discard;
        const card = draw.card;
        
        const { data: handData } = await supabase
          .from('blackjack_hands')
          .select('*')
          .eq('round_id', game.current_round_id)
          .eq('player_id', p.id)
          .eq('hand_index', 0)
          .single();

        if (handData) {
          const newCards = [...handData.cards, card];
          const handValue = calculateHandValue(newCards);
          const isBlackjack = handValue.value === 21 && newCards.length === 2;
          
          await supabase
            .from('blackjack_hands')
            .update({ 
              cards: newCards,
              status: isBlackjack ? 'blackjack' : 'active'
            })
            .eq('id', handData.id);

          // Log action
          await supabase.from('blackjack_actions').insert([{
            game_id: game.id,
            round_id: game.current_round_id,
            player_id: p.id,
            hand_id: handData.id,
            action_type: 'card_dealt_player',
            card,
            sequence_number: sequenceNum++
          }]);
        }

        await dealCardWithDelay(1000);
      }

      // Deal second card to dealer (face down - hidden)
      const dealerDraw2 = await drawFromShoe(deck, discard);
      if (!dealerDraw2.card) throw new Error('No cards left to deal');
      deck = dealerDraw2.deck;
      discard = dealerDraw2.discard;
      const dealerCard2 = dealerDraw2.card;
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        action_type: 'card_dealt_dealer_hidden',
        card: dealerCard2,
        sequence_number: sequenceNum++
      }]);

      const dealerUpcardIsAce = getCardRank(dealerCard1) === 'A';
      const shouldOfferInsurance = game.settings.insurance_enabled && dealerUpcardIsAce;

      // Update game state with dealer's first card and a hidden placeholder
      // so UIs show the second card face-down immediately after it's dealt.
      await supabase
        .from('blackjack_games')
        .update({
          dealer_hand: [dealerCard1, '__HIDDEN__'],
          dealer_visible_card: dealerCard1,
          status: shouldOfferInsurance ? 'insurance' : 'playing',
          current_turn_index: null
        })
        .eq('id', game.id);

      if (!shouldOfferInsurance) {
        await activateFirstHandOrDealer();
      }

      // Update round status
      await supabase
        .from('blackjack_rounds')
        .update({ 
          status: 'playing',
          dealing_started_at: new Date().toISOString()
        })
        .eq('id', game.current_round_id);

      toast({ title: 'Cards dealt', description: 'Players can now take their turns' });
    } catch (e) {
      console.error('Deal cards error:', e);
      toast({ title: 'Error', description: 'Failed to deal cards' });
    } finally {
      setLoading(false);
    }
  };

  const resolveInsurancePhase = async () => {
    if (!game || !game.current_round_id) return;

    try {
      const hiddenCard = await fetchHiddenDealerCard(game.current_round_id);
      const dealerCard1 = game.dealer_hand?.[0] || game.dealer_visible_card;

      if (!dealerCard1 || !hiddenCard) {
        await supabase
          .from('blackjack_games')
          .update({ status: 'playing', current_turn_index: null })
          .eq('id', game.id);
        await activateFirstHandOrDealer();
        return;
      }

      const dealerCards = [dealerCard1, hiddenCard];
      const dealerValue = calculateHandValue(dealerCards);
      const dealerBlackjack = dealerCards.length === 2 && dealerValue.value === 21;

      if (dealerBlackjack) {
        await supabase.from('blackjack_actions').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          action_type: 'dealer_reveal',
          card: hiddenCard
        }, {
          game_id: game.id,
          round_id: game.current_round_id,
          action_type: 'dealer_blackjack',
          details: { final_value: dealerValue.value }
        }]);

        await supabase
          .from('blackjack_games')
          .update({
            dealer_hand: dealerCards,
            dealer_status: 'blackjack',
            status: 'resolving',
            current_turn_index: null
          })
          .eq('id', game.id);

        await resolveRound(dealerCards, dealerValue.value, false);
      } else {
        await supabase
          .from('blackjack_games')
          .update({ status: 'playing', current_turn_index: null })
          .eq('id', game.id);
        await activateFirstHandOrDealer();
      }
    } catch (e) {
      console.error('Resolve insurance error:', e);
    } finally {
      insuranceResolveRef.current = false;
    }
  };

  const handleHit = async () => {
    if (!game || !player || player.is_dealer || !game.current_round_id) return;
    if (game.status !== 'playing') return;
    
    const myHand = hands.find(h => h.player_id === player.id && h.is_active);
    if (!myHand || myHand.status !== 'active') return;

    try {
      let deck = [...(game.remaining_cards || [])];
      let discard = [...(game.discard_pile || [])];
      if (deck.length === 0) {
        toast({ title: 'Error', description: 'No cards left in deck' });
        return;
      }

      const draw = await drawFromShoe(deck, discard);
      if (!draw.card) {
        toast({ title: 'Error', description: 'No cards left in deck' });
        return;
      }
      deck = draw.deck;
      discard = draw.discard;
      const card = draw.card;
      const newCards = [...myHand.cards, card];
      const handValue = calculateHandValue(newCards);
      const isBusted = handValue.value > 21;

      await supabase
        .from('blackjack_hands')
        .update({ 
          cards: newCards,
          status: isBusted ? 'busted' : 'active',
          is_active: !isBusted
        })
        .eq('id', myHand.id);

      // Update player stats
      await supabase
        .from('blackjack_players')
        .update({ times_hit: (playerRef.current?.times_hit ?? player.times_hit) + 1 })
        .eq('id', player.id);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        player_id: player.id,
        hand_id: myHand.id,
        action_type: 'hit',
        card
      }]);

      if (isBusted) {
        toast({ title: 'Bust!', description: `Your hand is ${handValue.value}` });
        await advanceToNextPlayer();
      }
    } catch (e) {
      console.error('Hit error:', e);
      toast({ title: 'Error', description: 'Failed to hit' });
    }
  };

  const handleStand = async () => {
    if (!game || !player || player.is_dealer || !game.current_round_id) return;
    if (game.status !== 'playing') return;
    
    const myHand = hands.find(h => h.player_id === player.id && h.is_active);
    if (!myHand || myHand.status !== 'active') return;

    try {
      await supabase
        .from('blackjack_hands')
        .update({ status: 'stood', is_active: false })
        .eq('id', myHand.id);

      // Update player stats
      await supabase
        .from('blackjack_players')
        .update({ times_stood: (playerRef.current?.times_stood ?? player.times_stood) + 1 })
        .eq('id', player.id);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        player_id: player.id,
        hand_id: myHand.id,
        action_type: 'stand'
      }]);

      await advanceToNextPlayer();
    } catch (e) {
      console.error('Stand error:', e);
      toast({ title: 'Error', description: 'Failed to stand' });
    }
  };

  const handleDoubleDown = async () => {
    if (!game || !player || player.is_dealer || !game.current_round_id) return;
    if (!game.settings.double_down_enabled) return;
    if (game.status !== 'playing') return;
    
    const myHand = hands.find(h => h.player_id === player.id && h.is_active);
    if (!myHand || myHand.status !== 'active' || myHand.cards.length !== 2) return;
    const currentPlayer = playerRef.current ?? player;
    if (currentPlayer.balance < myHand.bet_amount) {
      toast({ title: 'Insufficient balance', description: 'Not enough chips to double down' });
      return;
    }

    try {
      let deck = [...(game.remaining_cards || [])];
      let discard = [...(game.discard_pile || [])];
      if (deck.length === 0) {
        toast({ title: 'Error', description: 'No cards left in deck' });
        return;
      }

      const draw = await drawFromShoe(deck, discard);
      if (!draw.card) {
        toast({ title: 'Error', description: 'No cards left in deck' });
        return;
      }
      deck = draw.deck;
      discard = draw.discard;
      const card = draw.card;
      const newCards = [...myHand.cards, card];
      const handValue = calculateHandValue(newCards);
      const isBusted = handValue.value > 21;

      // Deduct additional bet
      const newCurrentBet = (currentPlayer.current_bet || 0) + myHand.bet_amount;
      await supabase
        .from('blackjack_players')
        .update({ 
          balance: currentPlayer.balance - myHand.bet_amount,
          current_bet: newCurrentBet,
          times_doubled: currentPlayer.times_doubled + 1
        })
        .eq('id', player.id);

      await supabase
        .from('blackjack_hands')
        .update({ 
          cards: newCards,
          bet_amount: myHand.bet_amount * 2,
          status: isBusted ? 'busted' : 'doubled',
          is_active: false
        })
        .eq('id', myHand.id);

      // Log action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        player_id: player.id,
        hand_id: myHand.id,
        action_type: 'double_down',
        card,
        amount: myHand.bet_amount
      }]);

      await advanceToNextPlayer();
    } catch (e) {
      console.error('Double down error:', e);
      toast({ title: 'Error', description: 'Failed to double down' });
    }
  };

  const activateFirstHandOrDealer = async () => {
    if (!game || !game.current_round_id) return;

    const roundHands = await fetchHands(game.current_round_id);
    setHands(roundHands);

    const activePlayers = playersList.filter(p => !p.is_dealer && p.has_placed_bet);
    const orderedPlayers = game.turn_order && game.turn_order.length > 0
      ? game.turn_order.map(id => activePlayers.find(p => p.id === id)).filter(Boolean) as BlackjackPlayer[]
      : activePlayers;

    for (let i = 0; i < orderedPlayers.length; i++) {
      const p = orderedPlayers[i];
      const playerHands = roundHands
        .filter(h => h.player_id === p.id)
        .sort((a, b) => a.hand_index - b.hand_index);

      const activeHand = playerHands.find(h => h.status === 'active');
      if (activeHand) {
        await supabase
          .from('blackjack_hands')
          .update({ is_active: true })
          .eq('id', activeHand.id);

        await supabase
          .from('blackjack_games')
          .update({ current_turn_index: i })
          .eq('id', game.id);
        return;
      }
    }

    // No active player hands - move to dealer
    await supabase
      .from('blackjack_games')
      .update({ status: 'dealer_turn', current_turn_index: null })
      .eq('id', game.id);

    await playDealerHand();
  };

  const handleInsuranceDecision = async (takeInsurance: boolean) => {
    if (!game || !player || player.is_dealer || !game.current_round_id) return;
    if (!game.settings.insurance_enabled) return;
    if (game.status !== 'insurance') return;

    const myHand = hands.find(h => h.player_id === player.id && h.hand_index === 0);
    if (!myHand) return;
    if (insuranceResponses[myHand.id]) return;

    const insuranceAmount = Math.floor(myHand.bet_amount / 2);
    if (insuranceAmount <= 0) {
      toast({ title: 'Insurance unavailable', description: 'Insurance bet is too small for this wager' });
      return;
    }

    try {
      const currentPlayer = playerRef.current ?? player;

      if (takeInsurance) {
        if (currentPlayer.balance < insuranceAmount) {
          toast({ title: 'Insufficient balance', description: 'Not enough chips for insurance' });
          return;
        }

        await supabase
          .from('blackjack_hands')
          .update({ insurance_bet: insuranceAmount })
          .eq('id', myHand.id);

        await supabase
          .from('blackjack_players')
          .update({ 
            balance: currentPlayer.balance - insuranceAmount,
            times_insurance: currentPlayer.times_insurance + 1
          })
          .eq('id', player.id);

        await supabase.from('blackjack_actions').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          player_id: player.id,
          hand_id: myHand.id,
          action_type: 'insurance_taken',
          amount: insuranceAmount
        }]);

        setInsuranceResponses(prev => ({ ...prev, [myHand.id]: 'taken' }));
      } else {
        await supabase.from('blackjack_actions').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          player_id: player.id,
          hand_id: myHand.id,
          action_type: 'insurance_declined'
        }]);
        setInsuranceResponses(prev => ({ ...prev, [myHand.id]: 'declined' }));
      }
    } catch (e) {
      console.error('Insurance decision error:', e);
      toast({ title: 'Error', description: 'Failed to submit insurance decision' });
    }
  };

  const handleSplit = async () => {
    if (!game || !player || player.is_dealer || !game.current_round_id) return;
    if (!game.settings.split_enabled) return;
    if (game.status !== 'playing') return;

    const myHand = hands.find(h => h.player_id === player.id && h.is_active);
    if (!myHand || myHand.status !== 'active') return;
    if (myHand.cards.length !== 2 || !canSplitCards(myHand.cards)) return;

    const playerHands = hands.filter(h => h.player_id === player.id);
    const maxHands = (game.settings.max_splits || 0) + 1;
    if (playerHands.length >= maxHands) {
      toast({ title: 'Split limit reached', description: `Max ${game.settings.max_splits} splits allowed` });
      return;
    }

    const currentPlayer = playerRef.current ?? player;
    if (currentPlayer.balance < myHand.bet_amount) {
      toast({ title: 'Insufficient balance', description: 'Not enough chips to split' });
      return;
    }

    try {
      let deck = [...(game.remaining_cards || [])];
      let discard = [...(game.discard_pile || [])];

      const draw1 = await drawFromShoe(deck, discard);
      if (!draw1.card) throw new Error('No cards left to split');
      deck = draw1.deck;
      discard = draw1.discard;

      const draw2 = await drawFromShoe(deck, discard);
      if (!draw2.card) throw new Error('No cards left to split');
      deck = draw2.deck;
      discard = draw2.discard;

      const [card1, card2] = myHand.cards;
      const firstHandCards = [card1, draw1.card];
      const secondHandCards = [card2, draw2.card];
      const firstStatus = isBlackjackHand(firstHandCards) ? 'blackjack' : 'active';
      const secondStatus = isBlackjackHand(secondHandCards) ? 'blackjack' : 'active';

      const nextHandIndex = Math.max(...playerHands.map(h => h.hand_index)) + 1;

      await supabase
        .from('blackjack_players')
        .update({ 
          balance: currentPlayer.balance - myHand.bet_amount,
          current_bet: (currentPlayer.current_bet || 0) + myHand.bet_amount,
          times_split: currentPlayer.times_split + 1
        })
        .eq('id', player.id);

      await supabase
        .from('blackjack_hands')
        .update({ 
          cards: firstHandCards,
          status: firstStatus,
          is_active: firstStatus === 'active'
        })
        .eq('id', myHand.id);

      const { data: newHand, error: newHandErr } = await supabase
        .from('blackjack_hands')
        .insert([{
          round_id: game.current_round_id,
          player_id: player.id,
          hand_index: nextHandIndex,
          cards: secondHandCards,
          bet_amount: myHand.bet_amount,
          status: secondStatus,
          is_active: false
        }])
        .select()
        .single();

      if (newHandErr) throw newHandErr;

      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        player_id: player.id,
        hand_id: myHand.id,
        action_type: 'split',
        details: { new_hand_id: newHand?.id }
      }]);

      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        player_id: player.id,
        hand_id: myHand.id,
        action_type: 'card_dealt_player',
        card: draw1.card
      }, {
        game_id: game.id,
        round_id: game.current_round_id,
        player_id: player.id,
        hand_id: newHand?.id,
        action_type: 'card_dealt_player',
        card: draw2.card
      }]);

      if (firstStatus !== 'active') {
        if (secondStatus === 'active' && newHand?.id) {
          await supabase
            .from('blackjack_hands')
            .update({ is_active: true })
            .eq('id', newHand.id);
        } else {
          await advanceToNextPlayer();
        }
      }
    } catch (e) {
      console.error('Split error:', e);
      toast({ title: 'Error', description: 'Failed to split hand' });
    }
  };

  const advanceToNextPlayer = async () => {
    if (!game || !game.current_round_id) return;

    const roundHands = await fetchHands(game.current_round_id);
    setHands(roundHands);

    const activePlayers = playersList.filter(p => !p.is_dealer && p.has_placed_bet);
    const orderedPlayers = game.turn_order && game.turn_order.length > 0
      ? game.turn_order.map(id => activePlayers.find(p => p.id === id)).filter(Boolean) as BlackjackPlayer[]
      : activePlayers;

    const currentActiveHand = roundHands.find(h => h.is_active);
    const currentPlayerId = currentActiveHand?.player_id
      || orderedPlayers[game.current_turn_index ?? 0]?.id;

    if (currentPlayerId) {
      const currentPlayerHands = roundHands
        .filter(h => h.player_id === currentPlayerId)
        .sort((a, b) => a.hand_index - b.hand_index);

      const nextHandSamePlayer = currentPlayerHands.find(
        h => h.status === 'active' && !h.is_active
      );

      if (nextHandSamePlayer) {
        await supabase
          .from('blackjack_hands')
          .update({ is_active: true })
          .eq('id', nextHandSamePlayer.id);
        return;
      }
    }

    const startIdx = currentPlayerId
      ? orderedPlayers.findIndex(p => p.id === currentPlayerId)
      : (game.current_turn_index ?? 0);

    let nextIdx = startIdx + 1;
    while (nextIdx < orderedPlayers.length) {
      const nextPlayer = orderedPlayers[nextIdx];
      const nextHand = roundHands
        .filter(h => h.player_id === nextPlayer.id)
        .sort((a, b) => a.hand_index - b.hand_index)
        .find(h => h.status === 'active');

      if (nextHand) {
        await supabase
          .from('blackjack_hands')
          .update({ is_active: true })
          .eq('id', nextHand.id);
        
        await supabase
          .from('blackjack_games')
          .update({ current_turn_index: nextIdx })
          .eq('id', game.id);
        
        return;
      }
      nextIdx++;
    }

    // All players done - dealer's turn
    await supabase
      .from('blackjack_games')
      .update({ 
        status: 'dealer_turn',
        current_turn_index: null
      })
      .eq('id', game.id);

    // Auto-play dealer
    await playDealerHand();
  };

  const playDealerHand = async () => {
    if (!game || !game.current_round_id) return;

    try {
      let dealerCards = [...game.dealer_hand];
      const dealerPlayer = playersList.find(p => p.is_dealer);
      let dealerHitCount = 0;
      // If second card is a hidden placeholder, fetch the real hidden card from actions
      if (dealerCards.length >= 2 && dealerCards[1] === '__HIDDEN__') {
        try {
          const { data: hiddenAction } = await supabase
            .from('blackjack_actions')
            .select('card')
            .eq('round_id', game.current_round_id)
            .eq('action_type', 'card_dealt_dealer_hidden')
            .order('sequence_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (hiddenAction && hiddenAction.card) {
            dealerCards[1] = hiddenAction.card;
          }
        } catch (e) {
          console.error('Failed to fetch hidden dealer card from actions', e);
        }
      }
      let deck = [...(game.remaining_cards || [])];
      let discard = [...(game.discard_pile || [])];
      
      // Reveal hidden card
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        action_type: 'dealer_reveal',
        card: dealerCards[1]
      }]);

      // Dealer draws until 17+
      let handValue = calculateHandValue(dealerCards);
      const hitSoft17 = game.settings.hit_on_soft_17;

      while (handValue.value < 17 || (handValue.value === 17 && handValue.soft && hitSoft17)) {
        const draw = await drawFromShoe(deck, discard);
        if (!draw.card) break;
        deck = draw.deck;
        discard = draw.discard;
        const card = draw.card;
        dealerCards.push(card);
        handValue = calculateHandValue(dealerCards);
        dealerHitCount++;

        await supabase.from('blackjack_actions').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          action_type: 'dealer_hit',
          card
        }]);
      }

      const dealerBusted = handValue.value > 21;
      const dealerBlackjack = handValue.value === 21 && dealerCards.length === 2;

      if (dealerPlayer) {
        const dealerUpdates: any = {};
        if (dealerHitCount > 0) {
          dealerUpdates.times_hit = dealerPlayer.times_hit + dealerHitCount;
        }
        if (!dealerBusted) {
          dealerUpdates.times_stood = dealerPlayer.times_stood + 1;
        }
        if (Object.keys(dealerUpdates).length > 0) {
          await supabase
            .from('blackjack_players')
            .update(dealerUpdates)
            .eq('id', dealerPlayer.id);
        }
      }

      // Update game with final dealer hand
      await supabase
        .from('blackjack_games')
        .update({
          dealer_hand: dealerCards,
          dealer_status: dealerBusted ? 'busted' : (dealerBlackjack ? 'blackjack' : 'stood'),
          status: 'resolving'
        })
        .eq('id', game.id);

      // Log final action
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        action_type: dealerBusted ? 'dealer_bust' : 'dealer_stand',
        details: { final_value: handValue.value }
      }]);

      // Resolve all hands
      await resolveRound(dealerCards, handValue.value, dealerBusted, deck.length);
    } catch (e) {
      console.error('Play dealer hand error:', e);
    }
  };

  const resolveRound = async (
    dealerCards: string[],
    dealerValue: number,
    dealerBusted: boolean,
    remainingCount?: number
  ) => {
    if (!game || !game.current_round_id) return;

    try {
      const roundHands = await fetchHands(game.current_round_id);
      const dealerBlackjack = dealerValue === 21 && dealerCards.length === 2;

      const statsMap = new Map<string, BlackjackPlayer>();
      playersList.forEach(p => statsMap.set(p.id, { ...p }));
      const balanceDeltas: Record<string, number> = {};

      const dealerPlayer = playersList.find(p => p.is_dealer);
      const dealerStats = dealerPlayer ? { ...dealerPlayer } : null;
      if (dealerStats && dealerBlackjack) dealerStats.blackjacks += 1;
      if (dealerStats && dealerBusted) dealerStats.busts += 1;

      for (const hand of roundHands) {
        const playerValue = calculateHandValue(hand.cards);
        let result: string;
        let payout = 0;
        const targetPlayer = statsMap.get(hand.player_id);
        if (!targetPlayer) continue;

        if (hand.status === 'busted') {
          result = 'loss';
          payout = 0;
        } else if (hand.status === 'blackjack') {
          if (dealerBlackjack) {
            result = 'push';
            payout = 0;
          } else {
            result = 'blackjack';
            payout = Math.floor(hand.bet_amount * (1 + game.settings.blackjack_payout));
          }
        } else if (dealerBusted) {
          result = 'win';
          payout = hand.bet_amount * 2;
        } else if (playerValue.value > dealerValue) {
          result = 'win';
          payout = hand.bet_amount * 2;
        } else if (playerValue.value < dealerValue) {
          result = 'loss';
          payout = 0;
        } else {
          result = 'push';
          payout = 0;
        }

        const insuranceBet = hand.insurance_bet || 0;
        const insurancePayout = dealerBlackjack && insuranceBet > 0 ? insuranceBet * 2 : 0;

        // Update hand with result
        await supabase
          .from('blackjack_hands')
          .update({ result, payout, is_active: false })
          .eq('id', hand.id);

        balanceDeltas[hand.player_id] = (balanceDeltas[hand.player_id] || 0) + payout + insurancePayout;

        targetPlayer.hands_played += 1;

        if (result === 'win' || result === 'blackjack') {
          targetPlayer.hands_won += 1;
          targetPlayer.total_won += (payout - hand.bet_amount);
          targetPlayer.current_streak = Math.max(1, targetPlayer.current_streak + 1);
          targetPlayer.best_streak = Math.max(targetPlayer.current_streak, targetPlayer.best_streak);
          if (payout - hand.bet_amount > targetPlayer.biggest_win) {
            targetPlayer.biggest_win = payout - hand.bet_amount;
          }
        } else if (result === 'loss') {
          targetPlayer.hands_lost += 1;
          targetPlayer.total_lost += hand.bet_amount;
          targetPlayer.current_streak = Math.min(-1, targetPlayer.current_streak - 1);
          targetPlayer.worst_streak = Math.min(targetPlayer.current_streak, targetPlayer.worst_streak);
        } else {
          targetPlayer.hands_pushed += 1;
          targetPlayer.current_streak = 0;
        }

        if (result === 'blackjack') {
          targetPlayer.blackjacks += 1;
        }
        if (hand.status === 'busted') {
          targetPlayer.busts += 1;
        }

        targetPlayer.total_wagered += hand.bet_amount;
        if (hand.bet_amount > targetPlayer.biggest_bet) {
          targetPlayer.biggest_bet = hand.bet_amount;
        }

        if (insuranceBet > 0) {
          targetPlayer.total_wagered += insuranceBet;
          if (dealerBlackjack) {
            targetPlayer.total_won += insuranceBet;
          } else {
            targetPlayer.total_lost += insuranceBet;
          }
        }

        if (dealerStats) {
          dealerStats.hands_played += 1;
          dealerStats.total_wagered += hand.bet_amount;
          if (hand.bet_amount > dealerStats.biggest_bet) {
            dealerStats.biggest_bet = hand.bet_amount;
          }

          if (result === 'loss') {
            dealerStats.hands_won += 1;
            dealerStats.total_won += hand.bet_amount;
            dealerStats.current_streak = Math.max(1, dealerStats.current_streak + 1);
            dealerStats.best_streak = Math.max(dealerStats.current_streak, dealerStats.best_streak);
            if (hand.bet_amount > dealerStats.biggest_win) {
              dealerStats.biggest_win = hand.bet_amount;
            }
          } else if (result === 'win' || result === 'blackjack') {
            const netWin = payout - hand.bet_amount;
            dealerStats.hands_lost += 1;
            dealerStats.total_lost += netWin;
            dealerStats.current_streak = Math.min(-1, dealerStats.current_streak - 1);
            dealerStats.worst_streak = Math.min(dealerStats.current_streak, dealerStats.worst_streak);
          } else {
            dealerStats.hands_pushed += 1;
            dealerStats.current_streak = 0;
          }

          if (insuranceBet > 0) {
            dealerStats.total_wagered += insuranceBet;
            if (dealerBlackjack) {
              dealerStats.total_lost += insuranceBet;
            } else {
              dealerStats.total_won += insuranceBet;
            }
          }
        }

        // Log payout
        await supabase.from('blackjack_actions').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          player_id: hand.player_id,
          hand_id: hand.id,
          action_type: 'payout',
          amount: payout,
          details: { result, player_value: playerValue.value, dealer_value: dealerValue }
        }]);

        if (insurancePayout > 0) {
          await supabase.from('blackjack_actions').insert([{
            game_id: game.id,
            round_id: game.current_round_id,
            player_id: hand.player_id,
            hand_id: hand.id,
            action_type: 'insurance_paid',
            amount: insurancePayout
          }]);
        }

        // Add to history
        await supabase.from('blackjack_history').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          player_id: hand.player_id,
          player_hand: hand.cards,
          player_value: playerValue.value,
          dealer_hand: dealerCards,
          dealer_value: dealerValue,
          bet_amount: hand.bet_amount,
          payout,
          result,
          summary: `Player ${playerValue.value} vs Dealer ${dealerValue} - ${result.charAt(0).toUpperCase() + result.slice(1)}!`
        }]);
      }

      for (const [playerId, updated] of statsMap.entries()) {
        if (updated.is_dealer) continue;
        const balanceDelta = balanceDeltas[playerId] || 0;
        if (balanceDelta !== 0) {
          updated.balance += balanceDelta;
        }
        await supabase
          .from('blackjack_players')
          .update({
            balance: updated.balance,
            hands_played: updated.hands_played,
            hands_won: updated.hands_won,
            hands_lost: updated.hands_lost,
            hands_pushed: updated.hands_pushed,
            blackjacks: updated.blackjacks,
            busts: updated.busts,
            total_wagered: updated.total_wagered,
            total_won: updated.total_won,
            total_lost: updated.total_lost,
            biggest_win: updated.biggest_win,
            biggest_bet: updated.biggest_bet,
            current_streak: updated.current_streak,
            best_streak: updated.best_streak,
            worst_streak: updated.worst_streak
          })
          .eq('id', playerId);
      }

      if (dealerStats) {
        await supabase
          .from('blackjack_players')
          .update({
            hands_played: dealerStats.hands_played,
            hands_won: dealerStats.hands_won,
            hands_lost: dealerStats.hands_lost,
            hands_pushed: dealerStats.hands_pushed,
            blackjacks: dealerStats.blackjacks,
            busts: dealerStats.busts,
            total_wagered: dealerStats.total_wagered,
            total_won: dealerStats.total_won,
            total_lost: dealerStats.total_lost,
            biggest_win: dealerStats.biggest_win,
            biggest_bet: dealerStats.biggest_bet,
            current_streak: dealerStats.current_streak,
            best_streak: dealerStats.best_streak,
            worst_streak: dealerStats.worst_streak
          })
          .eq('id', dealerStats.id);
      }

      // Update round as completed
      await supabase
        .from('blackjack_rounds')
        .update({ 
          status: 'completed',
          dealer_final_hand: dealerCards,
          dealer_final_value: dealerValue,
          dealer_busted: dealerBusted,
          completed_at: new Date().toISOString()
        })
        .eq('id', game.current_round_id);

      // Reset game to table_idle for next round
      await supabase
        .from('blackjack_games')
        .update({ status: 'table_idle' })
        .eq('id', game.id);

      // Reset player betting state
      await supabase
        .from('blackjack_players')
        .update({ current_bet: 0, has_placed_bet: false })
        .eq('game_id', game.id);

      const finalRemaining = typeof remainingCount === 'number'
        ? remainingCount
        : (game.remaining_cards ? game.remaining_cards.length : 0);
      const threshold = getReshuffleThreshold(game.settings.num_decks);
      if (finalRemaining < threshold) {
        await reshuffleShoe('auto_low_cards_after_round', { silent: !player?.is_dealer });
      }

      toast({ title: 'Round Complete', description: 'Results have been calculated' });
    } catch (e) {
      console.error('Resolve round error:', e);
    }
  };

  const handleGoToLobby = async () => {
    if (!game || !player?.is_dealer) return;
    try {
      await supabase
        .from('blackjack_games')
        .update({ status: 'lobby' })
        .eq('id', game.id);
      setScreen('lobby');
    } catch (e) {
      console.error('Go to lobby error:', e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY_CODE);
    localStorage.removeItem(STORAGE_KEY_NAME);
    localStorage.removeItem(STORAGE_KEY_PLAYER_ID);
    setGame(null);
    setPlayer(null);
    setPlayersList([]);
    setGameCode('');
    setScreen('join-create');
  };

  const copyInviteUrlToClipboard = () => {
    try {
      const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?code=${game?.code}` : '';
      if (!inviteUrl) return;
      navigator.clipboard.writeText(inviteUrl);
      toast({ title: 'Invite copied', description: 'Invite URL copied to clipboard' });
    } catch (e) {
      console.error('Copy invite failed', e);
      toast({ title: 'Error', description: 'Failed to copy invite link' });
    }
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  
  if (screen === "join-create") {
    return (
      <>
        <JoinCreateScreen
          gameCode={gameCode}
          setGameCode={setGameCode}
          recentGames={recentGames}
          loading={loading}
          error={error}
          onJoinGame={handleJoinGame}
          onCreateGame={() => {
            setMode("create");
            setScreen("enter-name");
          }}
          onRecentGameSelect={handleRecentGameSelect}
        />
        <Toaster />
      </>
    );
  }

  if (screen === "enter-name") {
    return (
      <>
        <EnterNameScreen
          mode={mode!}
          gameCode={gameCode}
          name={name}
          setName={setName}
          loading={loading}
          error={error}
          onSubmit={handleNameSubmit}
          onBack={() => setScreen("join-create")}
        />
        <Toaster />
      </>
    );
  }

  if (screen === "confirm-settings") {
    return (
      <>
        <ConfirmSettingsScreen
          dealerStandsOnSoft17={tempDealerStandsOnSoft17}
          setDealerStandsOnSoft17={setTempDealerStandsOnSoft17}
          insuranceEnabled={tempInsuranceEnabled}
          setInsuranceEnabled={setTempInsuranceEnabled}
          doubleDownEnabled={tempDoubleDownEnabled}
          setDoubleDownEnabled={setTempDoubleDownEnabled}
          splitEnabled={tempSplitEnabled}
          setSplitEnabled={setTempSplitEnabled}
          maxSplits={tempMaxSplits}
          setMaxSplits={setTempMaxSplits}
          numberOfDecks={tempNumberOfDecks}
          setNumberOfDecks={setTempNumberOfDecks}
          loading={loading}
          error={error}
          onConfirm={handleSettingsConfirm}
          onBack={() => setScreen("enter-name")}
        />
        <Toaster />
      </>
    );
  }

  if ((screen === "lobby" || screen === "game") && game && player) {
    const deckTotal = getTotalCards(game.settings.num_decks);
    const deckRemaining = game.remaining_cards ? game.remaining_cards.length : 0;
    const deckThresholdPercent = RESHUFFLE_THRESHOLD_PERCENT;

    const renderActiveView = () => {
      if (screen === "lobby") {
        return (
          <LobbyScreen
            game={game}
            player={player}
            playersList={playersList}
            chipRequests={chipRequests}
            setChipRequestDialogOpen={setChipRequestDialogOpen}
            setChipRequestAmount={setChipRequestAmount}
            onStartBetting={handleStartBetting}
            onApproveChipRequest={handleApproveChipRequest}
            onGiveChips={handleGiveChips}
            onLogout={handleLogout}
            onSitAtTable={() => setScreen('game')}
            copyInviteUrlToClipboard={copyInviteUrlToClipboard}
            onUpdatePlayerOrder={handleUpdatePlayerOrder}
          />
        );
      }

      const myHands = hands
        .filter(h => h.player_id === player.id)
        .sort((a, b) => a.hand_index - b.hand_index);
      const activeHand = myHands.find(h => h.is_active) || myHands.find(h => h.status === 'active');
      const dealerHandValue = game.dealer_hand ? calculateHandValue(game.dealer_hand) : { value: 0, soft: false };
      const showFullDealerHand =
        player.is_dealer ||
        ['dealer_turn', 'resolving', 'finished'].includes(game.status) ||
        ['playing', 'stood', 'busted', 'blackjack'].includes(game.dealer_status);

      if (player.is_dealer) {
        return (
          <DealerGameView
            dealerHand={game.dealer_hand || []}
            dealerValue={dealerHandValue.value}
            dealerSoft={dealerHandValue.soft}
            dealerStatus={game.dealer_status}
            players={playersList}
            hands={hands}
            gameStatus={game.status}
            chipRequests={chipRequests}
            calculateHandValue={calculateHandValue}
            onDealCards={handleDealCards}
            onStartBetting={handleStartBetting}
            onApproveChipRequest={handleApproveChipRequest}
            onGiveChips={handleGiveChips}
            onForceLobby={handleGoToLobby}
            onBackToLobby={() => setScreen('lobby')}
            loading={loading}
            deckRemaining={deckRemaining}
            deckTotal={deckTotal}
            deckThresholdPercent={deckThresholdPercent}
            onReshuffle={handleReshuffleShoe}
          />
        );
      } else {
        const canDoubleDown = !!activeHand && activeHand.cards.length === 2 && activeHand.status === 'active';
        const canSplit = !!activeHand
          && activeHand.cards.length === 2
          && activeHand.status === 'active'
          && game.settings.split_enabled
          && canSplitCards(activeHand.cards)
          && myHands.length < (game.settings.max_splits + 1)
          && player.balance >= activeHand.bet_amount;
        const insuranceHand = myHands.find(h => h.hand_index === 0) || activeHand;
        const insuranceAmount = insuranceHand ? Math.floor(insuranceHand.bet_amount / 2) : 0;
        const insuranceDecision = insuranceHand ? insuranceResponses[insuranceHand.id] : undefined;
        const showInsurancePrompt = !!insuranceHand
          && game.status === 'insurance'
          && !insuranceDecision
          && player.has_placed_bet
          && game.settings.insurance_enabled;
        
        return (
          <PlayerGameView
            player={player}
            myHands={myHands}
            activeHand={activeHand}
            dealerHand={game.dealer_hand || []}
            gameStatus={game.status}
            showFullDealerHand={showFullDealerHand}
            selectedBet={selectedBet}
            setSelectedBet={setSelectedBet}
            betIncrements={game.settings.bet_increments || [1, 5, 10, 25, 50, 100]}
            calculateHandValue={calculateHandValue}
            onPlaceBet={handlePlaceBet}
            onHit={handleHit}
            onStand={handleStand}
            onDoubleDown={handleDoubleDown}
            doubleDownEnabled={game.settings.double_down_enabled}
            canDoubleDown={canDoubleDown}
            splitEnabled={game.settings.split_enabled}
            canSplit={canSplit}
            onSplit={handleSplit}
            showInsurancePrompt={showInsurancePrompt}
            insuranceAmount={insuranceAmount}
            insuranceDecision={insuranceDecision}
            onInsuranceDecision={handleInsuranceDecision}
            onBackToLobby={() => setScreen('lobby')}
            deckRemaining={deckRemaining}
            deckTotal={deckTotal}
            deckThresholdPercent={deckThresholdPercent}
          />
        );
      }
    };

    return (
      <div className="min-h-screen flex flex-col">
        <BlackjackHeader 
          gameCode={game.code} 
          player={player} 
          onLogout={handleLogout}
          onOpenSettings={() => setSettingsDialogOpen(true)}
          onOpenChipRequest={() => { setChipRequestAmount(""); setChipRequestDialogOpen(true); }}
        />
        <div className="flex-1 overflow-hidden flex flex-col pt-16">
          {renderActiveView()}
        </div>

        <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Game Settings</DialogTitle>
              <DialogDescription>
                View the current table rules.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Dealer hits on Soft 17</span>
                <span className="text-muted-foreground">{game.settings.hit_on_soft_17 ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Insurance</span>
                <span className="text-muted-foreground">{game.settings.insurance_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Double Down</span>
                <span className="text-muted-foreground">{game.settings.double_down_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Splitting</span>
                <span className="text-muted-foreground">{game.settings.split_enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Number of Decks</span>
                <span className="text-muted-foreground">{game.settings.num_decks}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <span className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Note</span>
                <span className="text-xs text-muted-foreground">Settings can only be changed during table creation.</span>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setSettingsDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Chip Request Dialog */}
        <Dialog open={chipRequestDialogOpen} onOpenChange={setChipRequestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Chips</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="number"
                placeholder="Amount"
                value={chipRequestAmount}
                onChange={(e) => setChipRequestAmount(e.target.value)}
              />
              <div className="flex gap-2">
                {[5, 10, 50, 100].map((amount) => (
                  <Button
                    key={amount}
                    variant="outline"
                    size="sm"
                    onClick={() => setChipRequestAmount(String(amount))}
                    className="flex-1"
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleRequestChips} className="w-full">
                Request ${chipRequestAmount || '0'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        <Toaster />
      </div>
    );
  }

  // Fallback
  return (
    <>
      <JoinCreateScreen
        gameCode={gameCode}
        setGameCode={setGameCode}
        recentGames={recentGames}
        loading={loading}
        error={error}
        onJoinGame={handleJoinGame}
        onCreateGame={() => {
          setMode("create");
          setScreen("enter-name");
        }}
        onRecentGameSelect={handleRecentGameSelect}
      />
      <Toaster />
    </>
  );
};

export default Blackjack;
