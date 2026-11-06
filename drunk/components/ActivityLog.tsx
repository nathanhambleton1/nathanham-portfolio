import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import PlayerAvatar from "./PlayerAvatar";
import { LiveDot } from "./LiveDot";
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
  soundEnabled = true,
}: {
  gameCode: string | undefined | null;
  players: any[];
  currentPlayer?: any;
  pollInterval?: number;
  soundEnabled?: boolean;
}) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showAdminEvents, setShowAdminEvents] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | 'all'>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
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

        // Build query for events. If expanded, fetch full history; otherwise fetch a limited recent window.
        let q: any = supabase.from('game_events').select('*').eq('game_id', gameId).order('created_at', { ascending: false });
        if (!expanded) q = q.limit(110);

        const { data: eventsData, error: eErr } = await q;

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
      try { subscription.unsubscribe(); } catch (e) {}
      if (timer) clearInterval(timer);
    };
  }, [gameCode, pollInterval, expanded]);

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

      if (e.type === 'gamble')
        return e.description || `${actor} gambled`;

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

      // Tax payments (go to free parking)
      if (e.type === 'tax') {
        const taxLabel = (e.description === 'Income Tax' || e.description === 'Luxury Tax') ? e.description : 'Tax';
        return `${from} paid ${taxLabel} — $${(e.amount || 0).toLocaleString()}`;
      }

      // Generic money transfers
      if (!e.from_player_id && e.to_player_id)
        return `${to} received $${(e.amount || 0).toLocaleString()}`;
      if (e.from_player_id && e.to_player_id)
        return `${from} paid ${to} $${(e.amount || 0).toLocaleString()}`;
      if (e.from_player_id && !e.to_player_id)
        return `${from} paid the Bank $${(e.amount || 0).toLocaleString()}`;

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

  // Play a sound when the current player is assigned sips/money of type `sip_assigned`.
  // Avoid playing on initial load — only play for events that arrive after we've seen
  // the initial batch (initializedRef guards that).
  const prevEventIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  // When `expanded` changes, the fetch re-runs and returns a larger batch of
  // historical events. Flag those as "already seen" so they don't trigger sound.
  const needReseedRef = useRef(false);
  const expandedInitRef = useRef(false);
  useEffect(() => {
    if (!expandedInitRef.current) {
      expandedInitRef.current = true;
      return;
    }
    needReseedRef.current = true;
  }, [expanded]);

  useEffect(() => {
    try {
      // On first pass, wait until we have a real batch of events so we can
      // seed the seen-ID set correctly. If we seed with an empty set and then
      // the initial fetch returns 20 events, all 20 would look "new" and the
      // sound would fire incorrectly.
      if (!initializedRef.current) {
        if (events.length === 0) return;
        prevEventIdsRef.current = new Set(events.map((e) => e.id));
        initializedRef.current = true;
        return;
      }

      // If the expanded fetch just returned a bigger historical batch, re-seed
      // without playing sound so old events don't spaz the alert.
      if (needReseedRef.current) {
        prevEventIdsRef.current = new Set(events.map((e) => e.id));
        needReseedRef.current = false;
        return;
      }

      const prev = prevEventIdsRef.current;
      const newEvents = events.filter((e) => !prev.has(e.id));
      if (newEvents.length > 0 && soundEnabled && currentPlayer) {
        for (const ev of newEvents) {
          try {
            const isSipAssignedMoney = String(ev.kind) === 'money' && String(ev.type) === 'sip_assigned' && ev.to_player_id && ev.to_player_id === currentPlayer.id;
            const isSipKind = String(ev.kind) === 'sip' && ev.to_player_id && ev.to_player_id === currentPlayer.id;
            if (isSipAssignedMoney || isSipKind) {
              const a = new Audio('/drink.mp3');
              const p = a.play();
              if (p && typeof p.then === 'function') p.catch(() => {});
            }
          } catch (e) {
            // ignore audio errors
          }
        }
      }
      prevEventIdsRef.current = new Set(events.map((e) => e.id));
    } catch (e) {
      // swallow
    }
  }, [events, soundEnabled, currentPlayer?.id]);

  const selectedPlayer = selectedPlayerId !== 'all' ? (players || []).find((p: any) => p.id === selectedPlayerId) : null;
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
    searchInputRef.current?.blur();
  };

  const visibleFilteredEvents = expanded ? searchFilteredEvents : searchFilteredEvents.slice(0, 5);

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="rounded-sm px-0.5" style={{ background: 'hsl(var(--brand) / 0.25)', color: 'inherit' }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <>
      <footer className="activity-log w-full flex-1 border-t border-foreground/10 bg-background/90 backdrop-blur-xl backdrop-saturate-150" style={{ boxShadow: 'inset 0 1px 0 0 hsl(var(--foreground) / 0.06)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex shrink-0 items-center gap-2.5">
              <LiveDot />
              <h2 className="font-board text-[13px] font-semibold uppercase tracking-[0.22em] text-foreground whitespace-nowrap">
                Activity
              </h2>
            </div>

            {/*
              Search + player filter share one slot. Closed: a round search
              button sits beside the filter pill. Open: the search button grows
              across the filter (which fades out beneath it) into one field.
            */}
            <div className="relative ml-auto h-10 min-w-[11.5rem] max-w-[22rem] flex-1">
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    tabIndex={searchOpen ? -1 : 0}
                    aria-hidden={searchOpen}
                    aria-label="Filter activity by player"
                    className={cn(
                      "absolute right-0 top-0 flex h-10 w-[8.5rem] items-center justify-between gap-1.5 rounded-full border px-3.5 text-xs transition-[opacity,transform,border-color,color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                      selectedPlayer
                        ? "border-foreground/40 bg-foreground/[0.06] text-foreground"
                        : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                      searchOpen && "pointer-events-none scale-90 opacity-0",
                    )}
                  >
                    <span className="truncate">{selectedPlayer ? selectedPlayer.name : 'All players'}</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", filterOpen && "rotate-180")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  collisionPadding={16}
                  className="w-60 overflow-y-auto overscroll-contain p-1.5"
                  style={{ maxHeight: 'min(22rem, var(--radix-popover-content-available-height))' }}
                >
                  <div role="listbox" aria-label="Filter activity by player" className="flex flex-col">
                    {[{ id: 'all', name: 'All players' } as any, ...(players || [])].map((p: any) => {
                      const selected = selectedPlayerId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => { setSelectedPlayerId(p.id); setFilterOpen(false); }}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none",
                            selected ? "text-foreground" : "text-foreground/80",
                          )}
                        >
                          {p.id === 'all' ? (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-foreground/15">
                              <Users className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <PlayerAvatar player={p} size="sm" />
                          )}
                          <span className="min-w-0 flex-1 truncate">
                            {p.name}
                            {currentPlayer && p.id === currentPlayer.id && <span className="text-muted-foreground"> (you)</span>}
                          </span>
                          {selected && <Check className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <div
                className={cn(
                  "absolute top-0 flex h-10 items-center overflow-hidden rounded-full border transition-[right,width,border-color,background-color] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  searchOpen
                    ? "right-0 w-full border-foreground/30 bg-background"
                    : "right-[9rem] w-10 border-foreground/10 bg-foreground/[0.03] hover:border-foreground/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!searchOpen) setSearchOpen(true);
                    // Focus synchronously so mobile keyboards open on the same tap.
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Search activity"
                  aria-expanded={searchOpen}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  tabIndex={searchOpen ? 0 : -1}
                  aria-hidden={!searchOpen}
                  onChange={(e) => { setSearchQuery(e.target.value); setExpanded(true); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
                  placeholder="Search activity…"
                  className={cn(
                    "min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none transition-opacity duration-200",
                    searchOpen ? "opacity-100 delay-100" : "pointer-events-none opacity-0",
                  )}
                  style={{ fontSize: '16px' }}
                />
                {searchOpen && query && (
                  <span className="shrink-0 pl-1 text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                    {searchFilteredEvents.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={closeSearch}
                  tabIndex={searchOpen ? 0 : -1}
                  aria-hidden={!searchOpen}
                  aria-label="Close search"
                  className={cn(
                    "mx-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-opacity duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
                    searchOpen ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div>
            <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.03] text-[11px] sm:text-xs">
              {searchFilteredEvents.length === 0 && (
                <li className="px-3 py-3 text-[11px] text-muted-foreground">
                  {query ? 'No matching activity' : 'No activity yet'}
                </li>
              )}
              {visibleFilteredEvents.map((ev) => (
                <li key={ev.id} className="text-foreground/90 flex items-baseline gap-3 px-3 py-2">
                  <span className="min-w-[3.5rem] shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                    {highlight(formatTime(ev.created_at))}
                  </span>
                  <span className="min-w-0 flex-1 whitespace-normal break-words">{highlight(formatEvent(ev))}</span>
                </li>
              ))}
            </ul>

            {searchFilteredEvents.length > 5 && (
              <div className="mt-3 flex items-center">
                <button
                  className="inline-flex min-h-10 items-center rounded-full border border-foreground/10 bg-foreground/[0.03] px-4 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
