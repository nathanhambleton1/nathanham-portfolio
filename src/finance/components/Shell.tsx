// The sidebar + topbar chrome, ported from nexafi/templates/base.html.
//
// The original split the nav into four things you touch monthly and a
// collapsible "Details" drawer holding thirteen more. The drawer is gone: with
// eight destinations left there is nothing to hide, and a nav you have to open
// to read is a nav that makes you forget what is in it.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, ShieldCheck } from "lucide-react";
import { fmtLongDay, todayISO } from "../lib/dates";
import { APP_VERSION } from "../lib/version";

interface NavItem {
  label: string;
  to: string;
  /** SVG path data for the item's icon. */
  icon: string;
  /** Match nested routes too (e.g. /finance/accounts/12). */
  end?: boolean;
}

/** The month: decide it, keep its inputs current. */
const MONTHLY: NavItem[] = [
  {
    label: "Money Flow",
    to: "",
    icon: "M12 3v6m0 0-3-3m3 3 3-3M6 12h12M6 12l3 9m9-9-3 9m-6-9v9",
    end: true,
  },
  { label: "Bills", to: "bills", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6" },
  {
    label: "Savings & Goals",
    to: "savings",
    icon: "M4 9a8 5 0 0 1 16 0v6a8 5 0 0 1-16 0V9Zm0 0v6m16-6v6M15 12h.01",
  },
  { label: "Paychecks", to: "paychecks", icon: "M3 6h18v12H3V6Zm3 3h5m-5 3h3m7 1a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" },
  {
    label: "PTO",
    to: "pto",
    icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  },
];

/** The record: what happened, and what it means. */
const RECORD: NavItem[] = [
  { label: "Accounts", to: "accounts", icon: "M3 7h18M5 7l2-3h10l2 3M5 11h14v9H5v-9Zm3 3h3" },
  { label: "Taxes", to: "taxes", icon: "M6 3h12v18H6V3Zm3 5h6M9 12h2m2 0h2m-4 4h2" },
  { label: "Reports", to: "reports", icon: "M4 20V10m5 10V4m5 16v-7m5 7V8" },
];

const BASE = "/finance";

function href(to: string): string {
  return to ? `${BASE}/${to}` : BASE;
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export interface ShellProps {
  /** Shown in the topbar and used to highlight the matching nav entry. */
  title: string;
  children: ReactNode;
  /** Rendered by pages that need a banner above their content. */
  message?: string | null;
  error?: string | null;
}

export default function Shell({ title, children, message, error }: ShellProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the route changes, otherwise it stays
  // open over the page you just navigated to.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="shell">
      <aside className={`sidebar${menuOpen ? " open" : ""}`}>
        <NavLink className="brand" to={BASE}>
          <img src="/finance/logo.svg" alt="" width={39} height={39} />
          <span>
            <span className="brand-name">NexaFi</span>
            <span className="brand-tagline">Track Today. Build Tomorrow.</span>
          </span>
        </NavLink>

        <div className="nav-label">Every month</div>
        <nav className="nav" aria-label="Primary">
          {MONTHLY.map((item) => (
            <NavLink
              key={item.to}
              to={href(item.to)}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <NavIcon path={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="nav-label">The record</div>
          {RECORD.map((item) => (
            <NavLink
              key={item.to}
              to={href(item.to)}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <NavIcon path={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="nav-divider" />
          <NavLink to={href("settings")} end className={({ isActive }) => (isActive ? "active" : "")}>
            <NavIcon path="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-3.5 2-1-2-3-2 .5-1-2.5.5-2V6l-3-1-1 1.5-3-.5-1 3 1.5 1v3L3 14l1 3 2.5-.5 2 2.5-.5 2h4" />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <div className="local-pill">
            <span className="local-dot" />
            Private database connected
          </div>
          <div>Only you can read this data.</div>
          <div>NexaFi v{APP_VERSION}</div>
        </div>
      </aside>

      <div
        className={`sidebar-backdrop${menuOpen ? " visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <div className="main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="menu-button"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Open menu"
            >
              <Menu size={20} strokeWidth={1.8} />
            </button>
            <p className="topbar-title">{title}</p>
          </div>
          <div className="topbar-meta">
            <span className="date-line">{fmtLongDay(todayISO())}</span>
            <span className="privacy-badge">
              <ShieldCheck size={14} strokeWidth={2} />
              Private
            </span>
          </div>
        </header>

        <div className="content">
          {message && <div className="alert">{message}</div>}
          {error && <div className="alert error">{error}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}
