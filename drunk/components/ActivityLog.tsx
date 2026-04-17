import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kcyrvubzhsphpxfsewii.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjeXJ2dWJ6aHNwaHB4ZnNld2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODAwMTcsImV4cCI6MjA3ODc1NjAxN30.8psClrpif-F1DWj67u2tErnU8-4ZYjw5LvEfRK3oHkI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type EventRow = {
  id: string;
  game_id: string;
  created_at: string;
  kind: string;
  type: string;
  actor_player_id?: string | null;
  from_player_id?: string | null;
  to_player_id?: string | null;
  amount?: number | null;
  sip_count?: number | null;
  description?: string | null;
};

export default function ActivityLog({
  gameCode,
  players,
  currentPlayer,
  pollInterval = 2000,
}: {
  gameCode: string | undefined | null;
  players: any[];
  currentPlayer?: any;
  pollInterval?: number;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showAdminEvents, setShowAdminEvents] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | 'all'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isCommissioner = !!currentPlayer?.is_commissioner;

  useEffect(() => {
    if (!gameCode) return;

    let mounted = true;
    let gameId: string | null = null;

    const fetchEvents = async () => {
      try {
        // First get the game ID from the code
        const { data: games, error: gErr } = await supabase
          .from('games')
          .select('id')
          .eq('code', gameCode)
          .limit(1);
        
        if (gErr || !games || games.length === 0) return;
        
        gameId = games[0].id;
        
        // Get events from the game_events view
        const { data: eventsData, error: eErr } = await supabase
          .from('game_events')
          .select('*')
          .eq('game_id', gameId)
          .order('created_at', { ascending: false })
          .limit(110);
        
        if (!mounted) return;
        
        if (!eErr && eventsData) {
          setEvents(eventsData);
        }
      } catch (e) {
        console.warn("Failed to fetch events", e);
      }
    };

    fetchEvents();

    // Set up real-time subscription for new events
    const subscription = supabase
      .channel('game_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_events',
        },
        (payload) => {
          if (!mounted) return;
          
          // Refresh events when there are changes
          fetchEvents();
        }
      )
      .subscribe();

    // Also set up polling as a fallback
    const timer = window.setInterval(fetchEvents, pollInterval);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [gameCode, pollInterval]);

  // If the selected player disappears (players list changes), reset to 'all'
  useEffect(() => {
    if (selectedPlayerId !== 'all' && !(players || []).find((p: any) => p.id === selectedPlayerId)) {
      setSelectedPlayerId('all');
    }
  }, [players, selectedPlayerId]);

  const idToName = (id?: string | null) => {
    if (!id) return "Bank";
    const found = (players || []).find((p: any) => p.id === id);
    return found ? found.name : id;
  };

  const formatEvent = (e: EventRow) => {
    const actor = idToName(e.actor_player_id);
    const from = idToName(e.from_player_id);
    const to = idToName(e.to_player_id);
    if (e.kind === "money") {
      // Special-case kick events early so we don't accidentally return the raw description below
      const descLower = (e.description || '').toLowerCase();
      if (e.type === 'kick' || descLower.startsWith('kicked:')) {
        let removedName: string | null = null;
        try {
          const parts = (e.description || '').split(':');
          if (parts.length >= 2 && parts[0].toLowerCase() === 'kicked') removedName = parts[1] || null;
        } catch {}
        const target = removedName || to || from || 'a player';
        if (actor && actor !== 'Bank') return `${actor} removed ${target} from the game`;
        return `${target} was removed from the game`;
      }
      // Join/leave events: show description if present
      if ((e.type === "join" || e.type === "leave") && e.description) {
        return e.description;
      }
      // Zero-amount events with description: show the description plainly
      if ((e.amount || 0) === 0 && e.description) {
        // Special-case trade timer descriptions
        if (String(e.type).startsWith('trade_timer') || e.description.toLowerCase().includes('trade timer')) {
          return e.description;
        }
        // Pending sips
        if (e.description.toLowerCase().includes('pending sips')) {
          return `Payment blocked: recipient has pending sips.`;
        }
        // Otherwise, just show the description (it's already human-readable)
        return e.description;
      }

      // Specific money event types
      // Kicked players: description may be stored as `kicked:Name:playerId`
      if (e.type === 'kick' || (e.description || '').toLowerCase().startsWith('kicked:')) {
        // Prefer parsing description for the removed name, fallback to to/from ids
        let removedName: string | null = null;
        try {
          const desc = (e.description || '').trim();
          const parts = desc.split(':');
          if (parts.length >= 2 && parts[0].toLowerCase() === 'kicked') {
            removedName = parts[1] || null;
          }
        } catch {}
        const target = removedName || to || from || 'a player';
        if (actor && actor !== 'Bank') return `${actor} removed ${target} from the game`;
        return `${target} was removed from the game`;
      }

      if (e.type === "free_parking_collect")
        return `${to} collected $${(e.amount || 0).toLocaleString()} from Free Parking`;

      if (e.type === 'jail_card_used' || (e.description || '').toLowerCase().includes('get out of jail'))
        return `${actor} used a Get Out of Jail Free card`;

      if (e.type === 'jail') {
        if (e.to_player_id) return `${actor} sent ${to} to jail`;
        return e.description || `${actor} sent someone to jail`;
      }

      if (e.type === 'jail_payment') {
        return `${actor} paid $${(e.amount || 0).toLocaleString()} to get out of jail`;
      }

      // Generic money transfers
      if (!e.from_player_id && e.to_player_id)
        return `${to} received $${(e.amount || 0).toLocaleString()}`;
      if (e.from_player_id && e.to_player_id)
        return `${from} paid ${to} $${(e.amount || 0).toLocaleString()}`;
      if (e.from_player_id && !e.to_player_id)
        return `${from} paid $${(e.amount || 0).toLocaleString()}`;

      // Fallback: concise default
      return `${actor} ${e.type} $${(e.amount || 0).toLocaleString()}`;
    }
    if (e.kind === "sip") {
      const fromName = idToName(e.actor_player_id);
      const toName = idToName(e.to_player_id);
      return `${fromName} assigned ${e.sip_count || 0} sip${(e.sip_count || 0) > 1 ? "s" : ""} to ${toName} (${e.type})`;
    }
    return e.description || `${e.kind} ${e.type}`;
  };

  // Deduplicate: when we log a sip assignment we now insert a `money` event
  // of type `sip_assigned`. The `game_events` view may also include the
  // original `sip` row which gets updated later; to avoid showing the same
  // assignment twice, filter out `sip` kind rows that have a closely-timed
  // `sip_assigned` money event with the same actor and recipient.
  const bucket = (ts?: string | null) => {
    if (!ts) return null;
    const t = new Date(ts).getTime();
    // 5 second buckets
    return Math.floor(t / 5000);
  };

  const sipAssignedBuckets = new Set<string>();
  for (const ev of events) {
    if (ev.kind === 'money' && String(ev.type) === 'sip_assigned') {
      const b = bucket(ev.created_at);
      if (b !== null) sipAssignedBuckets.add(`${ev.actor_player_id}::${ev.to_player_id}::${b}`);
      else sipAssignedBuckets.add(`${ev.actor_player_id}::${ev.to_player_id}::no-ts`);
    }
  }

  const filteredEvents = events.filter((ev) => {
    if (ev.kind === 'sip') {
      const b = bucket(ev.created_at);
      const key = b !== null ? `${ev.actor_player_id}::${ev.to_player_id}::${b}` : `${ev.actor_player_id}::${ev.to_player_id}::no-ts`;
      if (sipAssignedBuckets.has(key)) return false;
    }
    return true;
  });

  const adminFilteredEvents = filteredEvents.filter((ev) => {
    const t = String(ev.type || '');
    // `game_events.kind` is a view field and may not always be exactly "money".
    // We key off the event type prefix instead.
    const isAdmin = (t.startsWith('admin_') || t.startsWith('admin'));
    if (!isCommissioner) return !isAdmin;
    if (!showAdminEvents) return !isAdmin;
    return true;
  });

  // Optionally filter to a single player's actions
  const playerFilteredEvents = selectedPlayerId && selectedPlayerId !== 'all'
    ? adminFilteredEvents.filter((ev) =>
        ev.actor_player_id === selectedPlayerId || ev.from_player_id === selectedPlayerId || ev.to_player_id === selectedPlayerId
      )
    : adminFilteredEvents;

  const query = searchQuery.trim().toLowerCase();

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const searchFilteredEvents = query
    ? playerFilteredEvents.filter((ev) =>
        formatEvent(ev).toLowerCase().includes(query) ||
        formatTime(ev.created_at).toLowerCase().includes(query)
      )
    : playerFilteredEvents;

  const visibleFilteredEvents = expanded ? searchFilteredEvents : searchFilteredEvents.slice(0, 5);

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded-sm px-0.5" style={{ background: 'hsl(var(--primary) / 0.25)', color: 'inherit' }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <>
      <style>{`
        @keyframes nhp-live-pulse { 0% { transform: scale(1); opacity: 0.85; } 70% { transform: scale(2); opacity: 0; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes nhp-live-scale { 0% { transform: scale(0.8); box-shadow: 0 0 6px rgba(16,185,129,0.4); } 50% { transform: scale(1.2); box-shadow: 0 0 12px rgba(16,185,129,0.95); } 100% { transform: scale(0.8); box-shadow: 0 0 6px rgba(16,185,129,0.4); } }
        @keyframes activity-search-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ height: 40 }} aria-hidden="true" />
      <footer className="activity-log w-full bg-white/95 border-t border-border" style={{ boxShadow: '0 -2px 8px 0 rgba(0,0,0,0.03)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-semibold text-xs sm:text-sm">Activity</div>
            <div className="ml-auto flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((v) => {
                    if (!v) setTimeout(() => searchInputRef.current?.focus(), 50);
                    else setSearchQuery('');
                    return !v;
                  });
                }}
                className="p-1 rounded hover:opacity-70 transition-opacity"
                style={{ color: searchOpen ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
                aria-label="Search activity"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <label className="sr-only">Filter by player</label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value as string | 'all')}
                className="appearance-none text-[10px] sm:text-xs text-muted-foreground bg-transparent border border-border/20 hover:border-border rounded px-2 py-0.5 focus:outline-none focus:ring-0 transition-colors"
                style={{ minWidth: 110 }}
                title="Show actions for a specific player"
                aria-label="Filter activity by player"
              >
                <option value="all">All players</option>
                {(players || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span
                style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 8,
                  height: 30,
                  verticalAlign: 'middle',
                  overflow: 'visible',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
                aria-hidden="true"
              >
                <span
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: 9999,
                    backgroundColor: '#10B981',
                    boxShadow: '0 0 6px rgba(16,185,129,0.6)',
                    animation: 'nhp-live-scale 1200ms ease-in-out infinite',
                    transformOrigin: 'center',
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                />
              </span>
              <span>Live</span>
            </div>
          </div>
          {searchOpen && (
            <div
              className="mb-3 mt-1"
              style={{ animation: 'activity-search-in 0.18s ease-out both' }}
            >
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  background: 'hsl(var(--muted) / 0.5)',
                  border: '1px solid hsl(var(--border) / 0.4)',
                }}
              >
                <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setExpanded(true); }}
                  placeholder="Search activity…"
                  className="flex-1 bg-transparent text-xs sm:text-xs focus:outline-none placeholder:text-muted-foreground min-w-0"
                  style={{ color: 'hsl(var(--foreground))', fontSize: '16px' }}
                />
                {query && (
                  <span
                    className="text-[10px] whitespace-nowrap flex-shrink-0 tabular-nums"
                    style={{ color: 'hsl(var(--muted-foreground))' }}
                  >
                    {searchFilteredEvents.length} result{searchFilteredEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="flex-shrink-0 rounded-full p-0.5 transition-opacity hover:opacity-60"
                    style={{ color: 'hsl(var(--muted-foreground))' }}
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
          <div>
            <ul className="space-y-1 text-[10px] sm:text-xs">
              {searchFilteredEvents.length === 0 && (
                <li className="text-[10px] text-muted-foreground">
                  {query ? 'No matching activity' : 'No activity yet'}
                </li>
              )}
              {visibleFilteredEvents.map((ev) => (
                <li key={ev.id} className="text-foreground/90 flex items-start gap-2">
                  <span className="text-muted-foreground min-w-[44px] text-[9px] sm:text-[10px]">
                    {highlight(formatTime(ev.created_at))}
                  </span>
                  <span className="whitespace-normal break-words">{highlight(formatEvent(ev))}</span>
                </li>
              ))}
            </ul>

            {searchFilteredEvents.length > 5 && (
              <div className="mt-2 flex items-center">
                <button
                  className="text-[10px] text-primary underline hover:no-underline"
                  onClick={() => setExpanded((s) => !s)}
                  aria-expanded={expanded}
                >
                  {expanded ? 'Show less' : `Show ${searchFilteredEvents.length - 5} more`}
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
