import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { X, List } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogPortal, DialogOverlay, DialogContent } from "./ui/dialog";

type Player = { id: string; name: string; pending_sips?: number };

interface PlayerPosition {
  id: string;
  x: number;
  y: number;
}

const STORAGE_KEY_VIEW = "drunkopoly:sipViewMode";
const STORAGE_KEY_POSITIONS = "drunkopoly:seatingPositions";

export default function SeatingChartSipPopup({
  open,
  onOpenChange,
  currentPlayer,
  players = [],
  onSubmit,
  onSwitchToClassic,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlayer: Player | null;
  players?: Player[];
  onSubmit: (to: string | string[], sip_count: number) => void;
  onSwitchToClassic?: () => void;
}) {
  const [positions, setPositions] = useState<PlayerPosition[]>([]);
  // normalized positions stored as fractions of container width/height (0..1)
  const [positionsPercent, setPositionsPercent] = useState<PlayerPosition[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [tapCounts, setTapCounts] = useState<Map<string, number>>(new Map());
  const tapTimersRef = useRef<Map<string, number>>(new Map());
  // track if a drag actually moved (to suppress click after drag)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef<boolean>(false);
  // suppressed clicks per player id -> timeout id
  const suppressedRef = useRef<Map<string, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  // Track if initial positions have been set for this open session
  const initializedRef = useRef<boolean>(false);
  const positionsSetRef = useRef<boolean>(false);

  // Stable player IDs string - only changes when players are added/removed
  const playerIdsKey = players.map(p => p.id).sort().join(',');

  const switchToClassic = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_VIEW, 'classic');
      }
    } catch {
      // ignore
    }
    if (onSwitchToClassic) {
      onSwitchToClassic();
    }
  };

  // Initialize positions in a circle when player list changes (add/remove)
  // Use useLayoutEffect so measurements and initial position setting happen
  // before the browser paints, preventing a visible layout jump on open.
  // Only recalculate when player IDs change, not when pending_sips updates.
  useLayoutEffect(() => {
    if (!open) {
      // Reset flags when closing
      initializedRef.current = false;
      positionsSetRef.current = false; // Add this line
      return;
    }

    // Skip if already initialized for this open session (prevents jump on data refresh)
    if (initializedRef.current && positions.length === players.length) {
      return;
    }

    const computeDefaultPercentPositions = (width: number, height: number) => {
      const totalPlayers = players.length || 1;
      // Ensure the seating positions are calculated relative to the
      // center "TABLE" circle size so seats don't overlap the label.
      // Match the Tailwind `w-32` (8rem -> 128px at 16px base) diameter.
      const TABLE_DIAM = 128; // px
      const EXTRA_PADDING = 16; // px of extra space between table and seats
      const radius = Math.min(width, height) / 2 - (TABLE_DIAM / 2 + EXTRA_PADDING);
      const centerX = width / 2;
      const centerY = height / 2;

      return players.map((p, i) => {
        const angle = (i / totalPlayers) * 2 * Math.PI - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        return {
          id: p.id,
          x: x / width,
          y: y / height,
        };
      });
    };

    const rect = containerRef.current?.getBoundingClientRect();

    // Try load stored normalized positions from localStorage
    let stored: PlayerPosition[] | null = null;
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY_POSITIONS);
        if (raw) stored = JSON.parse(raw);
      }
    } catch {}

    const width = rect?.width ?? 400;
    const height = rect?.height ?? 400;

    const defaults = computeDefaultPercentPositions(width, height);

    // Merge: prefer stored for existing players, otherwise use defaults
    const percentMap = new Map<string, PlayerPosition>();
    (stored ?? []).forEach(p => percentMap.set(p.id, p));
    defaults.forEach(d => {
      if (!percentMap.has(d.id)) percentMap.set(d.id, d);
    });

    // Merge with any existing normalized positions in state to avoid stomping
    setPositionsPercent(prev => {
      const prevMap = new Map(prev.map(x => [x.id, x]));
      // ensure every current player has an entry (prefer existing, then stored, then default)
      const merged = players.map(p => prevMap.get(p.id) ?? percentMap.get(p.id) ?? defaults.find(d => d.id === p.id)!);
      // compute pixel positions but preserve any currently-dragged pixel position
      const pixelPositions = merged.map(pp => ({
        id: pp.id,
        x: (pp.x ?? 0.5) * width,
        y: (pp.y ?? 0.5) * height,
      }));
      setPositions(currPos => {
        // if a drag is active, preserve that player's pixel coords from currPos
        if (draggedId) {
          const dragged = currPos.find(x => x.id === draggedId);
          if (dragged) {
            return pixelPositions.map(p => p.id === draggedId ? dragged : p);
          }
        }
        return pixelPositions;
      });

      return merged as PlayerPosition[];
    });

    // Mark as initialized for this open session
    initializedRef.current = true;
  }, [playerIdsKey, open]);

  // Recompute positions when the container size changes so items stay centered
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Skip if not open or if we've already set initial positions
    if (!open || positionsSetRef.current) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // Only update if we have meaningful dimensions
        if (width > 0 && height > 0) {
          setPositions(prev => {
            const pixels = positionsPercent.map(p => ({
              id: p.id,
              x: (p.x ?? 0.5) * width,
              y: (p.y ?? 0.5) * height,
            }));
            
            if (draggedId) {
              const dragged = prev.find(x => x.id === draggedId);
              if (dragged) {
                return pixels.map(p => p.id === draggedId ? dragged : p);
              }
            }
            return pixels;
          });
          
          // Mark that we've set initial positions
          positionsSetRef.current = true;
        }
      }
    });

    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      // Reset the flag when closing
      if (!open) {
        positionsSetRef.current = false;
      }
    };
  }, [open, players, positionsPercent, draggedId]);

  // Reset tap counts when closed
  useEffect(() => {
    if (!open) {
      setTapCounts(new Map());
      tapTimersRef.current.forEach(timer => clearTimeout(timer));
      tapTimersRef.current.clear();
    }
  }, [open]);

  // Save normalized positions to localStorage whenever they change
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(positionsPercent));
      }
    } catch {}
  }, [positionsPercent]);

  // Prevent background scrolling when modal is open
  // Use useLayoutEffect so the scrollbar is hidden before paint
  // which avoids a small layout shift when the dialog opens.
  useLayoutEffect(() => {
    // Use a global counter on window to support multiple overlays
    // so we only restore overflow when the last overlay closes.
    try {
      if (typeof window === 'undefined') return;

      const OPEN_COUNT_KEY = '__drunk_modal_open_count';
      const ORIGINAL_OVERFLOW_KEY = '__drunk_modal_original_overflow';

      const getCount = () => (window as any)[OPEN_COUNT_KEY] ?? 0;
      const setCount = (v: number) => { (window as any)[OPEN_COUNT_KEY] = v; };

      if (open) {
        // ensure header is visible when opening modal
        try {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } catch {}
        const prevCount = getCount();
        if (prevCount === 0) {
          // store the original overflow value once
          (window as any)[ORIGINAL_OVERFLOW_KEY] = document.body.style.overflow || '';
          document.body.style.overflow = 'hidden';
        }
        setCount(prevCount + 1);
      }

      return () => {
        // on cleanup (close or unmount), decrement counter and restore when zero
        const prevCount = getCount();
        const next = Math.max(0, prevCount - (open ? 1 : 0));
        setCount(next);
        if (next === 0) {
          const original = (window as any)[ORIGINAL_OVERFLOW_KEY];
          try {
            document.body.style.overflow = typeof original === 'string' ? original : '';
          } catch {}
          try { delete (window as any)[ORIGINAL_OVERFLOW_KEY]; } catch {}
        }
      };
    } catch {
      // ignore errors interacting with window/style
    }
  }, [open]);

  const handleTap = (playerId: string) => {
    const currentCount = tapCounts.get(playerId) || 0;
    const newCount = currentCount + 1;
    
    setTapCounts(new Map(tapCounts.set(playerId, newCount)));
    
    // Clear existing timer for this player
    const existingTimer = tapTimersRef.current.get(playerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new timer to auto-send after 1 second
    const timer = window.setTimeout(() => {
      const finalCount = tapCounts.get(playerId) || newCount;
      if (finalCount > 0) {
        onSubmit(playerId, finalCount);
        setTapCounts(prev => {
          const next = new Map(prev);
          next.delete(playerId);
          return next;
        });
      }
      tapTimersRef.current.delete(playerId);
    }, 1000);
    
    tapTimersRef.current.set(playerId, timer);
  };

  const handleMouseDown = (playerId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedId(playerId);
    dragMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleTouchStart = (playerId: string, e: React.TouchEvent) => {
    // avoid calling preventDefault in React synthetic handlers (passive listener warnings)
    setDraggedId(playerId);
    dragMovedRef.current = false;
    const t = e.touches[0];
    dragStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // mark moved if movement exceeds threshold
    if (dragStartRef.current) {
      const dx = Math.abs(e.clientX - dragStartRef.current.x);
      const dy = Math.abs(e.clientY - dragStartRef.current.y);
      if (dx > 6 || dy > 6) dragMovedRef.current = true;
    }
    
    setPositions(prev =>
      prev.map(p =>
        p.id === draggedId
          ? { ...p, x: Math.max(0, Math.min(rect.width, x)), y: Math.max(0, Math.min(rect.height, y)) }
          : p
      )
    );
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedId || !containerRef.current) return;
    
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // mark moved if movement exceeds threshold
    if (dragStartRef.current) {
      const dx = Math.abs(touch.clientX - dragStartRef.current.x);
      const dy = Math.abs(touch.clientY - dragStartRef.current.y);
      if (dx > 6 || dy > 6) dragMovedRef.current = true;
    }
    
    setPositions(prev =>
      prev.map(p =>
        p.id === draggedId
          ? { ...p, x: Math.max(0, Math.min(rect.width, x)), y: Math.max(0, Math.min(rect.height, y)) }
          : p
      )
    );
  };

  const handleMouseUp = () => {
    if (draggedId && dragMovedRef.current) {
      try {
        // suppress immediate click for this id briefly
        const t = window.setTimeout(() => {
          const map = suppressedRef.current;
          map.delete(draggedId);
        }, 500);
        suppressedRef.current.set(draggedId, t);
      } catch {}
    }
    // persist normalized position for this id
    try {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && draggedId) {
        const p = positions.find(x => x.id === draggedId);
        if (p) {
          setPositionsPercent(prev => {
            const next = new Map(prev.map(x => [x.id, x]));
            next.set(draggedId!, { id: draggedId!, x: Math.max(0, Math.min(1, p.x / rect.width)), y: Math.max(0, Math.min(1, p.y / rect.height)) });
            return Array.from(next.values());
          });
        }
      }
    } catch {}

    setDraggedId(null);
    dragStartRef.current = null;
    dragMovedRef.current = false;
  };

  const handleTouchEnd = () => {
    if (draggedId && dragMovedRef.current) {
      try {
        const t = window.setTimeout(() => {
          const map = suppressedRef.current;
          map.delete(draggedId);
        }, 500);
        suppressedRef.current.set(draggedId, t);
      } catch {}
    }
    // persist normalized position for this id (same as mouse up)
    try {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && draggedId) {
        const p = positions.find(x => x.id === draggedId);
        if (p) {
          setPositionsPercent(prev => {
            const next = new Map(prev.map(x => [x.id, x]));
            next.set(draggedId!, { id: draggedId!, x: Math.max(0, Math.min(1, p.x / rect.width)), y: Math.max(0, Math.min(1, p.y / rect.height)) });
            return Array.from(next.values());
          });
        }
      }
    } catch {}

    setDraggedId(null);
    dragStartRef.current = null;
    dragMovedRef.current = false;
  };

  // Attach a native non-passive touchmove listener on the container to prevent background
  // scrolling on touch devices when touching the seating area. React synthetic handlers
  // don't allow setting passive option, so we add a native listener.
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const node = containerRef.current;
    const onTouchMove = (e: TouchEvent) => {
      // only prevent default when touching the container itself (not a child element)
      if (e.target === node) {
        e.preventDefault();
      }
    };
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => node.removeEventListener('touchmove', onTouchMove as any);
  }, [open]);

  if (!open) return null;

  const totalTaps = Array.from(tapCounts.values()).reduce((sum, count) => sum + count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[100000] bg-black/80" />
        <DialogContent>
        <div className="space-y-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Give Sips</h2>
          </div>

          <div
            ref={containerRef}
            className="relative w-full aspect-square bg-accent/20 rounded-lg border-2 border-dashed border-accent overflow-hidden select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
          {/* Center table indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 aspect-square rounded-full border-4 border-accent/40 flex items-center justify-center">
            <span className="text-sm text-muted-foreground font-semibold">TABLE</span>
          </div>

          {/* Player seats */}
          {positions.map(pos => {
            const player = players.find(p => p.id === pos.id);
            if (!player) return null;

            const tapCount = tapCounts.get(player.id) ?? 0;
            const currentSips = player.pending_sips ?? 0;
            const isDragging = draggedId === player.id;

            return (
              <div
                key={player.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform ${
                  isDragging ? 'scale-110 cursor-grabbing z-10' : 'cursor-grab hover:scale-105'
                }`}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                }}
                onMouseDown={(e) => handleMouseDown(player.id, e)}
                onTouchStart={(e) => handleTouchStart(player.id, e)}
                onClick={(e) => {
                  // if we suppressed clicks for this id due to a drag, ignore
                  const suppressed = suppressedRef.current.get(player.id);
                  if (suppressed) {
                    e.stopPropagation();
                    return;
                  }

                  if (!isDragging) {
                    e.stopPropagation();
                    handleTap(player.id);
                  }
                }}
              >
                <div
                  className={`relative px-4 py-2 pt-3 rounded-lg border-2 font-semibold text-sm transition-all ${
                    tapCount > 0
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                      : 'bg-background border-accent hover:bg-accent/50'
                  }`}
                  style={{ minWidth: 56 }}
                >
                  {/* Top-right badge for pending sips being added */}
                  {tapCount > 0 && (
                    <div
                      className="absolute top-0 right-0 -translate-y-1/2 bg-destructive text-destructive-foreground rounded-full min-w-[1.75rem] h-7 px-2 flex items-center justify-center text-xs font-bold shadow-lg animate-bounce border-2 border-background z-10"
                      style={{ transform: 'translate(50%, -50%)' }}
                    >
                      +{tapCount}
                    </div>
                  )}

                  <div className="whitespace-nowrap text-center">{player.name}</div>

                  {/* Current sip count - always displayed */}
                  <div className="mt-2 flex justify-center">
                    <div
                      className={`inline-flex items-center justify-center rounded-full min-w-[1.5rem] h-6 px-2 text-xs font-bold ${
                        currentSips > 0
                          ? 'bg-muted text-foreground border border-border'
                          : 'bg-transparent text-muted-foreground border border-border'
                      }`}
                    >
                      {currentSips}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={switchToClassic}
            className="text-xs"
          >
            <List className="h-4 w-4 mr-1" />
            Classic View
          </Button>
          <div className="text-center flex-1">
            {totalTaps > 0 ? (
              <p className="text-sm text-primary font-semibold animate-pulse">
                Sending {totalTaps} sip{totalTaps !== 1 ? 's' : ''}...
              </p>
            ) : null}
          </div>
          <div>
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
