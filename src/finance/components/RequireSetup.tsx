// Sends a fresh install to the setup wizard.
//
// The Python app did this as a redirect at the top of its "/" and "/dashboard"
// handlers. The condition is the same: setup is incomplete AND there is nothing
// to look at yet. The second half matters — a database restored from a backup
// has no setup_progress row but plenty of data, and marching that person
// through a wizard would be wrong.

import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useFinanceData } from "../lib/data";

export default function RequireSetup({ children }: { children: ReactNode }) {
  const { data, isPending } = useFinanceData();

  // Say nothing until the dataset settles; redirecting on an empty cache would
  // bounce every visit through setup.
  if (isPending || !data) return <>{children}</>;

  const completed = data.setupProgress?.completed ?? false;
  const hasData = data.accounts.length > 0 || data.transactions.length > 0;
  if (!completed && !hasData) return <Navigate to="/finance/setup" replace />;

  return <>{children}</>;
}
