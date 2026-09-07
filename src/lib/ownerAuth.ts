// Shared owner-session helpers for the password-gated sub-apps.
//
// Sign-in only ever targets one account, so every gate in the site can stay a
// single password field with no email box. Supabase Auth — not any constant in
// this bundle — is what actually enforces access. Two things make that true:
//
//   1. Public sign-up must stay DISABLED in the Supabase dashboard, so nobody
//      can create another account that would also satisfy an `authenticated`
//      RLS policy.
//   2. The finance tables go further and check `owner = auth.uid()`, so even a
//      second account would see zero rows.
//
// Nothing secret lives here: the email is public information and the password
// is never stored in the source.

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const OWNER_EMAIL = "nhambleton03@gmail.com";

export interface OwnerSession {
  session: Session | null;
  /** True until the initial getSession() settles — gates should not flash. */
  loading: boolean;
}

/** Track the current Supabase session, kept in sync with auth state changes. */
export function useOwnerSession(): OwnerSession {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export async function signInAsOwner(password: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email: OWNER_EMAIL, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOutOwner(): Promise<void> {
  await supabase.auth.signOut();
}
