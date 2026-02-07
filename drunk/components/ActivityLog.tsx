import { useEffect, useState } from "react";
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
  // Default to hiding commissioner corrections even for commissioners to keep the feed clean.
  const [showAdminEvents, setShowAdminEvents] = useState(false);
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

  const visibleFilteredEvents = expanded ? adminFilteredEvents : adminFilteredEvents.slice(0, 5);

  return (
    <>
      <style>{`@keyframes nhp-live-pulse { 0% { transform: scale(1); opacity: 0.85; } 70% { transform: scale(2); opacity: 0; } 100% { transform: scale(2); opacity: 0; } } @keyframes nhp-live-scale { 0% { transform: scale(0.8); box-shadow: 0 0 6px rgba(16,185,129,0.4); } 50% { transform: scale(1.2); box-shadow: 0 0 12px rgba(16,185,129,0.95); } 100% { transform: scale(0.8); box-shadow: 0 0 6px rgba(16,185,129,0.4); } }`}</style>
      <div style={{ height: 40 }} aria-hidden="true" />
      <footer className="activity-log w-full bg-white/95 border-t border-border" style={{ boxShadow: '0 -2px 8px 0 rgba(0,0,0,0.03)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-semibold text-xs sm:text-sm">Activity</div>
            {isCommissioner ? (
              <button
                type="button"
                onClick={() => setShowAdminEvents((v) => !v)}
                className="ml-2 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-4"
                title="Toggle visibility of commissioner corrections"
              >
                {showAdminEvents ? 'Hide corrections' : 'Show corrections'}
              </button>
            ) : null}
            <div className="ml-auto flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
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
          <div>
            <ul className="space-y-1 text-[10px] sm:text-xs">
              {adminFilteredEvents.length === 0 && (
                <li className="text-[10px] text-muted-foreground">No activity yet</li>
              )}
              {visibleFilteredEvents.map((ev) => (
                <li key={ev.id} className="text-foreground/90 flex items-start gap-2">
                  <span className="text-muted-foreground min-w-[44px] text-[9px] sm:text-[10px]">
                    {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="whitespace-normal break-words">{formatEvent(ev)}</span>
                </li>
              ))}
            </ul>

            {adminFilteredEvents.length > 10 && (
              <div className="mt-2 flex items-center">
                <button
                  className="text-[10px] text-primary underline hover:no-underline"
                  onClick={() => setExpanded((s) => !s)}
                  aria-expanded={expanded}
                >
                  {expanded ? 'Show less' : `Show ${adminFilteredEvents.length - 10} more`}
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
