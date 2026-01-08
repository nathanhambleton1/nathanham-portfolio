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

export default function BankruptPopup({
  open,
  onOpenChange,
  currentPlayer,
  players = [],
  showBalances = true,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPlayer: Player | null;
  players?: Player[];
  showBalances?: boolean;
  onSubmit: (recipientId: string) => void;
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
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (open) setDropdownOpen(null);
  }, [open]);

  useLockBodyScroll(!!open);

  const currentBalance = currentPlayer?.balance ?? 0;
  const selectedPlayer = others.find((p) => p.id === selectedId);

  const handleSubmit = () => {
    if (!selectedId) return;
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    onSubmit(selectedId);
    setConfirmOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 border bg-background p-6 shadow-lg sm:rounded-lg md:w-full">
            <DialogHeader>
              <DialogTitle>Declare Bankruptcy</DialogTitle>
              <DialogDescription>
                You're about to declare bankruptcy and enter ghost mode. All of your money (${currentBalance.toLocaleString()}) will be transferred to another player. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-3">
              <div className="text-sm font-medium mb-2">Select a player to receive your money:</div>
              
              {others.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No other players available
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                            <svg
                              className="h-3 w-3 text-primary-foreground"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="3"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={!selectedId}
                className="ring-2 ring-red-500/10 shadow-sm shadow-red-500/20"
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
              <p>This will: Transfer all ${currentBalance.toLocaleString()} to {selectedPlayer?.name}, put you in ghost mode (spectator), and prevent you from participating in payments.</p>
                <p className="font-semibold text-destructive mt-4 text-white">This action cannot be undone!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} className="bg-destructive hover:bg-destructive/90 text-white">
                Yes, I'm Bankrupt
              </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
