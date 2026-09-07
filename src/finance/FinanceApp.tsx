// The /finance sub-app: NexaFi, ported from the FastAPI original.
//
// Route paths mirror the Python app's URLs one-for-one (just under /finance),
// so bookmarks, the nav, and the docs all still describe the same places.

import { Route, Routes } from "react-router-dom";
import "./finance.css";

import { FinanceAuthProvider } from "./context/FinanceAuth";
import FinanceGate from "./components/FinanceGate";
import RequireSetup from "./components/RequireSetup";

import MoneyFlow from "./pages/MoneyFlow";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Paychecks from "./pages/Paychecks";
import Spending from "./pages/Spending";
import Goals from "./pages/Goals";
import SinkingFunds from "./pages/SinkingFunds";
import Retirement from "./pages/Retirement";
import Investments from "./pages/Investments";
import Taxes from "./pages/Taxes";
import Health from "./pages/Health";
import Reports from "./pages/Reports";
import AIInsights from "./pages/AIInsights";
import Imports from "./pages/Imports";
import ImportDetail from "./pages/ImportDetail";
import NeedsReview from "./pages/NeedsReview";
import SettingsPage from "./pages/Settings";
import DataBackup from "./pages/DataBackup";
import Setup from "./pages/Setup";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

export default function FinanceApp() {
  return (
    <FinanceAuthProvider>
      <div className="finance-root">
        <FinanceGate>
          <Routes>
            {/* These two are the app's entry points, so they are where a
                fresh install gets sent to setup. */}
            <Route
              index
              element={
                <RequireSetup>
                  <MoneyFlow />
                </RequireSetup>
              }
            />
            <Route
              path="dashboard"
              element={
                <RequireSetup>
                  <Dashboard />
                </RequireSetup>
              }
            />
            <Route path="accounts" element={<Accounts />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="paychecks" element={<Paychecks />} />
            <Route path="spending" element={<Spending />} />
            <Route path="goals" element={<Goals />} />
            <Route path="sinking-funds" element={<SinkingFunds />} />
            <Route path="retirement" element={<Retirement />} />
            <Route path="investments" element={<Investments />} />
            <Route path="taxes" element={<Taxes />} />
            <Route path="health" element={<Health />} />
            <Route path="reports" element={<Reports />} />
            <Route path="ai-insights" element={<AIInsights />} />

            {/* "review" must precede ":importId" or it would be read as an id. */}
            <Route path="imports" element={<Imports />} />
            <Route path="imports/review" element={<NeedsReview />} />
            <Route path="imports/:importId" element={<ImportDetail />} />

            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/data" element={<DataBackup />} />
            <Route path="setup" element={<Setup />} />
            <Route path="future/:feature" element={<ComingSoon />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </FinanceGate>
      </div>
    </FinanceAuthProvider>
  );
}
