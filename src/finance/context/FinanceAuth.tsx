// Auth state for /finance.
//
// The finance pages render nothing until there is a real Supabase session — see
// FinanceGate. This is a hard gate, not a cosmetic one: every fin_* table
// revokes `anon` and checks `owner = auth.uid()`, so an unauthenticated visitor
// who bypassed the UI entirely would still read zero rows.

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { signInAsOwner, signOutOwner, useOwnerSession } from "@/lib/ownerAuth";

interface FinanceAuthValue {
  session: Session | null;
  unlocked: boolean;
  loading: boolean;
  signIn: (password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const FinanceAuthContext = createContext<FinanceAuthValue | null>(null);

export function FinanceAuthProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useOwnerSession();

  const value = useMemo<FinanceAuthValue>(
    () => ({
      session,
      unlocked: Boolean(session),
      loading,
      signIn: signInAsOwner,
      signOut: signOutOwner,
    }),
    [session, loading],
  );

  return <FinanceAuthContext.Provider value={value}>{children}</FinanceAuthContext.Provider>;
}

export function useFinanceAuth(): FinanceAuthValue {
  const ctx = useContext(FinanceAuthContext);
  if (!ctx) throw new Error("useFinanceAuth must be used within a FinanceAuthProvider");
  return ctx;
}
