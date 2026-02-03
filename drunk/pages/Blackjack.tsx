import { useEffect, useState, useRef, useCallback } from "react";
import { Users, Settings, QrCode, Copy, ChevronDown, Info, Crown, Plus, Minus, Play, RefreshCw, UserPlus, DollarSign, Clock, Check, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
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

type Screen = "join-create" | "enter-name" | "confirm-settings" | "lobby" | "game";
type GameStatus = "lobby" | "betting" | "dealing" | "playing" | "dealer_turn" | "resolving" | "finished";

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

  useEffect(() => {
    if (!game?.id || (screen !== 'lobby' && screen !== 'game')) return;

    const pollTimer = window.setInterval(() => {
      refreshGameState();
    }, 2000);

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
      // Ensure turn_order is set before dealing
      let turnOrder = game.turn_order && game.turn_order.length > 0 
        ? game.turn_order 
        : activePlayers.sort((a, b) => (a.seat_position || 0) - (b.seat_position || 0)).map(p => p.id);
      
      if (!game.turn_order || game.turn_order.length === 0) {
        await supabase
          .from('blackjack_games')
          .update({ turn_order: turnOrder })
          .eq('id', game.id);
      }

      let deck = [...game.remaining_cards];
      let sequenceNum = 1;

      // Deduct bets from player balances and create hands
      for (const p of activePlayers) {
        await supabase
          .from('blackjack_players')
          .update({ balance: p.balance - p.current_bet })
          .eq('id', p.id);

        // Create hand record
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

      // Deal first card to each player (in turn order)
      const orderedPlayers = turnOrder.map(id => activePlayers.find(p => p.id === id)).filter(Boolean) as BlackjackPlayer[];

      for (const p of orderedPlayers) {
        if (deck.length === 0) break;
        const card = deck.pop()!;
        
        // Update hand
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
        }

        // Log action
        await supabase.from('blackjack_actions').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          player_id: p.id,
          hand_id: handData?.id,
          action_type: 'card_dealt_player',
          card,
          sequence_number: sequenceNum++
        }]);
      }

      // Deal first card to dealer (face up)
      const dealerCard1 = deck.pop()!;
      await supabase.from('blackjack_actions').insert([{
        game_id: game.id,
        round_id: game.current_round_id,
        action_type: 'card_dealt_dealer',
        card: dealerCard1,
        sequence_number: sequenceNum++
      }]);

      // Deal second card to each player
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
        }

        await supabase.from('blackjack_actions').insert([{
          game_id: game.id,
          round_id: game.current_round_id,
          player_id: p.id,
          hand_id: handData?.id,
          action_type: 'card_dealt_player',
          card,
          sequence_number: sequenceNum++
        }]);
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

      // Update game state
      await supabase
        .from('blackjack_games')
        .update({
          remaining_cards: deck,
          dealer_hand: [dealerCard1, dealerCard2],
          dealer_visible_card: dealerCard1,
          status: 'playing',
          current_turn_index: 0
        })
        .eq('id', game.id);

      // Set first player's hand as active
      if (orderedPlayers.length > 0) {
        await supabase
          .from('blackjack_hands')
          .update({ is_active: true })
          .eq('round_id', game.current_round_id)
          .eq('player_id', orderedPlayers[0].id)
          .eq('hand_index', 0);
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
            payout = hand.bet_amount;
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
          payout = hand.bet_amount;
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

      // Reset game to lobby for next round
      await supabase
        .from('blackjack_games')
        .update({ status: 'lobby' })
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
  // RENDER FUNCTIONS
  // ============================================================================

  const renderJoinCreate = () => (
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
                handleJoinGame();
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
                {loading ? 'Looking for game...' : 'Join Table'}
              </Button>
              {error && screen === 'join-create' && <div className="text-destructive text-sm text-center">{error}</div>}
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
              <Crown className="w-5 h-5 mr-2" />
              Create Table (Dealer)
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
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl mb-2">
            {mode === "create" ? "Dealer Name" : "Enter Your Name"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "You'll be the dealer for this table."
              : `Joining table: ${gameCode}`}
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
          <CardTitle className="text-center">Table Settings</CardTitle>
          <CardDescription className="text-center">Configure the rules for your blackjack table</CardDescription>
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
            <label>Double down enabled</label>
            <Switch
              checked={tempDoubleDownEnabled}
              onCheckedChange={setTempDoubleDownEnabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <label>Split enabled</label>
            <Switch
              checked={tempSplitEnabled}
              onCheckedChange={setTempSplitEnabled}
            />
          </div>
          {tempSplitEnabled && (
            <div className="space-y-2">
              <label className="text-sm">Max splits per hand</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((num) => (
                  <Button
                    key={num}
                    type="button"
                    variant={parseInt(tempMaxSplits) === num ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTempMaxSplits(num.toString())}
                    className="flex-1"
                  >
                    {num}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm">Number of decks</label>
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
          {error && <div className="text-destructive text-sm text-center">{error}</div>}
          <Button onClick={handleSettingsConfirm} className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Table'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderLobby = () => {
    const nonDealerPlayers = playersList.filter(p => !p.is_dealer);
    const isDealer = player?.is_dealer;
    const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?code=${game?.code}` : '';

    return (
      <div className="min-h-screen bg-gradient-bg p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header Card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    {isDealer && <Crown className="w-5 h-5 text-yellow-500" />}
                    {game?.name || 'Blackjack Table'}
                  </CardTitle>
                  <CardDescription className="font-mono text-lg mt-1">
                    Code: <span className="text-primary font-bold">{game?.code}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-6 w-6 p-0"
                      onClick={() => {
                        navigator.clipboard.writeText(game?.code || '');
                        toast({ title: 'Copied!', description: 'Game code copied to clipboard' });
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setQrDialogOpen(true)}>
                  <QrCode className="w-4 h-4 mr-1" />
                  QR
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {nonDealerPlayers.length} player{nonDealerPlayers.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1">
                  <Settings className="w-4 h-4" />
                  {game?.settings?.num_decks} decks
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Players List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Players at Table
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nonDealerPlayers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Waiting for players to join...</p>
                  <p className="text-sm">Share the code: <span className="font-mono font-bold">{game?.code}</span></p>
                </div>
              ) : (
                nonDealerPlayers.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      p.id === player?.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        p.is_online ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Balance: ${p.balance}
                        </p>
                      </div>
                    </div>
                    {isDealer && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGiveChips(p.id, 100)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          $100
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Chip Requests (Dealer Only) */}
          {isDealer && chipRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Chip Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {chipRequests.map(req => {
                  const reqPlayer = playersList.find(p => p.id === req.player_id);
                  return (
                    <div key={req.id} className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <div>
                        <p className="font-medium">{reqPlayer?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">Requesting ${req.amount}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => handleApproveChipRequest(req.id, true)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleApproveChipRequest(req.id, false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Your Info (Player) */}
          {!isDealer && player && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/40 rounded-lg text-center">
                    <p className="text-xs uppercase text-muted-foreground mb-1">Name</p>
                    <p className="font-semibold">{player.name}</p>
                  </div>
                  <div className="p-4 bg-primary/10 rounded-lg text-center border border-primary/20">
                    <p className="text-xs uppercase text-muted-foreground mb-1">Balance</p>
                    <p className="font-bold text-primary text-xl">${player.balance}</p>
                  </div>
                </div>
                <Button
                  className="w-full mt-4"
                  variant="outline"
                  onClick={() => setChipRequestDialogOpen(true)}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Request Chips
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Table Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Table Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between p-2 rounded bg-muted/20">
                  <span className="text-muted-foreground">Dealer</span>
                  <span>{game?.settings?.hit_on_soft_17 ? 'Hits Soft 17' : 'Stands All 17s'}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/20">
                  <span className="text-muted-foreground">Decks</span>
                  <span>{game?.settings?.num_decks}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/20">
                  <span className="text-muted-foreground">Insurance</span>
                  <span>{game?.settings?.insurance_enabled ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/20">
                  <span className="text-muted-foreground">Double Down</span>
                  <span>{game?.settings?.double_down_enabled ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/20">
                  <span className="text-muted-foreground">Split</span>
                  <span>{game?.settings?.split_enabled ? `Up to ${game?.settings?.max_splits}` : 'No'}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-muted/20">
                  <span className="text-muted-foreground">Blackjack Pays</span>
                  <span>3:2</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {isDealer ? (
              <Button
                className="w-full py-6 text-lg"
                disabled={nonDealerPlayers.length === 0}
                onClick={handleStartBetting}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Betting Round
              </Button>
            ) : (
              <div className="bg-primary/5 p-4 rounded-lg flex items-start gap-4">
                <Clock className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Waiting for Dealer</p>
                  <p className="text-sm text-muted-foreground">The dealer will start the game when ready.</p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              Leave Table
            </Button>
          </div>
        </div>

        {/* QR Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Table</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <QRCodeSVG value={inviteUrl} size={200} />
              <p className="text-2xl font-mono font-bold">{game?.code}</p>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  toast({ title: 'Copied!', description: 'Invite link copied to clipboard' });
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Chip Request Dialog */}
        <Dialog open={chipRequestDialogOpen} onOpenChange={setChipRequestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Chips</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  value={chipRequestAmount}
                  onChange={(e) => setChipRequestAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <div className="flex gap-2">
                {[50, 100, 200, 500].map(amt => (
                  <Button
                    key={amt}
                    variant={chipRequestAmount === amt.toString() ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setChipRequestAmount(amt.toString())}
                  >
                    ${amt}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChipRequestDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRequestChips}>Send Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Toaster />
      </div>
    );
  };

  const renderGame = () => {
    const isDealer = player?.is_dealer;
    const nonDealerPlayers = playersList.filter(p => !p.is_dealer);
    const anyBetsPlaced = nonDealerPlayers.some(p => p.has_placed_bet);
    const myHand = hands.find(h => h.player_id === player?.id && h.hand_index === 0);
    const dealerHandValue = game?.dealer_hand ? calculateHandValue(game.dealer_hand) : null;
    const showFullDealerHand =
      !!isDealer ||
      ['dealer_turn', 'resolving', 'finished'].includes(game?.status || '') ||
      ['playing', 'stood', 'busted', 'blackjack'].includes(game?.dealer_status || '');
    const dealerDisplayCards = (() => {
      const cards = game?.dealer_hand || [];
      if (cards.length === 0) return [];
      if (showFullDealerHand) return cards;

      const faceUp = game?.dealer_visible_card || cards[0];
      return [faceUp, '__HIDDEN__'];
    })();

    return (
      <div className="min-h-screen bg-gradient-bg flex flex-col">
        {isDealer ? (
          <>
            {/* Top Bar (dealer view) */}
            <div className="p-4 border-b bg-card/50 backdrop-blur">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Table {game?.code}</p>
                  <p className="font-semibold capitalize">{player?.name?.toLowerCase()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="font-bold text-primary">${player?.balance}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Game Area (dealer view) */}
            <div className="flex-1 p-4">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Dealer Area */}
                <Card className="bg-green-900/20 border-green-900/30">
                  <CardContent className="py-4">
                    <div className="text-center">
                      <p className="text-xs uppercase text-muted-foreground mb-2">Dealer</p>
                      {dealerDisplayCards.length > 0 ? (
                        <div className="flex justify-center gap-2 mb-2">
                          {dealerDisplayCards.map((card: string, idx: number) => {
                            const isHidden = card === '__HIDDEN__';
                            const isRed = !isHidden && isRedSuit(card);
                            return (
                              <div
                                key={idx}
                                className={`w-12 h-16 rounded-lg flex items-center justify-center text-lg font-bold ${
                                  isHidden ? 'bg-primary/30 border border-dashed border-primary/60 text-primary' :
                                  isRed ? 'bg-white text-red-600' : 'bg-white text-black'
                                }`}
                                aria-label={isHidden ? 'Hidden dealer card' : 'Dealer card'}
                              >
                                {isHidden ? '?' : formatCard(card)}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex justify-center gap-2 mb-2">
                          <div className="w-12 h-16 rounded-lg bg-primary/20 border-2 border-dashed border-primary/30" />
                          <div className="w-12 h-16 rounded-lg bg-primary/20 border-2 border-dashed border-primary/30" />
                        </div>
                      )}
                      {dealerHandValue && showFullDealerHand && (
                        <p className="text-sm font-medium">
                          {dealerHandValue.soft ? 'Soft ' : ''}{dealerHandValue.value}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Player Hands (dealer view) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nonDealerPlayers.map(p => {
                    const playerHand = hands.find(h => h.player_id === p.id && h.hand_index === 0);
                    const rawCards = playerHand?.cards || [];
                    const hasUnknownCard = rawCards.some(c => !c || typeof c !== 'string' || c.length < 2);
                    const visibleCards = rawCards.filter(c => typeof c === 'string' && c.length >= 2);
                    const handValue = visibleCards.length > 0 ? calculateHandValue(visibleCards) : null;
                    const isCurrentPlayer = p.id === player?.id;
                    
                    return (
                      <Card 
                        key={p.id} 
                        className={isCurrentPlayer ? 'border-primary/50 bg-primary/5' : ''}
                      >
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                p.is_online ? 'bg-green-500/20 text-green-500' : 'bg-muted'
                              }`}>
                                {p.seat_position || '?'}
                              </div>
                              <span className="font-medium">{p.name}</span>
                              {isCurrentPlayer && <span className="text-xs text-primary">(You)</span>}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Bet</p>
                              <p className="font-bold">${p.current_bet || 0}</p>
                            </div>
                          </div>
                          
                          {/* Cards */}
                          {rawCards.length > 0 ? (
                            <div className="flex gap-1 mb-2">
                              {rawCards.map((card, idx) => {
                                const isValid = typeof card === 'string' && card.length >= 2;
                                const isRed = isValid && isRedSuit(card);
                                return (
                                  <div
                                    key={idx}
                                    className={`w-10 h-14 rounded flex items-center justify-center text-sm font-bold ${
                                      !isValid ? 'bg-muted/50 border border-dashed text-muted-foreground' :
                                      isRed ? 'bg-white text-red-600' : 'bg-white text-black'
                                    }`}
                                    aria-label={isValid ? 'Player card' : 'Card pending'}
                                  >
                                    {isValid ? formatCard(card) : '?'}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex gap-1 mb-2">
                              <div className="w-10 h-14 rounded bg-muted/50 border border-dashed" />
                              <div className="w-10 h-14 rounded bg-muted/50 border border-dashed" />
                            </div>
                          )}
                          
                          {handValue && !hasUnknownCard && (
                            <p className="text-sm">
                              {handValue.soft ? 'Soft ' : ''}{handValue.value}
                              {handValue.value === 21 && playerHand?.cards?.length === 2 && ' - Blackjack!'}
                            </p>
                          )}
                          
                          {game?.status === 'betting' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {p.has_placed_bet ? '✓ Bet placed' : 'Waiting for bet...'}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Main Game Area (player view) */}
            <div className="flex-1 p-4">
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Dealer Cards (standalone) */}
                <div className="flex flex-col items-center text-center">
                  <p className="text-xs uppercase text-muted-foreground mb-2">Dealer</p>
                  {dealerDisplayCards.length > 0 ? (
                    <div className="flex justify-center gap-3 mb-2">
                      {dealerDisplayCards.map((card: string, idx: number) => {
                        const isHidden = card === '__HIDDEN__';
                        const isRed = !isHidden && isRedSuit(card);
                        return (
                          <div
                            key={idx}
                            className={`w-14 h-20 rounded-lg flex items-center justify-center text-xl font-bold ${
                              isHidden ? 'bg-primary/30 border border-dashed border-primary/60 text-primary' :
                              isRed ? 'bg-white text-red-600' : 'bg-white text-black'
                            }`}
                            aria-label={isHidden ? 'Hidden dealer card' : 'Dealer card'}
                          >
                            {isHidden ? '?' : formatCard(card)}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex justify-center gap-3 mb-2">
                      <div className="w-14 h-20 rounded-lg bg-primary/20 border-2 border-dashed border-primary/30" />
                      <div className="w-14 h-20 rounded-lg bg-primary/20 border-2 border-dashed border-primary/30" />
                    </div>
                  )}
                  {dealerHandValue && showFullDealerHand && (
                    <p className="text-sm font-medium">
                      {dealerHandValue.soft ? 'Soft ' : ''}{dealerHandValue.value}
                    </p>
                  )}
                </div>

                {/* Current Player (centered, large) */}
                <div className="flex flex-col items-center text-center">
                  <div className="text-xs uppercase text-muted-foreground mb-2">Your Hand</div>
                  <div className="flex gap-3 mb-3">
                    {(myHand?.cards && myHand.cards.length > 0 ? myHand.cards : [null, null]).map((card, idx) => {
                      const isValid = typeof card === 'string' && card.length >= 2;
                      const isRed = isValid && isRedSuit(card);
                      return (
                        <div
                          key={idx}
                          className={`w-20 h-28 rounded-lg flex items-center justify-center text-2xl font-bold ${
                            !isValid ? 'bg-muted/50 border border-dashed text-muted-foreground' :
                            isRed ? 'bg-white text-red-600' : 'bg-white text-black'
                          }`}
                          aria-label={isValid ? 'Your card' : 'Card pending'}
                        >
                          {isValid ? formatCard(card) : '?'}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-lg font-semibold">
                    Bet: ${player?.current_bet || 0}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bottom Action Bar */}
        <div className="p-4 border-t bg-card/50 backdrop-blur">
          <div className="max-w-4xl mx-auto">
            {game?.status === 'betting' && !isDealer && !player?.has_placed_bet && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedBet(Math.max(1, selectedBet - 1))}
                    disabled={selectedBet <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <div className="px-6 py-2 bg-muted rounded-lg min-w-[80px] text-center">
                    <span className="text-2xl font-bold">${selectedBet}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedBet(Math.min(player?.balance || 100, selectedBet + 1))}
                    disabled={selectedBet >= (player?.balance || 0)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2 justify-center">
                  {[1, 5, 10, 25].map(amt => (
                    <Button
                      key={amt}
                      variant={selectedBet === amt ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedBet(Math.min(amt, player?.balance || 0))}
                      disabled={amt > (player?.balance || 0)}
                    >
                      ${amt}
                    </Button>
                  ))}
                </div>
                <Button
                  className="w-full"
                  onClick={() => handlePlaceBet(selectedBet)}
                  disabled={selectedBet > (player?.balance || 0) || selectedBet <= 0}
                >
                  Place Bet (${selectedBet})
                </Button>
              </div>
            )}

            {game?.status === 'betting' && !isDealer && player?.has_placed_bet && (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Waiting for players to place bets...</p>
              </div>
            )}

            {game?.status === 'betting' && isDealer && (
              <Button
                className="w-full"
                disabled={!anyBetsPlaced || nonDealerPlayers.length === 0 || loading}
                onClick={handleDealCards}
              >
                {loading ? 'Dealing...' : 'Deal Cards'}
              </Button>
            )}

            {game?.status === 'playing' && !isDealer && (
              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  variant="default"
                  onClick={handleHit}
                  disabled={!hands.find(h => h.player_id === player?.id && h.is_active)}
                >
                  Hit
                </Button>
                <Button 
                  className="flex-1" 
                  variant="outline"
                  onClick={handleStand}
                  disabled={!hands.find(h => h.player_id === player?.id && h.is_active)}
                >
                  Stand
                </Button>
                {game?.settings?.double_down_enabled && (
                  <Button 
                    className="flex-1" 
                    variant="outline"
                    onClick={handleDoubleDown}
                    disabled={
                      !hands.find(h => h.player_id === player?.id && h.is_active && h.cards.length === 2) ||
                      (player?.balance || 0) < (hands.find(h => h.player_id === player?.id)?.bet_amount || 0)
                    }
                  >
                    Double
                  </Button>
                )}
              </div>
            )}

            {game?.status === 'playing' && isDealer && (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Players are taking their turns...</p>
                <p className="text-sm">
                  Current turn: {
                    game.turn_order && game.turn_order.length > 0 && typeof game.current_turn_index === 'number'
                      ? playersList.find(p => p.id === game.turn_order[game.current_turn_index!])?.name || 'Unknown'
                      : 'Setting up...'
                  }
                </p>
              </div>
            )}

            {game?.status === 'dealer_turn' && (
              <div className="text-center py-4">
                <p className="font-medium">Dealer's Turn</p>
                <p className="text-sm text-muted-foreground">Dealer is playing...</p>
              </div>
            )}

            {game?.status === 'resolving' && (
              <div className="text-center py-4">
                <p className="font-medium">Resolving Round</p>
                <p className="text-sm text-muted-foreground">Calculating results...</p>
              </div>
            )}

            {game?.status === 'lobby' && screen === 'game' && (
              <div className="space-y-2">
                <div className="text-center py-2">
                  <p className="font-medium">Round Complete!</p>
                </div>
                {isDealer ? (
                  <Button className="w-full" onClick={handleStartBetting}>
                    <Play className="w-4 h-4 mr-2" />
                    Start New Round
                  </Button>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">Waiting for dealer to start next round...</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chip Request Dialog */}
        <Dialog open={chipRequestDialogOpen} onOpenChange={setChipRequestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Chips</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="number"
                value={chipRequestAmount}
                onChange={(e) => setChipRequestAmount(e.target.value)}
                placeholder="Enter amount"
              />
              <div className="flex gap-2">
                {[50, 100, 200, 500].map(amt => (
                  <Button
                    key={amt}
                    variant={chipRequestAmount === amt.toString() ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setChipRequestAmount(amt.toString())}
                  >
                    ${amt}
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChipRequestDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRequestChips}>Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Toaster />
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  // persistent controls available on every screen (invite, settings, leave)
  const persistentControls = (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      <Button className="px-3 py-2" onClick={() => setQrDialogOpen(true)}>
        Invite
      </Button>
      <Button className="px-3 py-2" onClick={() => setSettingsDialogOpen(true)}>
        Settings
      </Button>
      <Button variant="ghost" className="px-3 py-2 text-destructive" onClick={handleLogout}>
        Leave Table
      </Button>
    </div>
  );

  const settingsDialog = (
    <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Table Settings</DialogTitle>
          <DialogDescription>View table code and rules</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Table Code</div>
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm">{game?.code || '—'}</div>
              <Button size="sm" onClick={copyInviteUrlToClipboard}>Copy Invite</Button>
            </div>
          </div>

          {game?.settings ? (
            <div className="text-sm space-y-1">
              <div>Decks: {game.settings.num_decks}</div>
              <div>Dealer hits on soft 17: {String(game.settings.hit_on_soft_17)}</div>
              <div>Blackjack payout: {game.settings.blackjack_payout}</div>
              <div>Insurance: {String(game.settings.insurance_enabled)}</div>
              <div>Double down: {String(game.settings.double_down_enabled)}</div>
              <div>Split enabled: {String(game.settings.split_enabled)}</div>
              <div>Max splits: {game.settings.max_splits}</div>
              <div>Min bet: {game.settings.min_bet}</div>
              <div>Max bet: {game.settings.max_bet}</div>
            </div>
          ) : (
            <div className="text-sm">No table selected</div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => setSettingsDialogOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  let mainContent: JSX.Element;
  switch (screen) {
    case "join-create":
      mainContent = renderJoinCreate();
      break;
    case "enter-name":
      mainContent = renderEnterName();
      break;
    case "confirm-settings":
      mainContent = renderConfirmSettings();
      break;
    case "lobby":
      mainContent = renderLobby();
      break;
    case "game":
      mainContent = renderGame();
      break;
    default:
      mainContent = renderJoinCreate();
  }

  return (
    <>
      {mainContent}
      {persistentControls}
      {settingsDialog}
    </>
  );
};

export default Blackjack;
