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
  pollInterval = 2000,
}: {
  gameCode: string | undefined | null;
  players: any[];
  pollInterval?: number;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [expanded, setExpanded] = useState(false);

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

  const visibleEvents = expanded ? events : events.slice(0, 5);
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

  const visibleFilteredEvents = expanded ? filteredEvents : filteredEvents.slice(0, 5);

  return (
    <>
      <div style={{ height: 40 }} aria-hidden="true" />
      <footer className="activity-log w-full bg-white/95 border-t border-border" style={{ boxShadow: '0 -2px 8px 0 rgba(0,0,0,0.03)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-semibold text-xs sm:text-sm">Activity</div>
            <div className="ml-auto text-[10px] sm:text-xs text-muted-foreground">Live</div>
          </div>
          <div>
            <ul className="space-y-1 text-[10px] sm:text-xs">
              {filteredEvents.length === 0 && (
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

            {filteredEvents.length > 10 && (
              <div className="mt-2 flex items-center">
                <button
                  className="text-[10px] text-primary underline hover:no-underline"
                  onClick={() => setExpanded((s) => !s)}
                  aria-expanded={expanded}
                >
                  {expanded ? 'Show less' : `Show ${filteredEvents.length - 10} more`}
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}