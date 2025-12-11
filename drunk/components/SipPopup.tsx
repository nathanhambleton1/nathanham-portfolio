import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
  // build recipient list: include current player first, then the rest alphabetically
  const others = useMemo(() => {
    const list = [...players];
    let self: Player | null = null;
    const filtered = list.filter((p) => {
      if (currentPlayer && p.id === currentPlayer.id) {
        self = p;
        return false;
      }
      return true;
    });
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    const out: Player[] = [];
    if (self) out.push(self);
    out.push(...filtered);
    return out;
  }, [players, currentPlayer]);

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

  if (!open) return null;

  // If seating chart mode, render that instead
  if (viewMode === 'seating') {
    return (
      <SeatingChartSipPopup
        open={open}
        onOpenChange={onOpenChange}
        currentPlayer={currentPlayer}
        players={players}
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
        <DialogOverlay className="fixed inset-0 z-[99999] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[99999] grid mx-4 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"
        >
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
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
