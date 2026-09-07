// The lock on /finance.
//
// A single password field, because sign-in only ever targets one account. What
// it submits is a real Supabase Auth sign-in, so this is not a screen you can
// skip past with devtools: without a session, every fin_* table returns zero
// rows to the anon key.

import { useState } from "react";
import type { ReactNode } from "react";
import { useFinanceAuth } from "../context/FinanceAuth";

export default function FinanceGate({ children }: { children: ReactNode }) {
  const { unlocked, loading, signIn } = useFinanceAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Waiting on the initial getSession(). Rendering the form here would flash a
  // login screen at someone who is already signed in.
  if (loading) {
    return (
      <div className="finance-gate">
        <div className="finance-gate-card">
          <p className="muted">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (unlocked) return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn(password);
    setSubmitting(false);
    if (!result.ok) {
      // Deliberately generic: naming which half was wrong would tell an
      // attacker whether the account exists.
      setError("That password didn't work.");
      setPassword("");
      return;
    }
    setPassword("");
  };

  return (
    <div className="finance-gate">
      <form className="finance-gate-card" onSubmit={submit}>
        <div className="finance-gate-mark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 11V8a5 5 0 0 1 10 0v3m-11 0h12v10H6V11Z" />
          </svg>
        </div>
        <h1>NexaFi</h1>
        <p>Enter your password to open your finances.</p>

        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="button" type="submit" disabled={submitting || !password} style={{ width: "100%", marginTop: 10 }}>
          {submitting ? "Unlocking…" : "Unlock"}
        </button>

        {error && <p className="finance-gate-error">{error}</p>}
      </form>
    </div>
  );
}
