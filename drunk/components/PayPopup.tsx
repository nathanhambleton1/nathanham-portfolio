import React, { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Player = { id: string; name: string; balance?: number };

export default function PayPopup({
  open,
  onOpenChange,
  mode,
  currentPlayer,
  players = [],
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "bank" | "players" | "tax" | null;
  currentPlayer: Player | null;
  players?: Player[];
  onSubmit: (payments: { to: string | null; amount: number }[], opts?: { freeParking?: boolean }) => void;
}) {
  // For tax mode: should tax go to Free Parking?
  const [freeParking, setFreeParking] = useState(false);
  const others = useMemo(() => players.filter((p) => p.id !== currentPlayer?.id), [players, currentPlayer]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [amountPer, setAmountPer] = useState<number>(5);
  // keep the typed input separate from the slider value; start blank so users can type immediately
  const [rawAmount, setRawAmount] = useState<string>("");

  // Initialize popup state only when the dialog actually opens (avoid resets during polling updates)
  const prevOpenRef = React.useRef<boolean>(false);
  useEffect(() => {
    const prev = prevOpenRef.current;
    if (!prev && open) {
      setSelectedIds(new Set()); // Always start with no selection
      setFreeParking(false);
      setAmountPer(5);
      setRawAmount("");
    }
    prevOpenRef.current = open;
  }, [open]);

  if (!mode) return null;

  // For tax, always 1 payment (to bank or free parking), not per player
  const roundToFive = (v: number) => Math.max(0, Math.round(v / 5) * 5);
  const count = selectedIds.size || (mode === "bank" ? 1 : 0);
  // If the user has typed an amount, use that (rounded). Otherwise fall back to slider `amountPer`.
  const rawAmountNum = rawAmount.trim() !== "" ? Number(rawAmount) || 0 : NaN;
  const roundedLive = !Number.isNaN(rawAmountNum) ? Math.min(200, roundToFive(rawAmountNum)) : amountPer;
  const total = mode === "tax"
    ? roundedLive
    : (mode === "bank" ? roundedLive : roundedLive * count);

  const togglePlayer = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSubmit = () => {
    if (!currentPlayer) return;
    // Use typed value if present, otherwise fall back to slider
    const rounded = rawAmount.trim() !== "" ? Math.min(200, roundToFive(Number(rawAmount))) : amountPer;
    setAmountPer(Math.min(rounded, visibleSliderMax));
    setRawAmount(String(rounded));
    let payments: { to: string | null; amount: number }[] = [];
    if (mode === "bank") {
      payments = [{ to: null, amount: rounded }];
    } else if (mode === "tax") {
      payments = [{ to: null, amount: rounded }];
    } else {
      const ids = Array.from(selectedIds);
      payments = ids.map((id) => ({ to: id, amount: rounded }));
    }
    onSubmit(payments, { freeParking: mode === "tax" && freeParking });
    onOpenChange(false);
  };

  const visibleSliderMax = 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay — {mode === "bank" ? "Bank" : mode === "tax" ? "Tax" : "Players"}</DialogTitle>
          <DialogDescription>
            {mode === "bank" && "Pay the bank. This will deduct the amount from your balance."}
            {mode === "players" && "Select one or more players to pay. Amount below is per player."}
            {mode === "tax" && "Pay tax: amount is per player and will be distributed to all other players."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Only show recipients for players mode */}
          {mode === "players" && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Choose recipients</div>
              <div className="grid gap-2">
                {others.length === 0 && <div className="text-sm text-muted-foreground">No other players</div>}
                {others.map((p) => (
                  <label key={p.id} className={`flex items-center gap-2 p-2 border rounded ${selectedIds.has(p.id) ? 'bg-primary/10' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => togglePlayer(p.id)}
                    />
                    <div className="flex-1">{p.name}</div>
                    <div className="text-sm text-muted-foreground">${(p.balance ?? 0).toLocaleString()}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* For tax, show Free Parking checkbox */}
          {mode === "tax" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="free-parking-checkbox"
                checked={freeParking}
                onChange={e => setFreeParking(e.target.checked)}
              />
              <label htmlFor="free-parking-checkbox" className="text-sm">Send to Free Parking</label>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Amount {mode === 'bank' ? '' : '(per player)'}</div>
              <div className="text-sm text-muted-foreground">Total: ${total.toLocaleString()}</div>
            </div>
            <input
              type="range"
              min={0}
              max={visibleSliderMax}
              step={5}
              value={amountPer}
              onChange={(e) => {
                const v = Number(e.target.value);
                setAmountPer(Math.max(0, Math.round(v / 5) * 5));
              }}
              className="w-full"
            />
            <div className="flex items-center gap-2">
              <Input
                value={rawAmount}
                onChange={(e) => {
                  setRawAmount(e.target.value);
                }}
                onBlur={() => {
                  // On blur, if user entered something, round and sync slider (slider capped at visible max)
                  if (rawAmount.trim() !== "") {
                    const rounded = Math.min(200, roundToFive(Number(rawAmount)));
                    setAmountPer(Math.min(rounded, visibleSliderMax));
                    setRawAmount(String(rounded));
                  }
                }}
                className="w-32"
                type="number"
                min={0}
                max={200}
              />
              <div className="text-sm text-muted-foreground">will round to nearest $5</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmit} 
              className={`bg-primary${(roundedLive > (currentPlayer?.balance ?? 0)) ? ' opacity-60 cursor-not-allowed' : ''}`}
              disabled={
                (mode === 'players' && selectedIds.size === 0) ||
                (roundedLive > (currentPlayer?.balance ?? 0))
              }
            >
              Pay
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
