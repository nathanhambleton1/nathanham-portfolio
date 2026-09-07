// The sidebar + topbar chrome, ported from nexafi/templates/base.html.
//
// The nav is split the way the original was: four things you touch every month
// stay at the top level, everything else lives behind a collapsible "Details"
// group that opens automatically when you are inside it.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { fmtLongDay, todayISO } from "../lib/dates";
import { APP_VERSION } from "../lib/version";

interface NavItem {
  label: string;
  to: string;
  /** SVG path data for the item's icon, from the original template. */
  icon?: string;
  /** Match nested routes too (e.g. /finance/imports/12). */
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { label: "Money Flow", to: "", icon: "M12 3v6m0 0-3-3m3 3 3-3M6 12h12M6 12l3 9m9-9-3 9m-6-9v9", end: true },
  { label: "Import", to: "imports", icon: "M4 5h16v14H4V5Zm4 4h8m-4-3v7m-3 3h6", end: true },
  { label: "Accounts", to: "accounts", icon: "M3 7h18M5 7l2-3h10l2 3M5 11h14v9H5v-9Zm3 3h3" },
  { label: "Needs Review", to: "imports/review", icon: "M12 8v5m0 3h.01M4 20h16L12 4 4 20Z" },
];

const DETAILS: NavItem[] = [
  { label: "Dashboard", to: "dashboard" },
  { label: "Transactions", to: "transactions" },
  { label: "Paychecks", to: "paychecks" },
  { label: "Spending", to: "spending" },
  { label: "Goals", to: "goals" },
  { label: "Sinking Funds", to: "sinking-funds" },
  { label: "Retirement", to: "retirement" },
  { label: "Investments", to: "investments" },
  { label: "Taxes", to: "taxes" },
  { label: "Financial Health", to: "health" },
  { label: "Reports", to: "reports" },
  { label: "AI Insights", to: "ai-insights" },
  { label: "Data & Backup", to: "settings/data" },
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

  const inDetails = DETAILS.some((item) => location.pathname.startsWith(href(item.to)));

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
          {PRIMARY.map((item) => (
            <NavLink
              key={item.to}
              to={href(item.to)}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.icon && <NavIcon path={item.icon} />}
              <span>{item.label}</span>
            </NavLink>
          ))}

          <details className="nav-details" open={inDetails}>
            <summary>
              <NavIcon path="M4 7h16M4 12h16M4 17h10" />
              <span>Details</span>
            </summary>
            {DETAILS.map((item) => (
              <NavLink
                key={item.to}
                to={href(item.to)}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </details>

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
              ☰
            </button>
            <p className="topbar-title">{title}</p>
          </div>
          <div className="topbar-meta">
            <span className="date-line">{fmtLongDay(todayISO())}</span>
            <span className="privacy-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 11V8a5 5 0 0 1 10 0v3m-11 0h12v10H6V11Z" />
              </svg>
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
