// The finance chrome. Finance is mounted inside SiteLayout, so the site's own
// header and footer carry straight through from the home page; this only adds
// what the home page has around its content (faded grid + grain backdrop, the
// "// label" eyebrow row) and a pill sub-nav for the nine finance pages.

import { useEffect } from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtLongDay, todayISO } from "../lib/dates";
import { APP_VERSION } from "../lib/version";

interface NavItem {
  label: string;
  to: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { label: "Money Flow", to: "", end: true },
  { label: "Bills", to: "bills" },
  { label: "Savings", to: "savings" },
  { label: "Paychecks", to: "paychecks" },
  { label: "PTO", to: "pto" },
  { label: "Accounts", to: "accounts" },
  { label: "Taxes", to: "taxes" },
  { label: "Reports", to: "reports" },
  { label: "Settings", to: "settings", end: true },
];

const BASE = "/finance";

const href = (to: string) => (to ? `${BASE}/${to}` : BASE);

const pillClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
    isActive
      ? "bg-foreground/10 text-foreground shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.08)]"
      : "text-muted-foreground hover:text-foreground",
  );

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export interface ShellProps {
  /** Used for the document title. */
  title: string;
  children: ReactNode;
  /** Rendered by pages that need a banner above their content. */
  message?: string | null;
  error?: string | null;
}

export default function Shell({ title, children, message, error }: ShellProps) {
  useEffect(() => {
    document.title = `${title} · Finance`;
  }, [title]);

  return (
    <div className="shell relative isolate overflow-hidden">
      {/* Ambient background: fading grid, film grain (same as the home page). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--foreground)/0.05)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_40%_at_50%_0%,black,transparent)]" />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: NOISE }} />
      </div>

      <div className="content">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_10px_hsl(var(--brand))]" />
            Finance · {fmtLongDay(todayISO())}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.03] px-3 py-1 normal-case tracking-normal">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            Private · v{APP_VERSION}
          </span>
        </div>

        <nav
          aria-label="Finance"
          className="no-print mb-10 flex gap-1 overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-1.5 shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.06)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV.map((item) => (
            <NavLink key={item.to} to={href(item.to)} end={item.end} className={pillClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {message && <div className="alert">{message}</div>}
        {error && <div className="alert error">{error}</div>}
        {children}
      </div>
    </div>
  );
}
