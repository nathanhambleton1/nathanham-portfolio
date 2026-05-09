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
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 mx-4 w-full max-w-md -translate-x-1/2 -translate-y-1/2 border bg-background p-6 shadow-lg sm:rounded-lg md:w-full">
            <DialogHeader>
              <DialogTitle>Declare Bankruptcy</DialogTitle>
              <DialogDescription>
                You're about to declare bankruptcy and enter ghost mode. All of your money (${currentBalance.toLocaleString()}) will be transferred to a player or the bank. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-3">
              <div className="text-sm font-medium mb-2">Select who receives your money:</div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {/* Bank option — always available */}
                <div
                  onClick={() => setSelectedId(BANK_SENTINEL)}
                  className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedId === BANK_SENTINEL
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Bank</div>
                      <div className="text-sm text-muted-foreground">Money is returned to the bank</div>
                    </div>
                    {selectedId === BANK_SENTINEL && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <svg className="h-3 w-3 text-primary-foreground" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {others.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedId === p.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {showBalances && (
                          <div className="text-sm text-muted-foreground">
                            Current: ${(p.balance ?? 0).toLocaleString()}
                          </div>
                        )}
                      </div>
                      {selectedId === p.id && (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <svg className="h-3 w-3 text-primary-foreground" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Game stats moved to the BankruptStatus component (shown after declaring bankruptcy) */}

            <DialogFooter className="mt-6 flex gap-3 w-full justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={!selectedId}
                className="px-4 py-2 ring-2 ring-red-500/10 shadow-sm shadow-red-500/20"
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
                <p className="font-semibold text-destructive mt-4 text-white">This action cannot be undone!</p>

              {/* Stats moved to main bankruptcy dialog */}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-3 w-full justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-white">
              Yes, I'm Bankrupt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
