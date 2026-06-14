import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { List } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogPortal, DialogOverlay, DialogContent } from "./ui/dialog";

type Player = { id: string; name: string; pending_sips?: number };

interface PlayerPosition {
  id: string;
  x: number; // 0..1 fraction of container width
  y: number; // 0..1 fraction of container height
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
  // All positions stored as normalized fractions (0..1).
  // Rendered via CSS % so we never need to measure the container for display —
  // only during active drag do we read getBoundingClientRect().
  const [positionsPercent, setPositionsPercent] = useState<PlayerPosition[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [tapCounts, setTapCounts] = useState<Map<string, number>>(new Map());
  const tapTimersRef = useRef<Map<string, number>>(new Map());
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragMovedRef = useRef<boolean>(false);
  const suppressedRef = useRef<Map<string, number>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef<boolean>(false);

  const playerIdsKey = players.map(p => p.id).sort().join(',');

  const switchToClassic = () => {
    try { localStorage.setItem(STORAGE_KEY_VIEW, 'classic'); } catch {}
    if (onSwitchToClassic) onSwitchToClassic();
  };

  // Load positions from localStorage; compute circular defaults for new players.
  // useLayoutEffect so positions are set before the first paint — instant display.
  useLayoutEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current && positionsPercent.length === players.length) return;

    // Normalized radius for the circular default layout.
    // Container is aspect-square; TABLE is w-32 (128px) in ~400px reference.
    const computeDefaults = (): PlayerPosition[] => {
      const total = players.length || 1;
      const R = 0.5 - (64 + 16) / 400; // ~0.3
      return players.map((p, i) => {
        const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
        return { id: p.id, x: 0.5 + R * Math.cos(angle), y: 0.5 + R * Math.sin(angle) };
      });
    };

