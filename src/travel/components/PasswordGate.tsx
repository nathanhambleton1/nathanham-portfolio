// A small lock/unlock control. Locked: opens a dialog to enter the editor
// password. Unlocked: shows an "editing" pill that can re-lock.

import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEditMode } from "../context/EditMode";

export default function PasswordGate() {
  const { unlocked, unlock, lock, configured } = useEditMode();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) {
      toast.error("No editor password is configured (set VITE_TRAVEL_PASSWORD).");
      return;
    }
    if (unlock(value)) {
      toast.success("Editing unlocked 💌");
      setOpen(false);
      setValue("");
    } else {
      toast.error("That's not the password.");
      setValue("");
    }
  };

  if (unlocked) {
    return (
      <button
        type="button"
        onClick={lock}
        className="tv-btn inline-flex items-center gap-1.5 bg-[var(--tv-ink)] px-3 py-1.5 text-sm text-[var(--tv-paper)]"
        title="Lock editing"
      >
        <LockOpen size={15} /> Editing
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tv-btn inline-flex items-center gap-1.5 border-2 border-[rgba(58,47,40,0.18)] px-3 py-1.5 text-sm text-[var(--tv-ink-soft)]"
        title="Unlock editing"
      >
        <Lock size={14} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="travel-root w-[min(340px,90vw)] border-none bg-[var(--tv-card)] p-6 text-[var(--tv-ink)] shadow-xl [&>button]:text-[var(--tv-ink-soft)]">
          {/* visually hidden title for a11y */}
          <DialogHeader className="sr-only">
            <DialogTitle>Unlock editing</DialogTitle>
            <DialogDescription>Enter the editor password.</DialogDescription>
          </DialogHeader>

          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--tv-paper-2)] text-2xl">
              🔐
            </div>
            <p className="tv-handwritten text-2xl text-[var(--tv-ink)]">Welcome back</p>
            <p className="mt-0.5 text-xs text-[var(--tv-ink-soft)]">Enter the password to edit memories</p>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-2.5">
            <Input
              type="password"
              autoFocus
              placeholder="Password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 border-[rgba(58,47,40,0.2)] bg-white text-sm text-[var(--tv-ink)] placeholder:text-[var(--tv-ink-soft)] focus-visible:ring-[var(--tv-accent)]"
            />
            <Button
              type="submit"
              className="tv-btn h-9 bg-[var(--tv-accent)] text-sm text-white hover:bg-[var(--tv-accent)]/90"
            >
              Unlock ✨
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
