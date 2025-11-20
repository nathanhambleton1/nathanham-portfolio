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
          .limit(200);
        
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
      // Special handling for join/leave events
      if ((e.type === "join" || e.type === "leave") && e.description) {
        return e.description;
      }
      // If this is a zero-amount event with a description (e.g. blocked due to pending sips), surface that message
      if ((e.amount || 0) === 0 && e.description) {
        // If this is a trade-timer action, show only the description (cleaner log)
        if (String(e.type).startsWith('trade_timer') || e.description.toLowerCase().includes('trade timer')) {
          return e.description;
        }
        // Simplify blocked payment log for pending sips
        if (e.description.toLowerCase().includes('pending sips')) {
          return `Payment blocked: recipient has pending sips.`;
        }
        if (e.from_player_id && e.to_player_id) return `${actor} attempted to pay ${to} $0 — ${e.description}`;
        if (!e.from_player_id && e.to_player_id) return `${actor} would have received $0 — ${e.description}`;
        return `${actor} money event: ${e.type} $0 — ${e.description}`;
      }
      if (e.type === "free_parking_collect")
        return `${actor} collected $${(e.amount || 0).toLocaleString()} from Free Parking`;
      if (!e.from_player_id && e.to_player_id)
        return `${actor} received $${(e.amount || 0).toLocaleString()} (${e.type})`;
      if (e.from_player_id && e.to_player_id)
        return `${actor} paid $${(e.amount || 0).toLocaleString()} from ${from} to ${to} (${e.type})`;
      return `${actor} money event: ${e.type} $${(e.amount || 0).toLocaleString()}`;
    }
    if (e.kind === "sip") {
      const fromName = idToName(e.actor_player_id);
      const toName = idToName(e.to_player_id);
      return `${fromName} assigned ${e.sip_count || 0} sip${(e.sip_count || 0) > 1 ? "s" : ""} to ${toName} (${e.type})`;
    }
    return e.description || `${e.kind} ${e.type}`;
  };

  const visibleEvents = expanded ? events : events.slice(0, 5);

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
              {events.length === 0 && (
                <li className="text-[10px] text-muted-foreground">No activity yet</li>
              )}
              {visibleEvents.map((ev) => (
                <li key={ev.id} className="text-foreground/90 flex items-start gap-2">
                  <span className="text-muted-foreground min-w-[44px] text-[9px] sm:text-[10px]">
                    {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="whitespace-normal break-words">{formatEvent(ev)}</span>
                </li>
              ))}
            </ul>

            {events.length > 10 && (
              <div className="mt-2 flex items-center">
                <button
                  className="text-[10px] text-primary underline hover:no-underline"
                  onClick={() => setExpanded((s) => !s)}
                  aria-expanded={expanded}
                >
                  {expanded ? 'Show less' : `Show ${events.length - 10} more`}
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}