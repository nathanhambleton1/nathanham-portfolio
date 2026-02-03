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
import JoinCreateScreen from "../../drunk/components/blackjack/JoinCreateScreen";
import EnterNameScreen from "../../drunk/components/blackjack/EnterNameScreen";
import ConfirmSettingsScreen from "../../drunk/components/blackjack/ConfirmSettingsScreen";
import LobbyScreen from "../../drunk/components/blackjack/LobbyScreen";
import DealerGameView from "../../drunk/components/blackjack/DealerGameView";
import PlayerGameView from "../../drunk/components/blackjack/PlayerGameView";

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Screen = "join-create" | "enter-name" | "confirm-settings" | "lobby" | "game";
type GameStatus = "lobby" | "betting" | "dealing" | "playing" | "dealer_turn" | "resolving" | "finished" | "table_idle";

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
  
  // Betting state
  const [selectedBet, setSelectedBet] = useState<number>(5);
  
  // QR Dialog
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  // Settings Dialog (accessible at all times)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  
  // Chip request dialog (for players)
  const [chipRequestDialogOpen, setChipRequestDialogOpen] = useState(false);
  const [chipRequestAmount, setChipRequestAmount] = useState<string>("100");

  const navigate = useNavigate();
  const channelRef = useRef<any>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const playersListRef = useRef<BlackjackPlayer[]>([]);
  const gameRef = useRef<BlackjackGame | null>(null);
  const playerRef = useRef<BlackjackPlayer | null>(null);
  const dealingTriggeredRef = useRef<boolean>(false);

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
      .eq('round_id', roundId);
    
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

          if (playerData && playerData.game_id === gameData.id) {
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
          }
        } catch (e) {
          console.error('Session restore failed:', e);
        }
      })();
    }
  }, []);

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
        if (!game) throw new Error('No game selected');

        // Check if player already exists
        const { data: existingPlayers } = await supabase
          .from('blackjack_players')
          .select('*')
          .eq('game_id', game.id)
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
              game_id: game.id,
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
            game_id: game.id,
            player_id: currentPlayer.id,
            action_type: 'player_joined',
            details: { name: cleaned.toUpperCase() }
          }]);
        }

        setPlayer(currentPlayer);
        localStorage.setItem(STORAGE_KEY_NAME, cleaned.toUpperCase());
        localStorage.setItem(STORAGE_KEY_CODE, game.code);
        localStorage.setItem(STORAGE_KEY_PLAYER_ID, currentPlayer.id);
        
        const players = await fetchPlayers(game.id);
        setPlayersList(players);
        
        setScreen(game.status === 'lobby' ? 'lobby' : 'game');
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

      setScreen('game');
    } catch (e) {
      console.error('Start betting error:', e);
      toast({ title: 'Error', description: 'Failed to start betting' });
    }
  };

  const handleUpdatePlayerOrder = async (orderedPlayerIds: string[]) => {
    if (!game || !player?.is_dealer) return;

    try {
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

  const drawCard = async (): Promise<string | null> => {
    if (!game) return null;
    
    let deck = [...game.remaining_cards];
    let discard = [...game.discard_pile];
    
    // Reshuffle if needed (less than 25% remaining)
    if (deck.length < (game.settings.num_decks * 52 * 0.25)) {
      deck = generateDeck(game.settings.num_decks);
      discard = [];
      await supabase
        .from('blackjack_games')
        .update({ 
          remaining_cards: deck, 
          discard_pile: discard,
          last_reshuffle_at: new Date().toISOString()
        })
        .eq('id', game.id);
    }
    
    if (deck.length === 0) return null;
    
    const card = deck.pop()!;
    await supabase
      .from('blackjack_games')
      .update({ remaining_cards: deck })
      .eq('id', game.id);
    
    return card;
  };

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

      let deck = [...game.remaining_cards];
      if (deck.length < (activePlayers.length * 2 + 2)) {
        // Need to reshuffle
        deck = generateDeck(game.settings.num_decks);
        toast({ title: 'Reshuffling deck', description: 'Not enough cards remaining' });
      }

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
        if (deck.length === 0) break;
        const card = deck.pop()!;
        
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
      const dealerCard1 = deck.pop()!;
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
        .update({ remaining_cards: deck, dealer_hand: [dealerCard1], dealer_visible_card: dealerCard1 })
        .eq('id', game.id);

      await dealCardWithDelay(1000);

      // ROUND 2: Deal second card to each player
      for (const p of orderedPlayers) {
        if (deck.length === 0) break;
        const card = deck.pop()!;
        
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
      const dealerCard2 = deck.pop()!;
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        action_type: 'card_dealt_dealer_hidden',
        card: dealerCard2,
        sequence_number: sequenceNum++
      }]);

      // Update game state with dealer's first card and a hidden placeholder
      // so UIs show the second card face-down immediately after it's dealt.
      await supabase
        .from('blackjack_games')
        .update({
          remaining_cards: deck,
          dealer_hand: [dealerCard1, '__HIDDEN__'],
          dealer_visible_card: dealerCard1,
          status: 'playing',
          current_turn_index: 0
        })
        .eq('id', game.id);

      // Find first active player (skip those with blackjack)
      let firstActiveFound = false;
      for (let i = 0; i < orderedPlayers.length; i++) {
        const p = orderedPlayers[i];
        const { data: handData } = await supabase
          .from('blackjack_hands')
          .select('*')
          .eq('round_id', game.current_round_id)
          .eq('player_id', p.id)
          .eq('hand_index', 0)
          .single();

        if (!handData) continue;

        // Only activate if the hand is still 'active' (not blackjack/busted)
        if (handData.status === 'active') {
          await supabase
            .from('blackjack_hands')
            .update({ is_active: true })
            .eq('id', handData.id);

          await supabase
            .from('blackjack_games')
            .update({ current_turn_index: i })
            .eq('id', game.id);

          firstActiveFound = true;
          break;
        }
      }

      // If no active players (everyone has blackjack), move to dealer turn
      if (!firstActiveFound) {
        await supabase
          .from('blackjack_games')
          .update({ status: 'dealer_turn', current_turn_index: null })
          .eq('id', game.id);

        // Refresh and play dealer hand
        const refreshed = await fetchGame(game.code);
        if (refreshed) setGame(refreshed);
        await playDealerHand();
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

  const handleHit = async () => {
    if (!game || !player || player.is_dealer || !game.current_round_id) return;
    
    const myHand = hands.find(h => h.player_id === player.id && h.is_active);
    if (!myHand || myHand.status !== 'active') return;

    try {
      let deck = [...game.remaining_cards];
      if (deck.length === 0) {
        toast({ title: 'Error', description: 'No cards left in deck' });
        return;
      }

      const card = deck.pop()!;
      const newCards = [...myHand.cards, card];
      const handValue = calculateHandValue(newCards);
      const isBusted = handValue.value > 21;

      await supabase
        .from('blackjack_games')
        .update({ remaining_cards: deck })
        .eq('id', game.id);

      await supabase
        .from('blackjack_hands')
        .update({ 
          cards: newCards,
          status: isBusted ? 'busted' : 'active'
        })
        .eq('id', myHand.id);

      // Update player stats
      await supabase
        .from('blackjack_players')
        .update({ times_hit: player.times_hit + 1 })
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
        .update({ times_stood: player.times_stood + 1 })
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
    
    const myHand = hands.find(h => h.player_id === player.id && h.is_active);
    if (!myHand || myHand.status !== 'active' || myHand.cards.length !== 2) return;
    if (player.balance < myHand.bet_amount) {
      toast({ title: 'Insufficient balance', description: 'Not enough chips to double down' });
      return;
    }

    try {
      let deck = [...game.remaining_cards];
      if (deck.length === 0) return;

      const card = deck.pop()!;
      const newCards = [...myHand.cards, card];
      const handValue = calculateHandValue(newCards);
      const isBusted = handValue.value > 21;

      // Deduct additional bet
      await supabase
        .from('blackjack_players')
        .update({ 
          balance: player.balance - myHand.bet_amount,
          times_doubled: player.times_doubled + 1
        })
        .eq('id', player.id);

      await supabase
        .from('blackjack_games')
        .update({ remaining_cards: deck })
        .eq('id', game.id);

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

  const advanceToNextPlayer = async () => {
    if (!game || !game.current_round_id) return;

    const activePlayers = playersList.filter(p => !p.is_dealer && p.has_placed_bet);
    const orderedPlayers = game.turn_order.length > 0 
      ? game.turn_order.map(id => activePlayers.find(p => p.id === id)).filter(Boolean) as BlackjackPlayer[]
      : activePlayers;

    const currentIdx = game.current_turn_index ?? 0;
    
    // Find next player with an active hand
    let nextIdx = currentIdx + 1;
    while (nextIdx < orderedPlayers.length) {
      const nextPlayer = orderedPlayers[nextIdx];
      const nextHand = hands.find(h => h.player_id === nextPlayer.id && h.hand_index === 0);
      if (nextHand && (nextHand.status === 'active' || nextHand.status === 'betting')) {
        // Set this player's hand as active
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
      let deck = [...game.remaining_cards];
      
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
        if (deck.length === 0) break;
        
        const card = deck.pop()!;
        dealerCards.push(card);
        handValue = calculateHandValue(dealerCards);

        await supabase.from('blackjack_actions').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          action_type: 'dealer_hit',
          card
        }]);
      }

      const dealerBusted = handValue.value > 21;
      const dealerBlackjack = handValue.value === 21 && dealerCards.length === 2;

      // Update game with final dealer hand
      await supabase
        .from('blackjack_games')
        .update({
          remaining_cards: deck,
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
      await resolveRound(dealerCards, handValue.value, dealerBusted);
    } catch (e) {
      console.error('Play dealer hand error:', e);
    }
  };

  const resolveRound = async (dealerCards: string[], dealerValue: number, dealerBusted: boolean) => {
    if (!game || !game.current_round_id) return;

    try {
      const roundHands = await fetchHands(game.current_round_id);
      
      for (const hand of roundHands) {
        const playerValue = calculateHandValue(hand.cards);
        let result: string;
        let payout = 0;
        const targetPlayer = playersList.find(p => p.id === hand.player_id);
        if (!targetPlayer) continue;

        if (hand.status === 'busted') {
          result = 'loss';
          payout = 0;
        } else if (hand.status === 'blackjack') {
          if (dealerValue === 21 && dealerCards.length === 2) {
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

        // Update hand with result
        await supabase
          .from('blackjack_hands')
          .update({ result, payout, is_active: false })
          .eq('id', hand.id);

        // Update player balance and stats
        const newBalance = targetPlayer.balance + payout;
        const statsUpdate: any = {
          balance: newBalance,
          hands_played: targetPlayer.hands_played + 1,
        };

        if (result === 'win' || result === 'blackjack') {
          statsUpdate.hands_won = targetPlayer.hands_won + 1;
          statsUpdate.total_won = targetPlayer.total_won + (payout - hand.bet_amount);
          statsUpdate.current_streak = Math.max(1, targetPlayer.current_streak + 1);
          statsUpdate.best_streak = Math.max(statsUpdate.current_streak, targetPlayer.best_streak);
          if (payout - hand.bet_amount > targetPlayer.biggest_win) {
            statsUpdate.biggest_win = payout - hand.bet_amount;
          }
        } else if (result === 'loss') {
          statsUpdate.hands_lost = targetPlayer.hands_lost + 1;
          statsUpdate.total_lost = targetPlayer.total_lost + hand.bet_amount;
          statsUpdate.current_streak = Math.min(-1, targetPlayer.current_streak - 1);
          statsUpdate.worst_streak = Math.min(statsUpdate.current_streak, targetPlayer.worst_streak);
        } else {
          statsUpdate.hands_pushed = targetPlayer.hands_pushed + 1;
          statsUpdate.current_streak = 0;
        }

        if (result === 'blackjack') {
          statsUpdate.blackjacks = targetPlayer.blackjacks + 1;
        }
        if (hand.status === 'busted') {
          statsUpdate.busts = targetPlayer.busts + 1;
        }

        statsUpdate.total_wagered = targetPlayer.total_wagered + hand.bet_amount;
        if (hand.bet_amount > targetPlayer.biggest_bet) {
          statsUpdate.biggest_bet = hand.bet_amount;
        }

        await supabase
          .from('blackjack_players')
          .update(statsUpdate)
          .eq('id', hand.player_id);

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

  if (screen === "lobby" && game && player) {
    return (
      <>
          <LobbyScreen
            game={game}
            player={player}
            playersList={playersList}
            chipRequests={chipRequests}
            qrDialogOpen={qrDialogOpen}
            setQrDialogOpen={setQrDialogOpen}
            chipRequestDialogOpen={chipRequestDialogOpen}
            setChipRequestDialogOpen={setChipRequestDialogOpen}
            chipRequestAmount={chipRequestAmount}
            setChipRequestAmount={setChipRequestAmount}
            onStartBetting={handleStartBetting}
            onRequestChips={handleRequestChips}
            onApproveChipRequest={handleApproveChipRequest}
            onGiveChips={handleGiveChips}
            onLogout={handleLogout}
            onSitAtTable={() => setScreen('game')}
            copyInviteUrlToClipboard={copyInviteUrlToClipboard}
            onUpdatePlayerOrder={handleUpdatePlayerOrder}
          />
        <Toaster />
      </>
    );
  }

  if (screen === "game" && game && player) {
    const myHand = hands.find(h => h.player_id === player.id && h.hand_index === 0);
    const dealerHandValue = game.dealer_hand ? calculateHandValue(game.dealer_hand) : { value: 0, soft: false };
    const showFullDealerHand =
      player.is_dealer ||
      ['dealer_turn', 'resolving', 'finished'].includes(game.status) ||
      ['playing', 'stood', 'busted', 'blackjack'].includes(game.dealer_status);

    if (player.is_dealer) {
      return (
        <>
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
          />
          <Toaster />
        </>
      );
    } else {
      const canDoubleDown = myHand?.cards.length === 2 && myHand.status === 'active';
      
      return (
        <>
          <PlayerGameView
            player={player}
            myHand={myHand}
            dealerVisibleCard={game.dealer_visible_card}
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
            onBackToLobby={() => setScreen('lobby')}
          />
          <Toaster />
        </>
      );
    }
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
