import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  UserPlus, 
  Trophy, 
  Users, 
  Play, 
  CheckCircle, 
  Timer, 
  Award,
  Copy,
  Settings,
  ArrowRight,
  Clock
} from "lucide-react";
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
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../components/ui/dialog";
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
import { toast } from "../components/ui/use-toast";
import { Toaster } from "../components/ui/toaster";
import { BackButton } from "../components/BackButton";
import { PongMatchmaking } from "../components/PongMatchmaking";
import { ManualScoring } from "../components/ManualScoring";

// Initialize Supabase client
const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type Screen = "join-create" | "setup-wizard" | "game-play" | "event-scoring" | "leaderboard";

type EventType = 'shotgun_time' | 'funnel_time' | 'stack_cup' | 'pong' | 'beer_ball' | '40_yard_dash' | 'flip_cup' | 'custom';

interface EventTemplate {
  type: EventType;
  name: string;
  isTimed: boolean;
  isTeamEvent: boolean;
  defaultPointMode: 'ranking' | 'custom' | 'win_loss';
}

interface SelectedEvent extends EventTemplate {
  order: number;
  pointMode: 'ranking' | 'custom' | 'win_loss';
  firstPlacePoints?: number;
  secondPlacePoints?: number;
  thirdPlacePoints?: number;
  fourthPlacePoints?: number;
  fifthPlacePoints?: number;
  winPoints?: number;
  lossPoints?: number;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  { type: 'shotgun_time', name: 'Shotgun Time', isTimed: true, isTeamEvent: false, defaultPointMode: 'ranking' },
  { type: 'funnel_time', name: 'Funnel Time', isTimed: true, isTeamEvent: false, defaultPointMode: 'ranking' },
  { type: 'stack_cup', name: 'Stack Cup', isTimed: false, isTeamEvent: false, defaultPointMode: 'ranking' },
  { type: 'pong', name: 'Beer Pong', isTimed: false, isTeamEvent: true, defaultPointMode: 'win_loss' },
  { type: 'beer_ball', name: 'Beer Ball', isTimed: false, isTeamEvent: true, defaultPointMode: 'win_loss' },
  { type: '40_yard_dash', name: '40 Yard Dash', isTimed: true, isTeamEvent: false, defaultPointMode: 'ranking' },
  { type: 'flip_cup', name: 'Flip Cup', isTimed: false, isTeamEvent: true, defaultPointMode: 'win_loss' },
];

