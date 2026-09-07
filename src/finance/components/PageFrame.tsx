// Wraps a page in the shell and handles the three states every page shares:
// loading the dataset, failing to load it, and having it.
//
// Pages receive the loaded FinanceData as a plain argument, so their bodies
// never have to deal with `data | undefined` and read much like the Jinja
// templates they replace, where the route handler had already fetched everything.

import type { ReactNode } from "react";
import Shell from "./Shell";
import { useFinanceData, type FinanceData } from "../lib/data";

export interface PageFrameProps {
  title: string;
  children: (data: FinanceData) => ReactNode;
  message?: string | null;
  error?: string | null;
}

export default function PageFrame({ title, children, message, error }: PageFrameProps) {
  const { data, isPending, error: loadError, refetch } = useFinanceData();

  if (isPending) {
    return (
      <Shell title={title}>
        <p className="empty">Loading your finances…</p>
      </Shell>
    );
  }

  if (loadError || !data) {
    return (
      <Shell title={title}>
        <div className="alert error">
          Couldn&rsquo;t load your data: {loadError instanceof Error ? loadError.message : "unknown error"}
        </div>
        <button className="button secondary" type="button" onClick={() => void refetch()}>
          Try again
        </button>
      </Shell>
    );
  }

  return (
    <Shell title={title} message={message} error={error}>
      {children(data)}
    </Shell>
  );
}