    let stored: PlayerPosition[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_POSITIONS);
      if (raw) stored = JSON.parse(raw);
    } catch {}

    const defaults = computeDefaults();
    const storedMap = new Map((stored ?? []).map(p => [p.id, p]));

    setPositionsPercent(prev => {
      const prevMap = new Map(prev.map(p => [p.id, p]));
      return players.map(p =>
        prevMap.get(p.id) ?? storedMap.get(p.id) ?? defaults.find(d => d.id === p.id)!
      );
    });

    initializedRef.current = true;
  }, [playerIdsKey, open]);

  // Persist normalized positions to localStorage whenever they change
  useEffect(() => {
    if (positionsPercent.length === 0) return;
    try { localStorage.setItem(STORAGE_KEY_POSITIONS, JSON.stringify(positionsPercent)); } catch {}
  }, [positionsPercent]);

  // Reset tap counts when closed
  useEffect(() => {
    if (!open) {
      setTapCounts(new Map());
      tapTimersRef.current.forEach(timer => clearTimeout(timer));
      tapTimersRef.current.clear();
    }
  }, [open]);

  // Prevent background scrolling when modal is open
  useLayoutEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const OPEN_COUNT_KEY = '__drunk_modal_open_count';
      const ORIGINAL_OVERFLOW_KEY = '__drunk_modal_original_overflow';
      const getCount = () => (window as any)[OPEN_COUNT_KEY] ?? 0;
      const setCount = (v: number) => { (window as any)[OPEN_COUNT_KEY] = v; };
      if (open) {
        try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch {}
        const prevCount = getCount();
        if (prevCount === 0) {
          (window as any)[ORIGINAL_OVERFLOW_KEY] = document.body.style.overflow || '';
          document.body.style.overflow = 'hidden';
        }
        setCount(prevCount + 1);
      }
      return () => {
        const prevCount = getCount();
        const next = Math.max(0, prevCount - (open ? 1 : 0));
        setCount(next);
        if (next === 0) {
          const original = (window as any)[ORIGINAL_OVERFLOW_KEY];
          try { document.body.style.overflow = typeof original === 'string' ? original : ''; } catch {}
          try { delete (window as any)[ORIGINAL_OVERFLOW_KEY]; } catch {}
        }
      };
    } catch {}
  }, [open]);

  const handleTap = (playerId: string) => {
    const currentCount = tapCounts.get(playerId) || 0;
    const newCount = currentCount + 1;
    setTapCounts(new Map(tapCounts.set(playerId, newCount)));
    const existingTimer = tapTimersRef.current.get(playerId);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      const finalCount = tapCounts.get(playerId) || newCount;
      if (finalCount > 0) {
        onSubmit(playerId, finalCount);
        setTapCounts(prev => { const next = new Map(prev); next.delete(playerId); return next; });
      }
      tapTimersRef.current.delete(playerId);
    }, 1000);
    tapTimersRef.current.set(playerId, timer);
  };

  // Convert client coords to normalized percent within the container
  const toPercent = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const handleMouseDown = (playerId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggedId(playerId);
    dragMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleTouchStart = (playerId: string, e: React.TouchEvent) => {
    setDraggedId(playerId);
    dragMovedRef.current = false;
    const t = e.touches[0];
    dragStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedId) return;
    if (dragStartRef.current) {
      if (Math.abs(e.clientX - dragStartRef.current.x) > 6 || Math.abs(e.clientY - dragStartRef.current.y) > 6)
        dragMovedRef.current = true;
    }
    const pct = toPercent(e.clientX, e.clientY);
    if (pct) setPositionsPercent(prev => prev.map(p => p.id === draggedId ? { ...p, ...pct } : p));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggedId) return;
    const touch = e.touches[0];
    if (dragStartRef.current) {
      if (Math.abs(touch.clientX - dragStartRef.current.x) > 6 || Math.abs(touch.clientY - dragStartRef.current.y) > 6)
        dragMovedRef.current = true;
    }
    const pct = toPercent(touch.clientX, touch.clientY);
    if (pct) setPositionsPercent(prev => prev.map(p => p.id === draggedId ? { ...p, ...pct } : p));
  };

  const handleDragEnd = () => {
    if (draggedId && dragMovedRef.current) {
      try {
        const t = window.setTimeout(() => suppressedRef.current.delete(draggedId!), 500);
        suppressedRef.current.set(draggedId, t);
      } catch {}
    }
    setDraggedId(null);
    dragStartRef.current = null;
    dragMovedRef.current = false;
  };

  // Native non-passive touchmove to prevent background scroll on touch devices
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const node = containerRef.current;
    const onTouchMove = (e: TouchEvent) => { if (e.target === node) e.preventDefault(); };
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => node.removeEventListener('touchmove', onTouchMove as any);
  }, [open]);

  if (!open) return null;

  const totalTaps = Array.from(tapCounts.values()).reduce((sum, n) => sum + n, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[100000] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent>
          <div className="space-y-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Give Sips</h2>
            </div>

            <div
              ref={containerRef}
              className="relative w-full aspect-square bg-accent/20 rounded-lg border-2 border-dashed border-accent overflow-hidden select-none"
              onMouseMove={handleMouseMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleDragEnd}
            >
              {/* Center table indicator */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 aspect-square rounded-full border-4 border-accent/40 flex items-center justify-center">
                <span className="text-sm text-muted-foreground font-semibold">TABLE</span>
              </div>

              {/* Player seats — CSS % positions need no container measurement */}
              {positionsPercent.map(pos => {
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
                    style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
                    onMouseDown={(e) => handleMouseDown(player.id, e)}
                    onTouchStart={(e) => handleTouchStart(player.id, e)}
                    onClick={(e) => {
                      if (suppressedRef.current.get(player.id)) { e.stopPropagation(); return; }
                      if (!isDragging) { e.stopPropagation(); handleTap(player.id); }
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
                      {tapCount > 0 && (
                        <div
                          className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-full min-w-[1.75rem] h-7 px-2 flex items-center justify-center text-xs font-bold shadow-lg animate-bounce border-2 border-background z-10"
                          style={{ transform: 'translate(50%, -50%)' }}
                        >
                          +{tapCount}
                        </div>
                      )}
                      <div className="whitespace-nowrap text-center">{player.name}</div>
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
              <Button variant="ghost" size="sm" onClick={switchToClassic} className="text-xs">
                <List className="h-4 w-4 mr-1" />
                Classic View
              </Button>
              <div className="text-center flex-1">
                {totalTaps > 0 && (
                  <p className="text-sm text-primary font-semibold animate-pulse">
                    Sending {totalTaps} sip{totalTaps !== 1 ? 's' : ''}...
                  </p>
                )}
              </div>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
