// The /finance sub-app.
//
// Eight routes, down from twenty-two. The ones that went were either a second
// view of something already on screen elsewhere (Dashboard, Financial Health,
// Retirement, Investments), a wizard for an install that has long since
// happened (Setup), a page whose whole job was asking you to confirm what the
// importer had already worked out (Needs Review), or a separate destination
// for something that only ever happens once a month, on the way through
// closing it out (Import Center — now the import step of Money Flow itself).
//
// What is left maps to the four things this app is actually used for: deciding
// a month, keeping the bills current, knowing what the savings are for, and
// seeing what happened.

import { Route, Routes } from "react-router-dom";
import "./finance.css";

import { FinanceAuthProvider } from "./context/FinanceAuth";
import FinanceGate from "./components/FinanceGate";
import { useAutoSync } from "./lib/actions";

import MoneyFlow from "./pages/MoneyFlow";
import Bills from "./pages/Bills";
import Savings from "./pages/Savings";
import Accounts from "./pages/Accounts";
import Paychecks from "./pages/Paychecks";
import Taxes from "./pages/Taxes";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

/**
 * Runs the once-per-session payroll and bill backfill regardless of which
 * finance page loads first, mirroring the old middleware's "every GET" reach.
 */
function AutoSync() {
  useAutoSync();
  return null;
}

export default function FinanceApp() {
  return (
    <FinanceAuthProvider>
      <div className="finance-root">
        <FinanceGate>
          <AutoSync />
          <Routes>
            <Route index element={<MoneyFlow />} />
            <Route path="bills" element={<Bills />} />
            <Route path="savings" element={<Savings />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="paychecks" element={<Paychecks />} />
            <Route path="taxes" element={<Taxes />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </FinanceGate>
      </div>
    </FinanceAuthProvider>
  );
}