const BeerOlympics = () => {
  const STORAGE_KEY_CODE = "beer_olympics:gameCode";
  const STORAGE_KEY_RECENT = "beer_olympics:recentGames";

  const [screen, setScreen] = useState<Screen>("join-create");
  const [gameCode, setGameCode] = useState("");
  const [mode, setMode] = useState<"join" | "create" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [game, setGame] = useState<any | null>(null);
  const [recentGames, setRecentGames] = useState<string[]>([]);
  const [playersList, setPlayersList] = useState<any[]>([]);
  
  // Setup wizard state
  const [setupStep, setSetupStep] = useState<'players' | 'events' | 'points'>('players');
  const [newPlayerName, setNewPlayerName] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<SelectedEvent[]>([]);
  const [eventBeingConfigured, setEventBeingConfigured] = useState<SelectedEvent | null>(null);
  
  // Game play state
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [configuredEvents, setConfiguredEvents] = useState<any[]>([]);
  const [currentEvent, setCurrentEvent] = useState<any | null>(null);
  const [eventScores, setEventScores] = useState<any[]>([]);
  const [eventAverages, setEventAverages] = useState<Record<string, number | null>>({});
  const [playersForScoring, setPlayersForScoring] = useState<any[]>([]);
  
  // Timer state for timed events
  const [timerModalOpen, setTimerModalOpen] = useState(false);
  const [currentSubjectPlayer, setCurrentSubjectPlayer] = useState<any | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerValue, setTimerValue] = useState(0);
  const [timerSubmissions, setTimerSubmissions] = useState<any[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Pong matchmaking state
  const [pongMatchups, setPongMatchups] = useState<{ team1: string[], team2: string[] }[]>([]);
  const [pongMatchupResults, setPongMatchupResults] = useState<Record<number, string>>({});
  const [showPongMatchmaking, setShowPongMatchmaking] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Load recent games from localStorage
  useEffect(() => {
    (async () => {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_RECENT) : null;
        if (!raw) return;
        const parsed = JSON.parse(raw || "[]");
        if (!Array.isArray(parsed)) return;
        const codes = parsed.filter(Boolean).map((s: any) => String(s));
        if (codes.length === 0) return;

        try {
          const { data: existing = [], error: exErr } = await supabase
            .from('beer_olympics_games')
            .select('code')
            .in('code', codes);
          if (exErr) throw exErr;
          const existingSet = new Set((existing || []).map((g: any) => String(g.code)));
          const filtered = codes.filter((c: string) => existingSet.has(c));
          setRecentGames(filtered);
          persistRecentGames(filtered);
        } catch (e) {
          setRecentGames(codes);
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const persistRecentGames = (list: string[]) => {
    try {
      if (typeof window !== "undefined") 
        localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(list));
    } catch (e) { /* ignore */ }
  };

  const loadScoresOrdering = async (eventId?: number) => {
    const id = eventId || currentEvent?.id;
    if (!id) return;
    try {
      const { data: scores = [], error } = await supabase
        .from('beer_olympics_scores')
        .select('*')
        .eq('event_id', id);
      if (error) throw error;

      const scoreMap: Record<string, any> = {};
      (scores || []).forEach((s: any) => { scoreMap[String(s.player_id)] = s; });

      const ordered = [...playersList];
      const anyRanking = (scores || []).some((s: any) => s.ranking != null);
      if (anyRanking) {
        ordered.sort((a: any, b: any) => {
          const ra = scoreMap[String(a.id)]?.ranking ?? Number.MAX_SAFE_INTEGER;
          const rb = scoreMap[String(b.id)]?.ranking ?? Number.MAX_SAFE_INTEGER;
          return ra - rb;
        });
      } else if ((currentEvent && currentEvent.is_timed) || (scores || []).some((s: any) => s.time_seconds != null)) {
        ordered.sort((a: any, b: any) => {
          const ta = parseFloat(scoreMap[String(a.id)]?.time_seconds ?? 'Infinity');
          const tb = parseFloat(scoreMap[String(b.id)]?.time_seconds ?? 'Infinity');
          return ta - tb;
        });
      }

      setPlayersForScoring(ordered);
    } catch (err) {
      console.error('loadScoresOrdering error:', err);
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

  // Handle URL invite code
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const invite = params.get('invite') || params.get('code');
        if (invite) {
          try {
            localStorage.removeItem(STORAGE_KEY_CODE);
          } catch (e) { /* ignore */ }
          
          const upperCode = invite.toUpperCase();
          setGameCode(upperCode);
          setMode('join');
          setLoading(true);
          
          try {
            const { data: games, error: gErr } = await supabase
              .from('beer_olympics_games')
              .select('*')
              .eq('code', upperCode)
              .limit(1);
            
            if (gErr) throw gErr;
            if (games && games.length > 0) {
              const g = games[0];
              setGame(g);
              pushRecentGame(g.code);
              
              if (g.status === 'setup') {
                setScreen('setup-wizard');
              } else {
                await loadGameState(g);
                setScreen('game-play');
              }
            }
          } catch (err) {
            console.error('Failed to load game from invite:', err);
          } finally {
            setLoading(false);
          }
          
          try {
            navigate(window.location.pathname, { replace: true });
          } catch (e) { /* ignore */ }
        }
      } catch (err) { /* ignore */ }
    })();
  }, []);

  // Generate unique game code
  const generateCode = (len = 6) => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) 
      out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  const createUniqueGameCode = async (attempts = 5) => {
    for (let i = 0; i < attempts; i++) {
      const code = generateCode();
      const { data, error } = await supabase
        .from('beer_olympics_games')
        .select('id')
        .eq('code', code)
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return code;
    }
    throw new Error('Unable to generate unique game code');
  };

  // Fetch players for a game
  const fetchPlayers = async (code: string) => {
    try {
      const { data: games, error: gErr } = await supabase
        .from('beer_olympics_games')
        .select('id')
        .eq('code', code)
        .limit(1);
      
      if (gErr) throw gErr;
      if (!games || games.length === 0) throw new Error('Game not found');
      
      const game = games[0];
      
      const { data: players, error: pErr } = await supabase
        .from('beer_olympics_players')
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

  // Handle recent game click
  const handleRecentClick = async (code: string) => {
    setLoading(true);
    try {
      setGameCode(code);
      setMode('join');
      
      const { data: games, error: gErr } = await supabase
        .from('beer_olympics_games')
        .select('*')
        .eq('code', code)
        .limit(1);
      
      if (gErr) throw gErr;
      if (!games || games.length === 0) {
        setError('Game not found');
        setLoading(false);
        return;
      }
      
      const g = games[0];
      setGame(g);
      pushRecentGame(g.code);
      
      if (g.status === 'setup') {
        setScreen('setup-wizard');
      } else {
        await loadGameState(g);
        setScreen('game-play');
      }
    } catch (e) {
      setError('Failed to join game');
    } finally {
      setLoading(false);
    }
  };



  // Load game state
  const loadGameState = async (g: any) => {
    try {
      // Load configured events
      const { data: events, error: evErr } = await supabase
        .from('beer_olympics_events')
        .select('*')
        .eq('game_id', g.id)
        .order('event_order', { ascending: true });
      
      if (evErr) throw evErr;
      setConfiguredEvents(events || []);
      setCurrentEventIndex(g.current_event_index || 0);
      
      if (events && events.length > 0) {
        const currentEvt = events[g.current_event_index || 0];
        setCurrentEvent(currentEvt);
      }
      
      // Load players
      const { data: players, error: plErr } = await supabase
        .from('beer_olympics_players')
        .select('*')
        .eq('game_id', g.id)
        .order('total_points', { ascending: false });
      
      if (plErr) throw plErr;
      setPlayersList(players || []);
    } catch (err) {
      console.error('Load game state error:', err);
    }
  };

  // Handle create/join submit
  const handleSubmit = async () => {
    if (!gameCode.trim() && mode === 'join') {
      setError("Please enter a game code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        const code = await createUniqueGameCode();
        setGameCode(code);
        
        // Create new game
        const { data: newGame, error: gErr } = await supabase
          .from('beer_olympics_games')
          .insert({
            code: code,
            name: `Beer Olympics - ${code}`,
            status: 'setup',
          })
          .select()
          .single();

        if (gErr) throw gErr;

        setGame(newGame);
        setPlayersList([]);
        
        try {
          localStorage.setItem(STORAGE_KEY_CODE, code);
        } catch (e) { /* ignore */ }
        
        pushRecentGame(code);
        setScreen('setup-wizard');
      } else if (mode === 'join') {
        const upperCode = gameCode.toUpperCase();
        setGameCode(upperCode);
        
        const { data: games, error: gErr } = await supabase
          .from('beer_olympics_games')
          .select('*')
          .eq('code', upperCode)
          .limit(1);
        
        if (gErr) throw gErr;
        if (!games || games.length === 0) {
          setError("Game not found");
          setLoading(false);
          return;
        }

        const g = games[0];
        setGame(g);
        
        try {
          localStorage.setItem(STORAGE_KEY_CODE, upperCode);
        } catch (e) { /* ignore */ }
        
        pushRecentGame(upperCode);
        
        if (g.status === 'setup') {
          setScreen('setup-wizard');
        } else {
          await loadGameState(g);
          setScreen('game-play');
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError((err as any)?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };



  // Setup wizard: Add player
  const addPlayer = async () => {
    if (!newPlayerName.trim()) {
      toast({ title: 'Error', description: 'Please enter a player name' });
      return;
    }

    try {
      const upperName = newPlayerName.toUpperCase();
      
      // Check if name already exists
      const existing = playersList.find(p => p.name.toUpperCase() === upperName);
      if (existing) {
        toast({ title: 'Error', description: 'Player name already exists' });
        return;
      }

      const { data: newPlayer, error } = await supabase
        .from('beer_olympics_players')
        .insert({
          game_id: game.id,
          name: upperName,
        })
        .select()
        .single();

      if (error) throw error;

      setPlayersList([...playersList, newPlayer]);
      setNewPlayerName("");
      toast({ title: 'Success', description: `${upperName} added!` });
    } catch (err) {
      console.error('Add player error:', err);
      toast({ title: 'Error', description: 'Failed to add player' });
    }
  };

  // Setup wizard: Toggle event selection
  const toggleEventSelection = (template: EventTemplate) => {
    const existing = selectedEvents.find(e => e.type === template.type);
    if (existing) {
      setSelectedEvents(selectedEvents.filter(e => e.type !== template.type));
    } else {
      const newEvent: SelectedEvent = {
        ...template,
        order: selectedEvents.length + 1,
        pointMode: template.defaultPointMode,
        firstPlacePoints: 5,
        secondPlacePoints: 3,
        thirdPlacePoints: 2,
        fourthPlacePoints: 1,
        fifthPlacePoints: 1,
        winPoints: 5,
        lossPoints: 2,
      };
      setSelectedEvents([...selectedEvents, newEvent]);
    }
  };

  // Setup wizard: Reorder events
  const moveEventUp = (index: number) => {
    if (index === 0) return;
    const newEvents = [...selectedEvents];
    [newEvents[index - 1], newEvents[index]] = [newEvents[index], newEvents[index - 1]];
    newEvents.forEach((e, i) => e.order = i + 1);
    setSelectedEvents(newEvents);
  };

  const moveEventDown = (index: number) => {
    if (index === selectedEvents.length - 1) return;
    const newEvents = [...selectedEvents];
    [newEvents[index], newEvents[index + 1]] = [newEvents[index + 1], newEvents[index]];
    newEvents.forEach((e, i) => e.order = i + 1);
    setSelectedEvents(newEvents);
  };

  // Setup wizard: Complete setup and start game
  const completeSetup = async () => {
    if (playersList.length < 2) {
      toast({ title: 'Error', description: 'Need at least 2 players' });
      return;
    }

    if (selectedEvents.length === 0) {
      toast({ title: 'Error', description: 'Select at least one event' });
      return;
    }

    setLoading(true);
    try {
      // Create events in database
      const eventsToInsert = selectedEvents.map(e => ({
        game_id: game.id,
        event_type: e.type,
        event_name: e.name,
        event_order: e.order,
        point_mode: e.pointMode,
        first_place_points: e.firstPlacePoints,
        second_place_points: e.secondPlacePoints,
        third_place_points: e.thirdPlacePoints,
        fourth_place_points: e.fourthPlacePoints,
        fifth_place_points: e.fifthPlacePoints,
        win_points: e.winPoints,
        loss_points: e.lossPoints,
        is_team_event: e.isTeamEvent,
        is_timed: e.isTimed,
      }));

      const { data: createdEvents, error: evErr } = await supabase
        .from('beer_olympics_events')
        .insert(eventsToInsert)
        .select();

      if (evErr) throw evErr;

      // Update game status
      await supabase
        .from('beer_olympics_games')
        .update({ status: 'in_progress', current_event_index: 0 })
        .eq('id', game.id);

      setConfiguredEvents(createdEvents || []);
      setCurrentEventIndex(0);
      setCurrentEvent(createdEvents?.[0] || null);
      setGame({ ...game, status: 'in_progress' });
      
      toast({ title: 'Success', description: 'Beer Olympics started!' });
      setScreen('game-play');
    } catch (err) {
      console.error('Complete setup error:', err);
      toast({ title: 'Error', description: 'Failed to start game' });
    } finally {
      setLoading(false);
    }
  };

  // Copy game code to clipboard
  const copyGameCode = () => {
    navigator.clipboard.writeText(gameCode);
    toast({ title: 'Copied!', description: `Game code ${gameCode} copied to clipboard` });
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!game?.id) return;

    const channel = supabase
      .channel(`beer_olympics_game_${game.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beer_olympics_players', filter: `game_id=eq.${game.id}` },
        async (payload) => {
          const { data: players } = await supabase
            .from('beer_olympics_players')
            .select('*')
            .eq('game_id', game.id)
            .order('total_points', { ascending: false });
          setPlayersList(players || []);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'beer_olympics_games', filter: `id=eq.${game.id}` },
        (payload) => {
          setGame(payload.new);
          setCurrentEventIndex(payload.new.current_event_index || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id]);

  // Timer functions
  const startTimer = () => {
    setTimerRunning(true);
    setTimerValue(0);
    timerIntervalRef.current = setInterval(() => {
      setTimerValue(prev => prev + 10);
    }, 10);
  };

  const stopTimer = async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerRunning(false);

    // Submit time (no longer tracking who submitted)
    if (currentEvent && currentSubjectPlayer) {
      const timeInSeconds = timerValue / 1000;
      
      const { error } = await supabase
        .from('beer_olympics_timers')
        .insert({
          event_id: currentEvent.id,
          player_id: currentSubjectPlayer.id, // Use subject player as submitter
          subject_player_id: currentSubjectPlayer.id,
          time_seconds: timeInSeconds,
        });

      if (error) {
        console.error('Submit timer error:', error);
        toast({ title: 'Error', description: 'Failed to submit time' });
      } else {
        toast({ title: 'Time submitted!', description: `${timeInSeconds.toFixed(3)}s recorded` });
        // Reload submissions
        loadTimerSubmissions();
      }
    }
  };

  const loadTimerSubmissions = async () => {
    if (!currentEvent || !currentSubjectPlayer) return;

    const { data, error } = await supabase
      .from('beer_olympics_timers')
      .select('*, player:beer_olympics_players!beer_olympics_timers_player_id_fkey(name)')
      .eq('event_id', currentEvent.id)
      .eq('subject_player_id', currentSubjectPlayer.id);

    if (error) {
      console.error('Load timer submissions error:', error);
    } else {
      setTimerSubmissions(data || []);
    }
  };

  // Load finalized scores (averages) for the current event
  const loadEventFinalScores = async (eventId?: number) => {
    const id = eventId || currentEvent?.id;
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('beer_olympics_scores')
        .select('*')
        .eq('event_id', id);

      if (error) throw error;

      const scores = data || [];
      setEventScores(scores);

      const map: Record<string, number | null> = {};
      scores.forEach((s: any) => {
        map[String(s.player_id)] = s.time_seconds !== null ? parseFloat(s.time_seconds) : null;
      });

      // Ensure players without scores have explicit null entry
      playersList.forEach(p => {
        if (map[String(p.id)] === undefined) map[String(p.id)] = null;
      });

      setEventAverages(map);
      // Update ordering for manual scoring UI based on existing event scores
      try {
        const scoreMap: Record<string, any> = {};
        scores.forEach((s: any) => { scoreMap[String(s.player_id)] = s; });
        const ordered = [...playersList];

        const anyRanking = (scores || []).some((s: any) => s.ranking != null);
        if (anyRanking) {
          ordered.sort((a: any, b: any) => {
            const ra = scoreMap[String(a.id)]?.ranking ?? Number.MAX_SAFE_INTEGER;
            const rb = scoreMap[String(b.id)]?.ranking ?? Number.MAX_SAFE_INTEGER;
            return ra - rb;
          });
        } else if ((currentEvent && currentEvent.is_timed) || (scores || []).some((s: any) => s.time_seconds != null)) {
          ordered.sort((a: any, b: any) => {
            const ta = parseFloat(scoreMap[String(a.id)]?.time_seconds ?? 'Infinity');
            const tb = parseFloat(scoreMap[String(b.id)]?.time_seconds ?? 'Infinity');
            return ta - tb;
          });
        }

        setPlayersForScoring(ordered);
      } catch (e) {
        // ignore ordering errors
      }
    } catch (err) {
      console.error('Load event final scores error:', err);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const calculateAverageTime = () => {
    if (timerSubmissions.length === 0) return null;
    const sum = timerSubmissions.reduce((acc, sub) => acc + parseFloat(sub.time_seconds), 0);
    return sum / timerSubmissions.length;
  };

  const finalizeTimedEvent = async () => {
    if (!currentEvent || !currentSubjectPlayer) return;

    const avgTime = calculateAverageTime();
    if (avgTime === null) {
      toast({ title: 'Error', description: 'No times submitted yet' });
      return;
    }

    // Save score
    const { error } = await supabase
      .from('beer_olympics_scores')
      .insert({
        event_id: currentEvent.id,
        player_id: currentSubjectPlayer.id,
        time_seconds: avgTime,
        points: 0, // Will be calculated after all players complete
      });

    if (error) {
      console.error('Finalize timed event error:', error);
      toast({ title: 'Error', description: 'Failed to save time' });
    } else {
      toast({ 
        title: 'Time saved!', 
        description: `Average: ${avgTime.toFixed(3)}s` 
      });
      setTimerModalOpen(false);
      setCurrentSubjectPlayer(null);
      setTimerSubmissions([]);
      setTimerValue(0);
      // Reload finalized scores and recalc leaderboard points for this event
      await loadEventFinalScores(currentEvent.id);
      await computeAndAssignRankingPointsForEvent(currentEvent.id);
    }
  };

  // Compute dynamic ranking points for an event and update scores & player totals
  const computeAndAssignRankingPointsForEvent = async (eventId: number) => {
    if (!game?.id) return;

    try {
      // Fetch existing scores for the event
      const { data: existingScores = [], error: sErr } = await supabase
        .from('beer_olympics_scores')
        .select('*')
        .eq('event_id', eventId);

      if (sErr) throw sErr;

      const existingArr = existingScores || [];
      const existingMap: Record<string, any> = {};
      existingArr.forEach((es: any) => existingMap[String(es.player_id)] = es);

      // Consider only players who have a final time recorded for ranking.
      const timedScores = existingArr.filter((s: any) => s.time_seconds != null);

      // Map timed scores to player objects
      const playersWithTimes: { player: any; time: number; existing?: any }[] = timedScores
        .map((s: any) => {
          const player = playersList.find(p => String(p.id) === String(s.player_id));
          if (!player) return null;
          return { player, time: parseFloat(s.time_seconds), existing: s };
        })
        .filter(Boolean) as any[];

      playersWithTimes.sort((a, b) => a.time - b.time);

      const totalPlayers = playersList.length;
      const deltas: Record<string, number> = {};

      // Assign points to timed players based on total player count N and their rank among timed players
      for (let i = 0; i < playersWithTimes.length; i++) {
        const entry = playersWithTimes[i];
        const pid = entry.player.id;
        const rankPoints = Math.max(0, totalPlayers - i);
        const existing = existingMap[String(pid)];
        const previousPoints = existing?.points || 0;

        if (existing) {
          await supabase
            .from('beer_olympics_scores')
            .update({ points: rankPoints, time_seconds: entry.time })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('beer_olympics_scores')
            .insert({ event_id: eventId, player_id: pid, time_seconds: entry.time, points: rankPoints });
        }

        deltas[String(pid)] = rankPoints - previousPoints;
      }

      // Any existing score rows without a time (previously created for all players) should have their points cleared
      const existingWithoutTime = existingArr.filter((s: any) => s.time_seconds == null);
      for (const s of existingWithoutTime) {
        const pid = s.player_id;
        const prev = s.points || 0;
        if (prev !== 0) {
          await supabase
            .from('beer_olympics_scores')
            .update({ points: 0 })
            .eq('id', s.id);
          deltas[String(pid)] = (deltas[String(pid)] || 0) - prev;
        }
      }

      // Apply deltas to players total_points
      for (const p of playersList) {
        const delta = deltas[String(p.id)] || 0;
        if (delta !== 0) {
          await supabase
            .from('beer_olympics_players')
            .update({ total_points: p.total_points + delta })
            .eq('id', p.id);
        }
      }

      // Reload players list sorted by total_points
      const { data: updatedPlayers } = await supabase
        .from('beer_olympics_players')
        .select('*')
        .eq('game_id', game.id)
        .order('total_points', { ascending: false });

      setPlayersList(updatedPlayers || []);
      // Refresh event scores map
      await loadEventFinalScores(eventId);
    } catch (err) {
      console.error('Compute ranking points error:', err);
    }
  };

  // Render functions for different screens
  // When current event changes, refresh finalized scores (averages)
  useEffect(() => {
    if (currentEvent) {
      loadEventFinalScores(currentEvent.id);
    }
  }, [currentEvent, playersList]);

  // Poll every 2 seconds while on game-play to refresh scores and recompute leaderboard
  useEffect(() => {
    if (screen !== 'game-play' || !currentEvent) return;
    let mounted = true;
    const id = setInterval(async () => {
      if (!mounted) return;
      try {
        await loadEventFinalScores(currentEvent.id);
        await computeAndAssignRankingPointsForEvent(currentEvent.id);
      } catch (e) {
        // ignore polling errors
      }
    }, 2000);

    // initial ordering load
    loadScoresOrdering(currentEvent.id);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [screen, currentEvent, playersList, game]);
  
  // Subscribe to score changes for current event so drag updates propagate in real-time
  useEffect(() => {
    if (!game?.id || !currentEvent?.id) return;

    const channel = supabase
      .channel(`beer_olympics_scores_event_${currentEvent.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'beer_olympics_scores', filter: `event_id=eq.${currentEvent.id}` },
        (payload) => {
          // reload ordering and event scores
          loadScoresOrdering(currentEvent.id);
          loadEventFinalScores(currentEvent.id);
        }
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [game?.id, currentEvent?.id, playersList]);
  const renderJoinCreate = () => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-900 via-orange-800 to-yellow-700 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center flex items-center justify-center gap-2">
            <Trophy className="w-8 h-8" />
            Beer Olympics
          </CardTitle>
          <CardDescription className="text-center">
            Create a game or join with a code to manage competitors and events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentGames.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Recent Games</Label>
              <div className="space-y-2">
                {recentGames.map((code) => (
                  <Button
                    key={code}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleRecentClick(code)}
                    disabled={loading}
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    {code}
                  </Button>
                ))}
              </div>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Choose an option</Label>
            <RadioGroup value={mode || ''} onValueChange={(v) => setMode(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="create" id="create" />
                <Label htmlFor="create" className="cursor-pointer">Create New Game</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="join" id="join" />
                <Label htmlFor="join" className="cursor-pointer">Join Existing Game</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'join' && (
            <div className="space-y-2">
              <Label htmlFor="gameCode">Game Code</Label>
              <Input
                id="gameCode"
                placeholder="Enter game code"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="uppercase"
                maxLength={6}
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!mode || loading || (mode === 'join' && !gameCode.trim())}
          >
            {loading ? 'Loading...' : mode === 'create' ? 'Create Game' : 'Join Game'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  const renderSetupWizard = () => {
    if (setupStep === 'players') {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-900 via-orange-800 to-yellow-700 p-4">
          <Card className="w-full max-w-2xl shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Setup: Add Competitors</CardTitle>
                  <CardDescription>Add names for all participants (min. 2 competitors)</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={copyGameCode}>
                    <Copy className="w-4 h-4 mr-1" />
                    {gameCode}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Competitor name"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                  className="uppercase"
                />
                <Button onClick={addPlayer}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Competitors ({playersList.length})</Label>
                <div className="grid gap-2">
                  {playersList.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => setSetupStep('events')}
                disabled={playersList.length < 2}
              >
                Next: Select Events
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    if (setupStep === 'events') {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-amber-900 via-orange-800 to-yellow-700 p-4">
          <Card className="w-full max-w-2xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Setup: Select Events</CardTitle>
              <CardDescription>
                Choose events and arrange them in order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Available Events</Label>
                <div className="grid gap-2">
                  {EVENT_TEMPLATES.map((template) => {
                    const isSelected = selectedEvents.some(e => e.type === template.type);
                    return (
                      <div
                        key={template.type}
                        className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-100 border-amber-400' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleEventSelection(template)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} />
                          <div>
                            <div className="font-medium">{template.name}</div>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-sm bg-amber-200 px-2 py-1 rounded">
                            #{selectedEvents.find(e => e.type === template.type)?.order}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setSetupStep('players')}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={completeSetup}
                disabled={selectedEvents.length === 0 || loading}
              >
                {loading ? 'Starting...' : 'Start Beer Olympics!'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return null;
  };

  const renderGamePlay = () => (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-orange-800 to-yellow-700 p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <BackButton />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyGameCode}>
              <Copy className="w-4 h-4 mr-1" />
              {gameCode}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              Beer Olympics - {gameCode}
            </CardTitle>
            <CardDescription>
              Event {currentEventIndex + 1} of {configuredEvents.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentEvent && (
              <div className="space-y-4">
                <div className="text-center p-6 bg-amber-100 rounded-lg">
                  <h3 className="text-3xl font-bold text-amber-900">
                    {currentEvent.event_name}
                  </h3>
                </div>

                {currentEvent.is_timed && (
                  <div className="space-y-2">
                    <Label>Select player to time:</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {playersList.map((p) => (
                        <Button
                          key={p.id}
                          variant="outline"
                          onClick={() => {
                            setCurrentSubjectPlayer(p);
                            setTimerModalOpen(true);
                            loadTimerSubmissions();
                          }}
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          <div className="flex items-center gap-2">
                            <span>{p.name}</span>
                            {eventAverages[String(p.id)] != null && (
                              <span className="text-xs font-mono text-amber-700">{(eventAverages[String(p.id)] as number).toFixed(3)}s</span>
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {currentEvent.is_team_event && currentEvent.event_type === 'beer_ball' && (
                  <div className="space-y-2">
                    <Label>Team Event - Beer Ball</Label>
                    <Button
                      className="w-full"
                      onClick={() => {
                        // Navigate to Beer Ball with player names
                        const playerNames = playersList.map(p => p.name).join(',');
                        navigate(`/drunk/beer-ball?olympics=${game.code}&event=${currentEvent.id}&players=${encodeURIComponent(playerNames)}`);
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      Launch Beer Ball Tournament
                    </Button>
                    <p className="text-sm text-gray-600">
                      Opens Beer Ball for skill-based matchmaking. Results will be sent back here.
                    </p>
                  </div>
                )}

                {currentEvent.is_team_event && currentEvent.event_type === 'pong' && (
                  <div className="space-y-4">
                    <Label>Team Event - Beer Pong</Label>
                    
                    {!showPongMatchmaking && pongMatchups.length === 0 && (
                      <Button
                        className="w-full"
                        onClick={() => setShowPongMatchmaking(true)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Create Skill-Based Matchups
                      </Button>
                    )}
                    
                    {showPongMatchmaking && (
                      <div>
                        <PongMatchmaking
                          players={playersList}
                          onTeamsCreated={(teams) => {
                            setPongMatchups(teams);
                            setShowPongMatchmaking(false);
                            toast({ 
                              title: 'Matchups Created!', 
                              description: `${teams.length} games ready to play` 
                            });
                          }}
                        />
                      </div>
                    )}
                    
                    {pongMatchups.length > 0 && (
                      <div className="space-y-3">
                        <div className="font-medium">Matchups:</div>
                        {pongMatchups.map((matchup, index) => (
                          <div key={index} className="p-3 border rounded space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="font-medium">{matchup.team1.join(' & ')}</div>
                              </div>
                              <div className="text-xs text-gray-500 mx-2">vs</div>
                              <div className="flex-1 text-right">
                                <div className="font-medium">{matchup.team2.join(' & ')}</div>
                              </div>
                            </div>
                            {!pongMatchupResults[index] ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    setPongMatchupResults({
                                      ...pongMatchupResults,
                                      [index]: 'team1'
                                    });
                                  }}
                                >
                                  Team 1 Won
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => {
                                    setPongMatchupResults({
                                      ...pongMatchupResults,
                                      [index]: 'team2'
                                    });
                                  }}
                                >
                                  Team 2 Won
                                </Button>
                              </div>
                            ) : (
                              <div className="text-center p-2 bg-green-100 rounded font-medium">
                                Winner: {pongMatchupResults[index] === 'team1' 
                                  ? matchup.team1.join(' & ') 
                                  : matchup.team2.join(' & ')}
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {Object.keys(pongMatchupResults).length === pongMatchups.length && (
                          <Button
                            className="w-full"
                            onClick={async () => {
                              // Calculate points for winners
                              const winCounts: Record<string, number> = {};
                              
                              pongMatchups.forEach((matchup, index) => {
                                const winner = pongMatchupResults[index];
                                const winningTeam = winner === 'team1' ? matchup.team1 : matchup.team2;
                                const losingTeam = winner === 'team1' ? matchup.team2 : matchup.team1;
                                
                                winningTeam.forEach(name => {
                                  winCounts[name] = (winCounts[name] || 0) + 1;
                                });
                              });
                              
                              // Award points based on wins
                              const winPoints = currentEvent.win_points || 5;
                              const lossPoints = currentEvent.loss_points || 2;
                              
                              for (const p of playersList) {
                                const wins = winCounts[p.name] || 0;
                                const points = wins > 0 ? winPoints : lossPoints;
                                
                                await supabase
                                  .from('beer_olympics_scores')
                                  .insert({
                                    event_id: currentEvent.id,
                                    player_id: p.id,
                                    points: points,
                                    notes: `${wins} win(s) in Beer Pong`,
                                  });
                                
                                await supabase
                                  .from('beer_olympics_players')
                                  .update({ total_points: p.total_points + points })
                                  .eq('id', p.id);
                              }
                              
                              toast({ 
                                title: 'Pong Results Saved!', 
                                description: 'Points awarded to all players' 
                              });
                              
                              // Reset for next time
                              setPongMatchups([]);
                              setPongMatchupResults({});
                              
                              // Reload player data
                              const { data: updatedPlayers } = await supabase
                                .from('beer_olympics_players')
                                .select('*')
                                .eq('game_id', game.id)
                                .order('total_points', { ascending: false });
                              
                              setPlayersList(updatedPlayers || []);
                            }}
                          >
                            Save Pong Results
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!currentEvent.is_timed && !currentEvent.is_team_event && (
                  <div className="space-y-2">
                      <ManualScoring
                        players={playersForScoring.length > 0 ? playersForScoring : playersList}
                          event={currentEvent}
                          onScoresSaved={async (scores) => {
                            try {
                              if (!currentEvent) return;
                              const eventId = currentEvent.id;

                              // Fetch existing score rows for this event
                              const { data: existingRows, error: exErr } = await supabase
                                .from('beer_olympics_scores')
                                .select('*')
                                .eq('event_id', eventId);
                              if (exErr) throw exErr;

                              const rows = existingRows || [];
                              const existingMap: Record<string, any> = {};
                              rows.forEach((r: any) => existingMap[String(r.player_id)] = r);

                              // Map new scores by player id
                              const newMap: Record<string, { points: number; ranking: number }> = {};
                              scores.forEach((s) => {
                                newMap[String(s.playerId)] = { points: s.points, ranking: s.ranking };
                              });

                              const deltas: Record<string, number> = {};

                              // Upsert score rows and compute deltas relative to previous points
                              for (const p of playersList) {
                                const pid = String(p.id);
                                const newEntry = newMap[pid] || { points: 0, ranking: null };
                                const existing = existingMap[pid];
                                const prevPoints = existing?.points || 0;

                                if (existing) {
                                  await supabase
                                    .from('beer_olympics_scores')
                                    .update({ points: newEntry.points, ranking: newEntry.ranking })
                                    .eq('id', existing.id);
                                } else {
                                  await supabase
                                    .from('beer_olympics_scores')
                                    .insert({ event_id: eventId, player_id: pid, points: newEntry.points, ranking: newEntry.ranking });
                                }

                                deltas[pid] = (newEntry.points || 0) - (prevPoints || 0);
                              }

                              // Apply deltas to player total_points
                              for (const p of playersList) {
                                const pid = String(p.id);
                                const delta = deltas[pid] || 0;
                                if (delta !== 0) {
                                  await supabase
                                    .from('beer_olympics_players')
                                    .update({ total_points: p.total_points + delta })
                                    .eq('id', p.id);
                                }
                              }

                              toast({ title: 'Scores Saved!', description: 'Points awarded and leaderboard updated' });

                              // Reload player data
                              const { data: updatedPlayers } = await supabase
                                .from('beer_olympics_players')
                                .select('*')
                                .eq('game_id', game.id)
                                .order('total_points', { ascending: false });

                              setPlayersList(updatedPlayers || []);
                            } catch (err) {
                              console.error('Save scores error:', err);
                              toast({ title: 'Error', description: 'Failed to save scores' });
                            }
                          }}
                        />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={currentEventIndex === 0}
                    onClick={async () => {
                      const newIndex = currentEventIndex - 1;
                      await supabase
                        .from('beer_olympics_games')
                        .update({ current_event_index: newIndex })
                        .eq('id', game.id);
                      setCurrentEventIndex(newIndex);
                      setCurrentEvent(configuredEvents[newIndex]);
                    }}
                  >
                    Previous Event
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={async () => {
                      if (currentEventIndex < configuredEvents.length - 1) {
                        const newIndex = currentEventIndex + 1;
                        await supabase
                          .from('beer_olympics_games')
                          .update({ current_event_index: newIndex })
                          .eq('id', game.id);
                        setCurrentEventIndex(newIndex);
                        setCurrentEvent(configuredEvents[newIndex]);
                      } else {
                        // Finish game
                        await supabase
                          .from('beer_olympics_games')
                          .update({ status: 'finished' })
                          .eq('id', game.id);
                        setGame({ ...game, status: 'finished' });
                      }
                    }}
                  >
                    {currentEventIndex < configuredEvents.length - 1 
                      ? 'Next Event' 
                      : 'Finish Game'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {playersList.map((p, index) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded ${
                    index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' :
                    index === 1 ? 'bg-gray-100 border border-gray-300' :
                    index === 2 ? 'bg-orange-100 border border-orange-300' :
                    'border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-500">
                      #{index + 1}
                    </span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="text-xl font-bold text-amber-600">
                    {p.total_points} pts
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timer Modal */}
      <Dialog open={timerModalOpen} onOpenChange={setTimerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Timer: {currentSubjectPlayer?.name}
            </DialogTitle>
            <DialogDescription>
              Multiple people can time simultaneously. The average will be used.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-6xl font-mono font-bold text-amber-600">
                {formatTime(timerValue)}
              </div>
            </div>

            <div className="flex gap-2">
              {!timerRunning ? (
                <Button className="flex-1" onClick={startTimer}>
                  <Play className="w-4 h-4 mr-2" />
                  Start
                </Button>
              ) : (
                <Button className="flex-1" variant="destructive" onClick={stopTimer}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Stop & Submit
                </Button>
              )}
            </div>

            {timerSubmissions.length > 0 && (
              <div className="space-y-2">
                <Label>Submitted Times ({timerSubmissions.length})</Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {timerSubmissions.map((sub, idx) => (
                    <div key={sub.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                      <span>Time #{idx + 1}</span>
                      <span className="font-mono">{parseFloat(sub.time_seconds).toFixed(3)}s</span>
                    </div>
                  ))}
                </div>
                {calculateAverageTime() && (
                  <div className="p-3 bg-amber-100 rounded font-bold text-center">
                    Average: {calculateAverageTime()?.toFixed(3)}s
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimerModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={finalizeTimedEvent} disabled={timerSubmissions.length === 0}>
              Save Final Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Configuration Modal */}
      <Dialog open={!!eventBeingConfigured} onOpenChange={(open) => !open && setEventBeingConfigured(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure: {eventBeingConfigured?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Point Mode</Label>
              <RadioGroup
                value={eventBeingConfigured?.pointMode || 'ranking'}
                onValueChange={(v) => {
                  if (eventBeingConfigured) {
                    setEventBeingConfigured({ ...eventBeingConfigured, pointMode: v as any });
                  }
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ranking" id="ranking" />
                  <Label htmlFor="ranking">Ranking (1st, 2nd, 3rd...)</Label>
                </div>
                {eventBeingConfigured?.isTeamEvent && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="win_loss" id="win_loss" />
                    <Label htmlFor="win_loss">Win/Loss</Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {eventBeingConfigured?.pointMode === 'ranking' && (
              <div className="space-y-2">
                <Label>Points per Place</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">1st Place</Label>
                    <Input
                      type="number"
                      value={eventBeingConfigured?.firstPlacePoints || 0}
                      onChange={(e) => {
                        if (eventBeingConfigured) {
                          setEventBeingConfigured({ 
                            ...eventBeingConfigured, 
                            firstPlacePoints: parseInt(e.target.value) || 0 
                          });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">2nd Place</Label>
                    <Input
                      type="number"
                      value={eventBeingConfigured?.secondPlacePoints || 0}
                      onChange={(e) => {
                        if (eventBeingConfigured) {
                          setEventBeingConfigured({ 
                            ...eventBeingConfigured, 
                            secondPlacePoints: parseInt(e.target.value) || 0 
                          });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">3rd Place</Label>
                    <Input
                      type="number"
                      value={eventBeingConfigured?.thirdPlacePoints || 0}
                      onChange={(e) => {
                        if (eventBeingConfigured) {
                          setEventBeingConfigured({ 
                            ...eventBeingConfigured, 
                            thirdPlacePoints: parseInt(e.target.value) || 0 
                          });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">4th Place</Label>
                    <Input
                      type="number"
                      value={eventBeingConfigured?.fourthPlacePoints || 0}
                      onChange={(e) => {
                        if (eventBeingConfigured) {
                          setEventBeingConfigured({ 
                            ...eventBeingConfigured, 
                            fourthPlacePoints: parseInt(e.target.value) || 0 
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {eventBeingConfigured?.pointMode === 'win_loss' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Win Points</Label>
                  <Input
                    type="number"
                    value={eventBeingConfigured?.winPoints || 0}
                    onChange={(e) => {
                      if (eventBeingConfigured) {
                        setEventBeingConfigured({ 
                          ...eventBeingConfigured, 
                          winPoints: parseInt(e.target.value) || 0 
                        });
                      }
                    }}
                  />
                </div>
                <div>
                  <Label>Loss Points</Label>
                  <Input
                    type="number"
                    value={eventBeingConfigured?.lossPoints || 0}
                    onChange={(e) => {
                      if (eventBeingConfigured) {
                        setEventBeingConfigured({ 
                          ...eventBeingConfigured, 
                          lossPoints: parseInt(e.target.value) || 0 
                        });
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (eventBeingConfigured) {
                  const updated = selectedEvents.map(e => 
                    e.type === eventBeingConfigured.type ? eventBeingConfigured : e
                  );
                  setSelectedEvents(updated);
                  setEventBeingConfigured(null);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Main render
  if (screen === 'join-create') return renderJoinCreate();
  if (screen === 'setup-wizard') return renderSetupWizard();
  if (screen === 'game-play') return renderGamePlay();

  return null;
};

export default BeerOlympics;
