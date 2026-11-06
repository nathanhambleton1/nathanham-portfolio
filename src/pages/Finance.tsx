// Route entry for the password-gated finance sub-app.
//
// Loaded lazily on purpose. The finance app is by far the largest thing in this
// project (Recharts, decimal.js, zod, and 22 pages of its own), and it is behind
// a password that almost every visitor will never enter. Splitting it out keeps
// it off the critical path for the portfolio itself, and the person who does
// sign in pays the cost once.

import { Suspense, lazy } from "react";

const FinanceApp = lazy(() => import("@/finance/FinanceApp"));

export default function Finance() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">Loading…</div>
      }
    >
      <FinanceApp />
    </Suspense>
  );
}
