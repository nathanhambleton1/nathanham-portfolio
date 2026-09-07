// Real auth-backed edit mode for the Travel editor, via Supabase Auth.
// Unlike the old "cosmetic" password, this is actually enforced server-side:
// see supabase/travel_setup.sql — writes require an `authenticated` session.
// Shares its sign-in plumbing with the other password-gated sub-apps — see
// src/lib/ownerAuth.ts.

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { signInAsOwner, signOutOwner, useOwnerSession } from "@/lib/ownerAuth";

interface EditModeValue {
  unlocked: boolean;
  loading: boolean;
  signIn: (password: string) => Promise<{ ok: boolean; error?: string }>;
  lock: () => Promise<void>;
}

const EditModeContext = createContext<EditModeValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const { session, loading } = useOwnerSession();

  const value = useMemo<EditModeValue>(
    () => ({
      unlocked: Boolean(session),
      loading,
      signIn: signInAsOwner,
      lock: signOutOwner,
    }),
    [session, loading]
  );

  return (
    <EditModeContext.Provider value={value}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode(): EditModeValue {
  const ctx = useContext(EditModeContext);
  if (!ctx)
    throw new Error("useEditMode must be used within an EditModeProvider");
  return ctx;
}
