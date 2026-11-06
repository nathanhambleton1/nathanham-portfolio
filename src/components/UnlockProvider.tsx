// Password prompt for locked sites (see `locked` in src/lib/sites.ts).
//
// Lives in SiteLayout so the home page cards, header and footer can all ask
// for the password *before* navigating into a locked site. Signing in here is
// the same Supabase Auth sign-in the finance gate uses, so once it succeeds
// the destination opens straight away. The gate inside each locked site stays
// as the real guard for anyone who lands on the URL directly.

import { createContext, useCallback, useContext, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { signInAsOwner, useOwnerSession } from "@/lib/ownerAuth";
import { SITES } from "@/lib/sites";

interface UnlockValue {
  /**
   * Click handler for a link to `path`. If the site is locked and there is no
   * session, it cancels the navigation and opens the password prompt instead.
   */
  guard: (path: string) => (event: MouseEvent) => void;
}

const UnlockContext = createContext<UnlockValue | null>(null);

const isLocked = (path: string) => SITES.some((s) => s.locked && path.startsWith(s.path));

export function UnlockProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { session } = useOwnerSession();
  const [target, setTarget] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const guard = useCallback(
    (path: string) => (event: MouseEvent) => {
      if (session || !isLocked(path)) return;
      event.preventDefault();
      setError(null);
      setPassword("");
      setTarget(path);
    },
    [session],
  );

  const close = () => {
    setTarget(null);
    setPassword("");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) return;
    setSubmitting(true);
    setError(null);
    const result = await signInAsOwner(password);
    setSubmitting(false);
    if (!result.ok) {
      setError("That password didn't work.");
      setPassword("");
      return;
    }
    const destination = target;
    close();
    navigate(destination);
  };

  const site = target ? SITES.find((s) => target.startsWith(s.path)) : undefined;

  return (
    <UnlockContext.Provider value={{ guard }}>
      {children}
      <Dialog open={target !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm rounded-2xl border-foreground/10 bg-background/80 shadow-[0_10px_40px_-12px_rgb(0_0_0/0.55),inset_0_1px_0_0_hsl(var(--foreground)/0.06)] backdrop-blur-xl">
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader className="items-center text-center sm:text-center">
              <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
                <Lock className="h-5 w-5" />
              </span>
              <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
                {site?.name ?? "Locked"}
              </DialogTitle>
              <DialogDescription>Enter the password to continue.</DialogDescription>
            </DialogHeader>

            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Password"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              disabled={submitting || !password}
              className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Unlocking…" : "Unlock"}
            </button>
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
          </form>
        </DialogContent>
      </Dialog>
    </UnlockContext.Provider>
  );
}

export function useUnlock(): UnlockValue {
  const ctx = useContext(UnlockContext);
  // Outside the provider (e.g. a standalone app), links just navigate normally.
  return ctx ?? { guard: () => () => {} };
}
