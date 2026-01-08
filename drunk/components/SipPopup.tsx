import React, { useEffect, useMemo, useState } from "react";
import { setDropdownOpen } from "./ui/dropdown-menu";
import useLockBodyScroll from "../hooks/use-lock-body-scroll";
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
  const [viewMode, setViewMode] = useState<'classic' | 'seating'>('classic');

  // Load saved view mode when component mounts or opens
  useEffect(() => {
    if (open) {
      try {
        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_VIEW) : null;
        setViewMode((saved === 'seating' ? 'seating' : 'classic') as 'classic' | 'seating');
      } catch {
        setViewMode('classic');
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
        <DialogOverlay className="fixed inset-0 z-[100000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Give Sips</DialogTitle>
          <DialogDescription>Select one or more players and how many sips to assign.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Choose recipient</div>
            <div className="grid gap-2">
              {others.length === 0 && <div className="text-sm text-muted-foreground">No players</div>}
              {others.length > 0 && (
                <>
                  {/* render current player first (others built to put self first) */}
                  {(() => {
                    const first = others[0];
                    return (
                      <label key={first.id} className={`flex items-center gap-2 p-2 border rounded ${selectedIds.has(first.id) ? 'bg-primary/10' : ''}`}>
                        <input type="checkbox" name="sip-recipient" checked={selectedIds.has(first.id)} onChange={() => toggleSelected(first.id)} />
                        <div className="flex-1">{first.name}{first.id === currentPlayer?.id ? ' (you)' : ''}</div>
                        <div className="text-sm text-muted-foreground">{(first.pending_sips || 0) > 0 ? `${first.pending_sips} pending` : ''}</div>
                      </label>
                    );
                  })()}

                  {/* (removed "Everyone else" quick-select) */}

                  {/* render remaining players (skip first) */}
                  {others.slice(1).map((p) => (
                    <label key={p.id} className={`flex items-center gap-2 p-2 border rounded ${selectedIds.has(p.id) ? 'bg-primary/10' : ''}`}>
                      <input type="checkbox" name="sip-recipient" checked={selectedIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                      <div className="flex-1">{p.name}{p.id === currentPlayer?.id ? ' (you)' : ''}</div>
                      <div className="text-sm text-muted-foreground">{(p.pending_sips || 0) > 0 ? `${p.pending_sips} pending` : ''}</div>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Sips</div>
              <div className="text-sm text-muted-foreground">{effectiveCount}</div>
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
                className="w-32"
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
            <div className="flex gap-2 w-full justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleViewMode}
                className="text-xs"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Seating Chart
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSubmit} className="bg-primary" disabled={!(selectedIds && selectedIds.size > 0)}>Give</Button>
              </div>
            </div>
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
