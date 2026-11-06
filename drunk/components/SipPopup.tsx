import React, { useEffect, useMemo, useState } from "react";
import { setDropdownOpen } from "./ui/dropdown-menu";
import useLockBodyScroll from "../hooks/use-lock-body-scroll";
import PlayerAvatar from "./PlayerAvatar";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import SeatingChartSipPopup from "./SeatingChartSipPopup";
import { LayoutGrid, List } from "lucide-react";

type Player = { id: string; name: string; pending_sips?: number };

const STORAGE_KEY_VIEW = "drunkopoly:sipViewMode";

export default function SipPopup({
  open,
  onOpenChange,
  currentPlayer,
  players = [],
  onSubmit,
  allowSelf,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlayer: Player | null;
  players?: Player[];
  onSubmit: (to: string | string[], sip_count: number) => void;
  allowSelf?: boolean;
}) {
  const [viewMode, setViewMode] = useState<'classic' | 'seating'>('seating');

  // Load saved view mode when component mounts or opens
  useEffect(() => {
    if (open) {
      try {
        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_VIEW) : null;
        setViewMode((saved === 'classic' ? 'classic' : 'seating') as 'classic' | 'seating');
      } catch {
        setViewMode('seating');
      }
    }
  }, [open]);

  // ensure any dropdowns are closed when this popup opens
  useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  const toggleViewMode = () => {
    const newMode = viewMode === 'classic' ? 'seating' : 'classic';
    setViewMode(newMode);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY_VIEW, newMode);
      }
    } catch {
      // ignore storage errors
    }
  };
  // build recipient list: include current player first (only when allowed), then the rest alphabetically, exclude bankrupt players
  const others = useMemo(() => {
    const list = [...players];
    let self: Player | null = null;
    const filtered = list.filter((p) => {
      if (currentPlayer && p.id === currentPlayer.id) {
        // only include self as a recipient when caller explicitly allows it and the current player is not bankrupt
        if (allowSelf && !(currentPlayer as any).is_bankrupt) {
          self = p;
        }
        return false;
      }
      // Exclude bankrupt players
      return !(p as any).is_bankrupt;
    });
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    const out: Player[] = [];
    if (self) out.push(self);
    out.push(...filtered);
    return out;
  }, [players, currentPlayer, allowSelf]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  // compute list of all other ids (exclude current player)
  // keep slider state separate from typed input; start input blank so users can type immediately
  const [sipCount, setSipCount] = useState<number>(1);
  const [rawSip, setRawSip] = useState<string>("");

  // reset when opened
  const prevOpen = React.useRef(false);
  useEffect(() => {
    if (!prevOpen.current && open) {
      setSelectedIds(new Set());
      setSipCount(1);
      setRawSip("");
    }
    prevOpen.current = open;
  }, [open]);

  useLockBodyScroll(!!open);

  // seating chart should exclude bankrupt players; only keep current player if allowed and not bankrupt
  const seatingPlayers = useMemo(() => {
    if (!players) return [];
    return players.filter((p) => {
      if (currentPlayer && p.id === currentPlayer.id) {
        return !!allowSelf && !(currentPlayer as any).is_bankrupt;
      }
      return !(p as any).is_bankrupt;
    });
  }, [players, currentPlayer, allowSelf]);

  if (!open) return null;

  // If seating chart mode, render that instead
  if (viewMode === 'seating') {
    return (
      <SeatingChartSipPopup
        open={open}
        onOpenChange={onOpenChange}
        currentPlayer={currentPlayer}
        players={seatingPlayers}
        onSubmit={onSubmit}
        onSwitchToClassic={toggleViewMode}
      />
    );
  }

  // effective count: if user typed a value, use that (rounded), otherwise use slider
  const typedNum = rawSip.trim() !== "" ? Number(rawSip) || 0 : NaN;
  const effectiveCount = !Number.isNaN(typedNum) ? Math.max(1, Math.round(typedNum)) : sipCount;

  const handleSubmit = () => {
    if (!selectedIds || selectedIds.size === 0) return;
    const finalCount = rawSip.trim() !== "" ? Math.max(1, Math.round(Number(rawSip) || 1)) : sipCount;
    onSubmit(Array.from(selectedIds), finalCount);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[100000] bg-transparent data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent>
        <DialogHeader className="items-center sm:items-start">
          <img src="/drunkopoly/sips.webp" alt="" aria-hidden draggable={false} className="mb-2 h-20 w-auto max-w-[70%] select-none object-contain" />
          <DialogTitle>Give Sips</DialogTitle>
          <DialogDescription>Select one or more players and how many sips to assign.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Choose recipient</div>
            <div className="grid gap-2">
              {others.length === 0 && <div className="text-sm text-muted-foreground">No players</div>}
              {others.length > 0 && (
                <>
                  {/* render current player first (others built to put self first) */}
                  {(() => {
                    const first = others[0];
                    return (
                      <label key={first.id} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition duration-200 ${selectedIds.has(first.id) ? 'border-brand/60 bg-brand/10 ring-1 ring-inset ring-brand/30' : 'border-foreground/10 bg-foreground/[0.03] hover:border-brand/40'}`}>
                        <input className="h-4 w-4 shrink-0 accent-[hsl(var(--brand))]" type="checkbox" name="sip-recipient" checked={selectedIds.has(first.id)} onChange={() => toggleSelected(first.id)} />
                        <PlayerAvatar player={first} size="sm" />
                        <div className="min-w-0 flex-1 truncate text-sm font-medium">{first.name}{first.id === currentPlayer?.id ? ' (you)' : ''}</div>
                        <div className="shrink-0 text-xs tabular-nums text-muted-foreground">{(first.pending_sips || 0) > 0 ? `${first.pending_sips} pending` : ''}</div>
                      </label>
                    );
                  })()}

                  {/* (removed "Everyone else" quick-select) */}

                  {/* render remaining players (skip first) */}
                  {others.slice(1).map((p) => (
                    <label key={p.id} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition duration-200 ${selectedIds.has(p.id) ? 'border-brand/60 bg-brand/10 ring-1 ring-inset ring-brand/30' : 'border-foreground/10 bg-foreground/[0.03] hover:border-brand/40'}`}>
                      <input className="h-4 w-4 shrink-0 accent-[hsl(var(--brand))]" type="checkbox" name="sip-recipient" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                      <PlayerAvatar player={p} size="sm" />
                      <div className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}{p.id === currentPlayer?.id ? ' (you)' : ''}</div>
                      <div className="shrink-0 text-xs tabular-nums text-muted-foreground">{(p.pending_sips || 0) > 0 ? `${p.pending_sips} pending` : ''}</div>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Sips</div>
              <div className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text font-display text-3xl font-bold tabular-nums tracking-tight text-transparent">{effectiveCount}</div>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={sipCount}
              onChange={(e) => setSipCount(Number(e.target.value))}
              aria-label="Sip count"
              className="w-full touch-range"
            />
            <div className="flex items-center gap-2">
              <Input
                value={rawSip}
                onChange={(e) => setRawSip(e.target.value)}
                onBlur={() => {
                  if (rawSip.trim() !== "") {
                    const n = Math.max(1, Math.round(Number(rawSip) || 1));
                    setSipCount(n);
                    setRawSip(String(n));
                  }
                }}
                className="h-11 w-32"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 2"
                min={1}
              />
              <div className="text-sm text-muted-foreground">Total Sips</div>
            </div>
          </div>
        </div>

        <DialogFooter>
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleViewMode}
                className="h-10 self-center text-xs sm:self-auto"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Seating Chart
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSubmit} className="h-11 flex-1 sm:h-10 sm:flex-none" disabled={!(selectedIds && selectedIds.size > 0)}>Give</Button>
              </div>
            </div>
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
