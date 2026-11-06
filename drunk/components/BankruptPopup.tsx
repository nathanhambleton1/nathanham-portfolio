import React, { useMemo, useState, useEffect } from "react";
import { setDropdownOpen } from "./ui/dropdown-menu";
import useLockBodyScroll from "../hooks/use-lock-body-scroll";
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
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import { Check, Landmark, Skull } from "lucide-react";

type Player = { id: string; name: string; balance?: number };

// Stats were moved to a dedicated BankruptStatus popup component

export default function BankruptPopup({
  open,
  onOpenChange,
  currentPlayer,
  players = [],
  showBalances = true,
  onSubmit,
  gameId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlayer: Player | null;
  players?: Player[];
  showBalances?: boolean;
  onSubmit: (recipientId: string | null) => void;
  gameId?: string | null;
}) {
  const others = useMemo(() => {
    if (!players) return [];
    // Exclude current player and bankrupt players, sort others alphabetically
    const otherPlayers = players
      .filter((p) => p.id !== currentPlayer?.id && !(p as any).is_bankrupt)
      .sort((a, b) => {
        if (a.name && b.name) {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
    return otherPlayers;
  }, [players, currentPlayer]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  

  // Initialize popup state only when the dialog actually opens
  const prevOpenRef = React.useRef<boolean>(false);
  useEffect(() => {
    const prev = prevOpenRef.current;
    if (!prev && open) {
      setSelectedId(null);
      setConfirmOpen(false);
      // stats are shown on the dedicated BankruptStatus screen after bankruptcy
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  useLockBodyScroll(!!open);

  const currentBalance = currentPlayer?.balance ?? 0;
  const selectedPlayer = others.find((p) => p.id === selectedId);

  const BANK_SENTINEL = '__bank__';
  const isBank = selectedId === BANK_SENTINEL;

  const handleSubmit = () => {
    if (!selectedId) return;
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    onSubmit(isBank ? null : selectedId);
    setConfirmOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[1000001] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-foreground/10 bg-background/90 p-6 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.75),inset_0_1px_0_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl backdrop-saturate-150">
            <DialogHeader className="items-center sm:items-start">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20">
                <Skull className="h-5 w-5" />
              </div>
              <DialogTitle>Declare Bankruptcy</DialogTitle>
              <DialogDescription>
                You're about to declare bankruptcy and enter ghost mode. All of your money (${currentBalance.toLocaleString()}) will be transferred to a player or the bank. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Select who receives your money</div>

              <div className="max-h-[min(400px,45vh)] space-y-2 overflow-y-auto overscroll-contain">
                {/* Bank option — always available */}
                <div
                  onClick={() => setSelectedId(BANK_SENTINEL)}
                  className={`min-h-[48px] cursor-pointer rounded-xl border p-3 transition duration-200 ${
                    selectedId === BANK_SENTINEL
                      ? "border-brand/60 bg-brand/10 ring-1 ring-inset ring-brand/30"
                      : "border-foreground/10 bg-foreground/[0.03] hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] text-muted-foreground">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">Bank</div>
                      <div className="text-xs text-muted-foreground">Money is returned to the bank</div>
                    </div>
                    {selectedId === BANK_SENTINEL && (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-background">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                </div>

                {others.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`min-h-[48px] cursor-pointer rounded-xl border p-3 transition duration-200 ${
                      selectedId === p.id
                        ? "border-brand/60 bg-brand/10 ring-1 ring-inset ring-brand/30"
                        : "border-foreground/10 bg-foreground/[0.03] hover:border-brand/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        {showBalances && (
                          <div className="text-xs tabular-nums text-muted-foreground">
                            Current: ${(p.balance ?? 0).toLocaleString()}
                          </div>
                        )}
                      </div>
                      {selectedId === p.id && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-background">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Game stats moved to the BankruptStatus component (shown after declaring bankruptcy) */}

            <DialogFooter className="mt-6 w-full gap-2 sm:space-x-0">
              <Button variant="outline" className="h-11 sm:h-10" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={!selectedId}
                className="h-11 sm:h-10"
              >
                Declare Bankruptcy
              </Button>
            </DialogFooter>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will: {isBank ? `Return all $${currentBalance.toLocaleString()} to the bank` : `Transfer all $${currentBalance.toLocaleString()} to ${selectedPlayer?.name}`}, put you in ghost mode (spectator), and prevent you from participating in payments.</p>
                <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 font-semibold text-destructive ring-1 ring-inset ring-destructive/20">This action cannot be undone!</p>

              {/* Stats moved to main bankruptcy dialog */}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="w-full gap-2 sm:space-x-0">
            <AlertDialogCancel className="mt-0 h-11 sm:h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:h-10">
              Yes, I'm Bankrupt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
