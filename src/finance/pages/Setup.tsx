// First-run setup, eight steps plus a completion screen.
// Ported from templates/setup.html.
//
// Rendered outside the app shell, exactly as the original was: setup is the one
// place with no sidebar, because there is nothing to navigate to yet.

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useFinanceData } from "../lib/data";
import { useAction } from "../lib/actions";
import { Advisory, Button, Field } from "../components/ui";
import {
  completeSetup, ensureSetupProgress, saveGoal, saveOpeningAccount, saveProgress,
  saveRecurringExpense, saveSetting, saveSinkingFund,
} from "../lib/setup";
import { currentAccountBalances, liquidCash, netWorth, requiredSinkingContribution } from "../lib/finance";
import { monthlyEquivalent } from "../lib/allocation";
import { Decimal, ZERO, dec, fmtMoney, money, sum as sumMoney } from "../lib/money";
import { todayISO } from "../lib/dates";
import { APP_VERSION } from "../lib/version";
import { ACCOUNT_TYPE_LABELS, type AccountType } from "../lib/types";
import type { FinanceData } from "../lib/data";

const STEP_TITLES = [
  "Profile",
  "Employment & income",
  "Payroll & retirement",
  "Accounts & balances",
  "Monthly obligations",
  "Goals & sinking funds",
  "Historical data",
  "Review & reconcile",
];

const SELECTABLE_TYPES: AccountType[] = [
  "checking", "savings", "credit_card", "roth_401k", "traditional_401k",
  "roth_ira", "traditional_ira", "taxable_brokerage", "other_asset", "other_liability",
];

const FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual", "custom"];

/** The obligations the wizard offers, with the original's suggested amounts. */
const OBLIGATIONS: [name: string, key: string, amount: string, variable: boolean][] = [
  ["Rent", "rent", "1755", false],
  ["Electricity", "electricity", "90", true],
  ["Home internet", "internet", "35", false],
  ["ChatGPT", "chatgpt", "20", false],
  ["Spotify", "spotify", "14", false],
  ["iCloud", "icloud", "3", false],
  ["Streaming", "streaming", "3", false],
];

/** Goals offered at step 6: title, key, goal type, target, monthly. */
const GOAL_SPECS: [title: string, key: string, kind: string, target: string, monthly: string][] = [
  ["Emergency Fund", "emergency", "emergency", "10000", "0"],
  ["Travel", "travel", "travel", "3000", "250"],
  ["Car Tax + Inspection", "car", "sinking", "250", "20.83"],
  ["Future Home", "house", "house", "80000", "200"],
  ["Roth IRA", "ira", "retirement", "3600", "300"],
  ["Taxable Investments", "brokerage", "taxable", "3600", "300"],
];

const HISTORY_OPTIONS: [value: string, label: string, detail: string][] = [
  ["start_today", "Start Today", "Use opening balances only."],
  ["this_month", "Import This Month", "Add this month’s activity."],
  ["3_months", "Previous 3 Months", "Build a recent baseline."],
  ["6_months", "Previous 6 Months", "Add half a year of context."],
  ["12_months", "Previous 12 Months", "Create a full-year history."],
  ["custom", "Custom", "Choose your own date range in Import Center."],
];

/** Goal names the wizard manages, so step 8 can summarise them. */
const GOAL_NAMES = {
  emergency: "Emergency Fund",
  travel: "Travel",
  house: "Future House / Down Payment",
  ira: "Roth IRA Annual Target",
  brokerage: "Taxable Investing Annual Target",
  car: "Car Tax + Inspection",
};

type Values = Record<string, string>;

export default function Setup() {
  const { data, isPending } = useFinanceData();
  const action = useAction();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [values, setValues] = useState<Values>({});
  const [newAccount, setNewAccount] = useState({
    name: "", account_type: "checking" as AccountType, opening_balance: "0",
    institution: "", last_four: "", apy: "2.8", statement_balance: "0",
    cashback_rate: "2", closing_day: "", due_day: "", payment_account_id: "",
    autopay_enabled: false,
  });

  if (isPending || !data) {
    return (
      <div className="finance-setup-body">
        <main className="setup-shell">
          <p className="empty">Loading setup…</p>
        </main>
      </div>
    );
  }

  const progress = data.setupProgress;
  const requestedStep = Number(params.get("step") ?? progress?.current_step ?? 1);
  const step = params.get("complete") === "1" ? 9 : Math.min(8, Math.max(1, requestedStep || 1));

  const get = (key: string, fallback = "") =>
    values[key] ?? data.settings[key] ?? fallback;
  const set = (key: string, value: string) => setValues((state) => ({ ...state, [key]: value }));

  const goToStep = (next: number) => {
    setParams(next >= 9 ? { complete: "1" } : { step: String(next) });
  };

  const balances = currentAccountBalances(data);
  const accounts = data.accounts.filter((account) => account.is_active);
  const savingsAccounts = accounts.filter((account) => account.account_type === "savings");
  const savingsTotal = sumMoney(savingsAccounts.map((account) => balances.get(account.id) ?? ZERO));
  const goalsByName = new Map(data.goals.map((goal) => [goal.name, goal]));
  const fundsByName = new Map(data.sinkingFunds.map((fund) => [fund.name, fund]));
  const expensesByName = new Map(data.recurringExpenses.map((row) => [row.name, row]));

  const allocationTotal = sumMoney([
    goalsByName.get(GOAL_NAMES.emergency)?.current_amount ?? "0",
    goalsByName.get(GOAL_NAMES.travel)?.current_amount ?? "0",
    goalsByName.get(GOAL_NAMES.house)?.current_amount ?? "0",
    fundsByName.get(GOAL_NAMES.car)?.current_amount ?? "0",
  ]);

  const annualSalary = money(
    dec(get("gross_pay_per_period", "0")).times(Number(get("pay_periods_per_year", "26")) || 26),
  );

  const back = () => {
    if (step <= 1) return;
    void action.run(async (live) => {
      await saveProgress(live, { current_step: Math.max(1, step - 1) });
      goToStep(step - 1);
    });
  };

  /** Persist the current step, then advance. */
  const submitStep = (event: React.FormEvent) => {
    event.preventDefault();
    void action.run(async (live) => {
      await ensureSetupProgress(live);
      const setupDay = live.setupProgress?.setup_date ?? todayISO();
      await persistStep(live, step, get, setupDay, savingsTotal);

      if (step === 8) {
        await completeSetup(live);
        goToStep(9);
        return "Setup complete.";
      }

      await saveProgress(live, {
        current_step: Math.min(8, step + 1),
        setup_date: live.setupProgress?.setup_date ?? todayISO(),
      });
      setValues({});
      goToStep(step + 1);
    });
  };

  const addAccount = (event: React.FormEvent) => {
    event.preventDefault();
    void action.run(async (live) => {
      if (newAccount.name.trim().length < 2) {
        throw new Error("Account name must contain at least two characters.");
      }
      const lastFour = newAccount.last_four.trim();
      if (lastFour && !/^\d{4}$/.test(lastFour)) {
        throw new Error("Last four digits must be exactly four numbers.");
      }
      const isCredit = newAccount.account_type === "credit_card";
      const isSavings = newAccount.account_type === "savings";

      await saveOpeningAccount(live, {
        name: newAccount.name.trim(),
        accountType: newAccount.account_type,
        openingBalance: money(newAccount.opening_balance || "0"),
        effectiveDate: live.setupProgress?.setup_date ?? todayISO(),
        institution: newAccount.institution.trim() || null,
        lastFour: lastFour || null,
        apy: isSavings ? dec(newAccount.apy || "0") : ZERO,
        statementBalance: isCredit ? money(newAccount.statement_balance || "0") : ZERO,
        cashbackRate: isCredit ? dec(newAccount.cashback_rate || "0") : ZERO,
        closingDay: isCredit && newAccount.closing_day ? Number(newAccount.closing_day) : null,
        dueDay: isCredit && newAccount.due_day ? Number(newAccount.due_day) : null,
        autopayEnabled: isCredit ? newAccount.autopay_enabled : false,
        paymentAccountId:
          isCredit && newAccount.payment_account_id ? Number(newAccount.payment_account_id) : null,
      });

      setNewAccount({ ...newAccount, name: "", opening_balance: "0", institution: "", last_four: "" });
      return "Account added.";
    });
  };

  const stepBody = () => {
    switch (step) {
      case 1:
        return (
          <section className="setup-card">
            <p className="eyebrow">Welcome to NexaFi</p>
            <h1>Your finances, in one private place.</h1>
            <p className="setup-lead">
              A few planning details will personalize the app. It never asks for Social Security
              numbers, passwords, or full account numbers.
            </p>
            <form id="step-form" onSubmit={submitStep}>
              <div className="form-grid">
                <Field label="Preferred display name">
                  <input
                    value={get("display_name")}
                    onChange={(event) => set("display_name", event.target.value)}
                    autoComplete="name"
                    required
                  />
                </Field>
                <Field label="Date of birth (optional)">
                  <input
                    type="date"
                    value={get("date_of_birth")}
                    onChange={(event) => set("date_of_birth", event.target.value)}
                  />
                </Field>
                <Field label="Current age">
                  <input
                    type="number"
                    min="16"
                    max="100"
                    value={get("current_age", "30")}
                    onChange={(event) => set("current_age", event.target.value)}
                    required
                  />
                </Field>
                <Field label="State of residence">
                  <input
                    value={get("state_of_residence", "Virginia")}
                    onChange={(event) => set("state_of_residence", event.target.value)}
                    required
                  />
                </Field>
                <Field label="Filing status" hint="The tax engine currently supports single filing.">
                  <select value="single" onChange={() => undefined}>
                    <option value="single">Single</option>
                  </select>
                </Field>
                <Field label="Currency">
                  <select value="USD" onChange={() => undefined}>
                    <option value="USD">USD — US Dollar</option>
                  </select>
                </Field>
                <Field label="Desired retirement age">
                  <input
                    type="number"
                    min="17"
                    max="100"
                    value={get("retirement_age", "65")}
                    onChange={(event) => set("retirement_age", event.target.value)}
                    required
                  />
                </Field>
              </div>
            </form>
          </section>
        );

      case 2:
        return (
          <section className="setup-card">
            <p className="eyebrow">Income baseline</p>
            <h1>Employment &amp; income</h1>
            <p className="setup-lead">
              Enter an editable baseline. Annualized salary updates from gross pay and pay frequency.
            </p>
            <form id="step-form" onSubmit={submitStep}>
              <div className="form-grid">
                <Field label="Employer">
                  <input
                    value={get("employer_name")}
                    onChange={(event) => set("employer_name", event.target.value)}
                    required
                  />
                </Field>
                <Field label="Job">
                  <input value={get("job_title")} onChange={(event) => set("job_title", event.target.value)} />
                </Field>
                <Field label="Work location">
                  <input
                    value={get("work_location")}
                    onChange={(event) => set("work_location", event.target.value)}
                  />
                </Field>
                <Field label="Pay frequency">
                  <select
                    value={get("pay_frequency", "biweekly")}
                    onChange={(event) => set("pay_frequency", event.target.value)}
                  >
                    <option value="biweekly">Biweekly</option>
                    <option value="weekly">Weekly</option>
                    <option value="semimonthly">Twice monthly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </Field>
                <Field
                  label="First paycheck date"
                  hint="The app auto-logs a paycheck every 14 days from this date whenever you open Finance."
                >
                  <input
                    type="date"
                    value={get("paycheck_schedule_start")}
                    onChange={(event) => set("paycheck_schedule_start", event.target.value)}
                    required
                  />
                </Field>
                <Field label="Pay periods per year">
                  <input
                    type="number"
                    min="1"
                    max="366"
                    value={get("pay_periods_per_year", "26")}
                    onChange={(event) => set("pay_periods_per_year", event.target.value)}
                  />
                </Field>
                <Field label="Regular hours per period">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("regular_hours_per_period", "80")}
                    onChange={(event) => set("regular_hours_per_period", event.target.value)}
                  />
                </Field>
                <Field label="Gross pay per period">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("gross_pay_per_period", "0")}
                    onChange={(event) => set("gross_pay_per_period", event.target.value)}
                  />
                </Field>
                <Field label="Current annualized salary">
                  <div className="readout">{fmtMoney(annualSalary)}</div>
                </Field>
                <label className="checkbox field full">
                  <input
                    type="checkbox"
                    checked={get("income_started_part_year") === "true"}
                    onChange={(event) =>
                      set("income_started_part_year", event.target.checked ? "true" : "false")
                    }
                  />
                  Income started partway through this tax year
                </label>
                <Field label="Prior-year income (optional)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("prior_year_income", "0")}
                    onChange={(event) => set("prior_year_income", event.target.value)}
                  />
                </Field>
                <Field label="Current-year YTD income">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("prior_income", "0")}
                    onChange={(event) => set("prior_income", event.target.value)}
                  />
                </Field>
                <Field label="YTD federal withholding">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("prior_federal_withholding", "0")}
                    onChange={(event) => set("prior_federal_withholding", event.target.value)}
                  />
                </Field>
                <Field label="YTD state withholding">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("prior_virginia_withholding", "0")}
                    onChange={(event) => set("prior_virginia_withholding", event.target.value)}
                  />
                </Field>
              </div>
            </form>
          </section>
        );

      case 3:
        return (
          <section className="setup-card">
            <p className="eyebrow">Long-term plan</p>
            <h1>Payroll &amp; retirement</h1>
            <p className="setup-lead">
              Employee contributions and employer matching stay separate in every forecast. Return
              assumptions are projections, not promises.
            </p>
            <form id="step-form" onSubmit={submitStep}>
              <div className="form-grid three">
                <Field label="401(k) type">
                  <select
                    value={get("retirement_contribution_type", "roth")}
                    onChange={(event) => set("retirement_contribution_type", event.target.value)}
                  >
                    <option value="roth">Roth</option>
                    <option value="traditional">Traditional</option>
                  </select>
                </Field>
                <Field label="Employee contribution %">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={get("roth_401k_percent", "8")}
                    onChange={(event) => set("roth_401k_percent", event.target.value)}
                  />
                </Field>
                <Field label="Employer match %">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={get("employer_match_percent", "8")}
                    onChange={(event) => set("employer_match_percent", event.target.value)}
                  />
                </Field>
                <Field label="Current 401(k) balance">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("balance_401k", "0")}
                    onChange={(event) => set("balance_401k", event.target.value)}
                  />
                </Field>
                <Field label="Current Roth IRA balance">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("balance_ira", "0")}
                    onChange={(event) => set("balance_ira", event.target.value)}
                  />
                </Field>
                <Field label="Current taxable brokerage">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("balance_brokerage", "0")}
                    onChange={(event) => set("balance_brokerage", event.target.value)}
                  />
                </Field>
                <Field label="Roth IRA monthly target">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("ira_user_monthly_target", "300")}
                    onChange={(event) => set("ira_user_monthly_target", event.target.value)}
                  />
                </Field>
                <Field label="Taxable investing monthly target">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("brokerage_user_monthly_target", "300")}
                    onChange={(event) => set("brokerage_user_monthly_target", event.target.value)}
                  />
                </Field>
                <Field
                  label="Expected long-term return %"
                  hint="Conservative 5% and aggressive 9% scenarios are also shown."
                >
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={get("expected_return_percent", "7")}
                    onChange={(event) => set("expected_return_percent", event.target.value)}
                  />
                </Field>
              </div>
            </form>
          </section>
        );

      case 4:
        return (
          <section className="setup-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Opening balances</p>
                <h1>Accounts &amp; balances</h1>
                <p className="setup-lead">
                  These become dated opening balances — not fake income. Only optional last four
                  digits are stored.
                </p>
              </div>
              <span className="tag gold">Net worth {fmtMoney(netWorth(data))}</span>
            </div>

            <form onSubmit={addAccount}>
              <div className="form-grid three">
                <Field label="Account name">
                  <input
                    placeholder="Primary Checking"
                    value={newAccount.name}
                    onChange={(event) => setNewAccount({ ...newAccount, name: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Type">
                  <select
                    value={newAccount.account_type}
                    onChange={(event) =>
                      setNewAccount({ ...newAccount, account_type: event.target.value as AccountType })
                    }
                    required
                  >
                    {SELECTABLE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ACCOUNT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Current / opening balance">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newAccount.opening_balance}
                    onChange={(event) =>
                      setNewAccount({ ...newAccount, opening_balance: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field label="Institution (optional)">
                  <input
                    maxLength={100}
                    value={newAccount.institution}
                    onChange={(event) => setNewAccount({ ...newAccount, institution: event.target.value })}
                  />
                </Field>
                <Field label="Last four digits (optional)">
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    pattern="[0-9]{4}"
                    value={newAccount.last_four}
                    onChange={(event) => setNewAccount({ ...newAccount, last_four: event.target.value })}
                  />
                </Field>
                {newAccount.account_type === "savings" && (
                  <Field label="Current APY %">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newAccount.apy}
                      onChange={(event) => setNewAccount({ ...newAccount, apy: event.target.value })}
                    />
                  </Field>
                )}
              </div>

              {newAccount.account_type === "credit_card" && (
                <div className="form-grid three" style={{ marginTop: 14 }}>
                  <Field label="Statement balance">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newAccount.statement_balance}
                      onChange={(event) =>
                        setNewAccount({ ...newAccount, statement_balance: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Cashback %">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={newAccount.cashback_rate}
                      onChange={(event) =>
                        setNewAccount({ ...newAccount, cashback_rate: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Statement closing day">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={newAccount.closing_day}
                      onChange={(event) =>
                        setNewAccount({ ...newAccount, closing_day: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Payment due day">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={newAccount.due_day}
                      onChange={(event) => setNewAccount({ ...newAccount, due_day: event.target.value })}
                    />
                  </Field>
                  <Field label="Typical payment account">
                    <select
                      value={newAccount.payment_account_id}
                      onChange={(event) =>
                        setNewAccount({ ...newAccount, payment_account_id: event.target.value })
                      }
                    >
                      <option value="">Not selected</option>
                      {accounts
                        .filter((account) => account.account_type === "checking")
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={newAccount.autopay_enabled}
                      onChange={(event) =>
                        setNewAccount({ ...newAccount, autopay_enabled: event.target.checked })
                      }
                    />
                    Autopay enabled
                  </label>
                </div>
              )}

              <div className="form-actions">
                <Button variant="secondary" type="submit" disabled={action.busy}>
                  + Add account
                </Button>
              </div>
            </form>

            <div className="account-setup-list">
              {accounts.length === 0 ? (
                <p className="empty">No accounts yet. Add at least one to make net worth useful.</p>
              ) : (
                accounts.map((account) => (
                  <div key={account.id}>
                    <span>
                      <strong>{account.name}</strong>
                      <small>
                        {ACCOUNT_TYPE_LABELS[account.account_type]}
                        {account.institution ? ` · ${account.institution}` : ""}
                        {account.last_four ? ` · •••• ${account.last_four}` : ""}
                      </small>
                    </span>
                    <strong>{fmtMoney(balances.get(account.id) ?? 0)}</strong>
                  </div>
                ))
              )}
            </div>

            <form id="step-form" className="bucket-panel" onSubmit={submitStep}>
              <h2>Allocate actual savings</h2>
              <p>
                Virtual buckets earmark your savings; they do not add cash. Allocated{" "}
                {fmtMoney(allocationTotal)} of {fmtMoney(savingsTotal)} actual savings.
              </p>
              <div className="form-grid">
                <Field label="Emergency Fund">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("emergency_current", String(goalsByName.get(GOAL_NAMES.emergency)?.current_amount ?? "0"))}
                    onChange={(event) => set("emergency_current", event.target.value)}
                  />
                </Field>
                <Field label="Travel">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("travel_current", String(goalsByName.get(GOAL_NAMES.travel)?.current_amount ?? "0"))}
                    onChange={(event) => set("travel_current", event.target.value)}
                  />
                </Field>
                <Field label="Car">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("car_current", String(fundsByName.get(GOAL_NAMES.car)?.current_amount ?? "0"))}
                    onChange={(event) => set("car_current", event.target.value)}
                  />
                </Field>
                <Field label="House">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={get("house_current", String(goalsByName.get(GOAL_NAMES.house)?.current_amount ?? "0"))}
                    onChange={(event) => set("house_current", event.target.value)}
                  />
                </Field>
              </div>
            </form>
          </section>
        );

      case 5:
        return (
          <section className="setup-card">
            <p className="eyebrow">Cash-flow commitments</p>
            <h1>Monthly obligations</h1>
            <p className="setup-lead">
              Amounts and frequencies stay explicit. Annual obligations remain annual and can be
              funded with sinking funds.
            </p>
            <form id="step-form" onSubmit={submitStep}>
              <div className="obligation-editor">
                {OBLIGATIONS.map(([name, key, amount]) => {
                  const existing = expensesByName.get(name);
                  const enabledKey = `${key}_enabled`;
                  const enabled = get(enabledKey, !existing || existing.is_active ? "true" : "false");
                  return (
                    <div className="obligation-edit" key={key}>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={enabled === "true"}
                          onChange={(event) => set(enabledKey, event.target.checked ? "true" : "false")}
                        />
                        <strong>{name}</strong>
                      </label>
                      <input
                        aria-label={`${name} amount`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={get(`${key}_amount`, String(existing?.amount ?? amount))}
                        onChange={(event) => set(`${key}_amount`, event.target.value)}
                      />
                      <select
                        aria-label={`${name} frequency`}
                        value={get(`${key}_frequency`, existing?.frequency ?? "monthly")}
                        onChange={(event) => set(`${key}_frequency`, event.target.value)}
                      >
                        {FREQUENCIES.map((frequency) => (
                          <option key={frequency} value={frequency}>
                            {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </form>
          </section>
        );

      case 6:
        return (
          <section className="setup-card">
            <p className="eyebrow">Your priorities</p>
            <h1>Goals &amp; sinking funds</h1>
            <p className="setup-lead">
              The app&rsquo;s recommendation stays separate from your target. Disable anything that
              does not fit your plan.
            </p>
            <form id="step-form" onSubmit={submitStep}>
              <div className="goal-setup-grid">
                {GOAL_SPECS.map(([title, key, , target, monthly]) => (
                  <article key={key}>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={get(`${key}_enabled`, "true") === "true"}
                        onChange={(event) =>
                          set(`${key}_enabled`, event.target.checked ? "true" : "false")
                        }
                      />
                      <strong>{title}</strong>
                    </label>
                    <div className="recommendation-line">
                      <span>Recommendation</span>
                      <strong>
                        ${target} target · ${monthly}/mo
                      </strong>
                    </div>
                    <div className="form-grid">
                      <Field label="Your target">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={get(`${key}_target`, target)}
                          onChange={(event) => set(`${key}_target`, event.target.value)}
                        />
                      </Field>
                      {key !== "car" && (
                        <Field label="Your monthly amount">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={get(`${key}_monthly`, monthly)}
                            onChange={(event) => set(`${key}_monthly`, event.target.value)}
                          />
                        </Field>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </form>
          </section>
        );

      case 7:
        return (
          <section className="setup-card">
            <p className="eyebrow">Optional history</p>
            <h1>Would you like to import previous financial history?</h1>
            <p className="setup-lead">
              The app works correctly from today&rsquo;s opening balances. Historical data is
              optional and always enters through the review-first Import Center.
            </p>
            <form id="step-form" onSubmit={submitStep}>
              <div className="choice-grid">
                {HISTORY_OPTIONS.map(([value, label, detail]) => (
                  <label className="choice-card" key={value}>
                    <input
                      type="radio"
                      name="history_option"
                      value={value}
                      checked={get("history_option", progress?.history_option ?? "start_today") === value}
                      onChange={() => set("history_option", value)}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{detail}</small>
                    </span>
                  </label>
                ))}
              </div>
            </form>
          </section>
        );

      case 8: {
        const summary = buildSummary(data, get, annualSalary);
        return (
          <section className="setup-card">
            <p className="eyebrow">Initial reconciliation</p>
            <h1>Review your financial position</h1>
            <p className="setup-lead">
              Confirm these reported balances and planning assumptions. Go back to edit anything
              before setup is marked complete.
            </p>
            <div className="review-sections">
              <section>
                <h2>Income</h2>
                <div>
                  <span>Annualized salary</span>
                  <strong>{fmtMoney(annualSalary)}</strong>
                </div>
                <div>
                  <span>Pay frequency</span>
                  <strong>{get("pay_frequency", "Biweekly")}</strong>
                </div>
                <div>
                  <span>Expected net paycheck</span>
                  <strong>{fmtMoney(summary.expectedNet)} estimate</strong>
                </div>
              </section>

              <section>
                <h2>Accounts</h2>
                {accounts.map((account) => (
                  <div key={account.id}>
                    <span>
                      {account.name} <small>{ACCOUNT_TYPE_LABELS[account.account_type]}</small>
                    </span>
                    <strong>
                      {account.is_liability ? "−" : ""}
                      {fmtMoney(balances.get(account.id) ?? 0)}
                    </strong>
                  </div>
                ))}
                <div className="review-total">
                  <span>Total net worth</span>
                  <strong>{fmtMoney(netWorth(data))}</strong>
                </div>
              </section>

              <section>
                <h2>Cash &amp; obligations</h2>
                <div>
                  <span>Liquid cash</span>
                  <strong>{fmtMoney(liquidCash(data))}</strong>
                </div>
                <div>
                  <span>Actual savings balance</span>
                  <strong>{fmtMoney(savingsTotal)}</strong>
                </div>
                <div>
                  <span>Allocated savings buckets</span>
                  <strong>{fmtMoney(allocationTotal)}</strong>
                </div>
                <div>
                  <span>Recurring monthly costs</span>
                  <strong>{fmtMoney(summary.monthlyObligations)}</strong>
                </div>
              </section>

              <section>
                <h2>Retirement</h2>
                <div>
                  <span>Employee contribution</span>
                  <strong>{get("roth_401k_percent", "8")}%</strong>
                </div>
                <div>
                  <span>Employer match</span>
                  <strong>{get("employer_match_percent", "8")}%</strong>
                </div>
                <div className="review-total">
                  <span>Combined retirement rate</span>
                  <strong>{summary.retirementRate.toFixed(2)}%</strong>
                </div>
              </section>

              <section>
                <h2>Goals</h2>
                {data.goals
                  .filter((goal) => goal.is_active)
                  .map((goal) => (
                    <div key={goal.id}>
                      <span>{goal.name}</span>
                      <strong>{fmtMoney(goal.target_amount)}</strong>
                    </div>
                  ))}
                {data.sinkingFunds
                  .filter((fund) => fund.is_active)
                  .map((fund) => (
                    <div key={fund.id}>
                      <span>{fund.name}</span>
                      <strong>{fmtMoney(fund.target_amount)}</strong>
                    </div>
                  ))}
              </section>
            </div>
            <form id="step-form" onSubmit={submitStep} />
          </section>
        );
      }

      default: {
        const summary = buildSummary(data, get, annualSalary);
        return (
          <section className="setup-card complete-card">
            <div className="complete-mark">✓</div>
            <p className="eyebrow">Initial financial health snapshot saved</p>
            <h1>You&rsquo;re ready to go.</h1>
            <p className="setup-lead">
              Your opening snapshot is saved. These figures come from reported balances and the
              planning assumptions you just set.
            </p>
            <div className="health-strip">
              <div>
                <span>Net worth</span>
                <strong>{fmtMoney(netWorth(data))}</strong>
              </div>
              <div>
                <span>Liquid cash</span>
                <strong>{fmtMoney(liquidCash(data))}</strong>
              </div>
              <div>
                <span>Emergency progress</span>
                <strong>{fmtMoney(goalsByName.get(GOAL_NAMES.emergency)?.current_amount ?? 0)}</strong>
              </div>
              <div>
                <span>Travel progress</span>
                <strong>{fmtMoney(goalsByName.get(GOAL_NAMES.travel)?.current_amount ?? 0)}</strong>
              </div>
              <div>
                <span>House progress</span>
                <strong>{fmtMoney(goalsByName.get(GOAL_NAMES.house)?.current_amount ?? 0)}</strong>
              </div>
              <div>
                <span>Upcoming card obligations</span>
                <strong>{fmtMoney(summary.cardObligations)}</strong>
              </div>
              <div>
                <span>Monthly obligations</span>
                <strong>{fmtMoney(summary.monthlyObligations)}</strong>
              </div>
              <div>
                <span>Sinking-fund requirement</span>
                <strong>{fmtMoney(summary.sinkingRequired)}/mo</strong>
              </div>
            </div>
            <div className="form-actions centered">
              <Button variant="gold" onClick={() => navigate("/finance")}>
                Go to Money Flow
              </Button>
              {(progress?.history_option ?? "start_today") !== "start_today" && (
                <Link className="button secondary" to="/finance/imports">
                  Open Import Center
                </Link>
              )}
            </div>
          </section>
        );
      }
    }
  };

  return (
    <div className="finance-setup-body">
      <main className="setup-shell">
        <header className="setup-brand">
          <Link className="brand" to="/finance">
            <img src="/finance/logo.svg" alt="" width={39} height={39} />
            <span>
              <span className="brand-name">NexaFi</span>
              <span className="brand-tagline">Track Today. Build Tomorrow.</span>
            </span>
          </Link>
          <span className="privacy-badge">Private to you</span>
        </header>

        {step <= 8 && (
          <div className="setup-progress">
            <div>
              <span>Step {step} of 8</span>
              <strong>{STEP_TITLES[step - 1]}</strong>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${step * 12.5}%` }} />
            </div>
          </div>
        )}

        {action.message && <div className="alert">{action.message}</div>}
        {action.error && <div className="alert error">{action.error}</div>}

        {stepBody()}

        {step <= 8 && (
          <div className="setup-actions">
            <Button variant="secondary" onClick={back} disabled={step === 1 || action.busy}>
              Back
            </Button>
            <div>
              <Button variant="gold" type="submit" form="step-form" disabled={action.busy}>
                {step === 8 ? "Finish Setup" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        <p className="setup-footnote">
          Stored in {get("currency", "USD")} · No telemetry · v{APP_VERSION}
        </p>
      </main>
    </div>
  );
}

// --- persistence ------------------------------------------------------------

/** Apply one step's answers. Mirrors the POST /setup/{step} branches. */
async function persistStep(
  live: FinanceData,
  step: number,
  get: (key: string, fallback?: string) => string,
  setupDay: string,
  savingsTotal: Decimal,
): Promise<void> {
  const savingsAccounts = live.accounts.filter(
    (account) => account.account_type === "savings" && account.is_active,
  );
  const linkedId = savingsAccounts[0]?.id ?? null;

  if (step === 1) {
    const name = get("display_name").trim();
    if (!name) throw new Error("Enter the name you would like the app to display.");
    const age = Number(get("current_age", "0"));
    const retirementAge = Number(get("retirement_age", "0"));
    if (age < 16 || age > 100 || retirementAge <= age || retirementAge > 100) {
      throw new Error("Enter a valid age and a later retirement age.");
    }
    const profile: Record<string, unknown> = {
      display_name: name,
      date_of_birth: get("date_of_birth"),
      current_age: age,
      state_of_residence: get("state_of_residence").trim(),
      filing_status: "single",
      currency: "USD",
      retirement_age: retirementAge,
    };
    for (const [key, value] of Object.entries(profile)) {
      await saveSetting(live, key, value, { category: "profile" });
    }
    return;
  }

  if (step === 2) {
    const gross = money(get("gross_pay_per_period", "0"));
    const periods = Number(get("pay_periods_per_year", "26"));
    if (!Number.isFinite(periods) || periods < 1 || periods > 366) {
      throw new Error("Enter a valid number of pay periods per year.");
    }
    const scheduleStart = get("paycheck_schedule_start");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleStart)) {
      throw new Error("Enter the date of your first paycheck.");
    }
    const fields: Record<string, unknown> = {
      employer_name: get("employer_name"),
      job_title: get("job_title"),
      work_location: get("work_location"),
      pay_frequency: get("pay_frequency", "biweekly"),
      paycheck_schedule_start: scheduleStart,
      pay_periods_per_year: periods,
      regular_hours_per_period: get("regular_hours_per_period", "80"),
      gross_pay_per_period: gross.toFixed(2),
      annual_salary: money(gross.times(periods)).toFixed(2),
      income_started_part_year: get("income_started_part_year", "false"),
      prior_year_income: money(get("prior_year_income", "0")).toFixed(2),
      prior_income: money(get("prior_income", "0")).toFixed(2),
      prior_federal_withholding: money(get("prior_federal_withholding", "0")).toFixed(2),
      prior_virginia_withholding: money(get("prior_virginia_withholding", "0")).toFixed(2),
    };
    for (const [key, value] of Object.entries(fields)) {
      if (key === "paycheck_schedule_start") {
        await saveSetting(live, key, value, {
          category: "employment",
          valueType: "date",
          label: "First paycheck date",
        });
      } else {
        await saveSetting(live, key, value, { category: "employment" });
      }
    }
    return;
  }

  if (step === 3) {
    const contribution = dec(get("roth_401k_percent", "8"));
    const match = dec(get("employer_match_percent", "8"));
    const expectedReturn = dec(get("expected_return_percent", "7"));
    for (const value of [contribution, match, expectedReturn]) {
      if (value.lessThan(0) || value.greaterThan(100)) {
        throw new Error("Contribution and return percentages must be between 0 and 100.");
      }
    }
    const contributionType = get("retirement_contribution_type", "roth");
    const fields: Record<string, unknown> = {
      retirement_contribution_type: contributionType,
      roth_401k_percent: contribution.toString(),
      employer_match_percent: match.toString(),
      ira_user_monthly_target: money(get("ira_user_monthly_target", "300")).toFixed(2),
      brokerage_user_monthly_target: money(get("brokerage_user_monthly_target", "300")).toFixed(2),
      expected_return_percent: expectedReturn.toString(),
    };
    for (const [key, value] of Object.entries(fields)) {
      await saveSetting(live, key, value, { category: "retirement" });
    }

    // Each balance either updates the matching existing account or creates one.
    const specs: [name: string, kind: AccountType, field: string, family: AccountType[], token: string][] = [
      [
        "401(k)",
        contributionType === "roth" ? "roth_401k" : "traditional_401k",
        "balance_401k",
        ["roth_401k", "traditional_401k"],
        "401",
      ],
      ["Roth IRA", "roth_ira", "balance_ira", ["roth_ira", "traditional_ira"], "ira"],
      [
        "Taxable Brokerage",
        "taxable_brokerage",
        "balance_brokerage",
        ["brokerage", "taxable_brokerage"],
        "brokerage",
      ],
    ];

    for (const [name, kind, field, family, token] of specs) {
      const balance = money(get(field, "0"));
      const existing = live.accounts.find(
        (item) => family.includes(item.account_type) || item.name.toLowerCase().includes(token),
      );
      if (balance.greaterThan(0) || existing) {
        await saveOpeningAccount(live, {
          name: existing?.name ?? name,
          accountType: kind,
          openingBalance: balance,
          effectiveDate: setupDay,
        });
      }
    }
    return;
  }

  if (step === 4) {
    const allocations = {
      emergency: money(get("emergency_current", "0")),
      travel: money(get("travel_current", "0")),
      car: money(get("car_current", "0")),
      house: money(get("house_current", "0")),
    };
    const total = sumMoney(Object.values(allocations));
    if (total.greaterThan(savingsTotal)) {
      throw new Error("Savings bucket allocations cannot exceed the actual savings balance.");
    }

    await saveGoal(live, {
      name: GOAL_NAMES.emergency, goalType: "emergency", target: new Decimal(10000),
      current: allocations.emergency, recommendedMonthly: ZERO, userMonthly: ZERO,
      active: true, linkedAccountId: linkedId,
    });
    await saveGoal(live, {
      name: GOAL_NAMES.travel, goalType: "travel", target: new Decimal(3000),
      current: allocations.travel, recommendedMonthly: new Decimal(250),
      userMonthly: new Decimal(250), active: true, linkedAccountId: linkedId,
    });
    await saveGoal(live, {
      name: GOAL_NAMES.house, goalType: "house", target: new Decimal(80000),
      current: allocations.house, recommendedMonthly: new Decimal(200),
      userMonthly: new Decimal(200), active: true, linkedAccountId: linkedId,
    });
    await saveSinkingFund(live, {
      name: GOAL_NAMES.car, target: new Decimal(250), current: allocations.car,
      dueDate: null, active: true, linkedAccountId: linkedId,
    });
    return;
  }

  if (step === 5) {
    for (const [name, key, fallback, variable] of OBLIGATIONS) {
      await saveRecurringExpense(live, {
        name,
        amount: money(get(`${key}_amount`, fallback)),
        frequency: get(`${key}_frequency`, "monthly"),
        variable,
        active: get(`${key}_enabled`, "true") === "true",
      });
    }
    return;
  }

  if (step === 6) {
    const goalSpecs: [name: string, kind: string, key: string, target: string, monthly: string][] = [
      [GOAL_NAMES.emergency, "emergency", "emergency", "10000", "0"],
      [GOAL_NAMES.travel, "travel", "travel", "3000", "250"],
      [GOAL_NAMES.house, "house", "house", "80000", "200"],
      [GOAL_NAMES.ira, "retirement", "ira", "3600", "300"],
      [GOAL_NAMES.brokerage, "taxable", "brokerage", "3600", "300"],
    ];

    for (const [name, kind, key, target, monthly] of goalSpecs) {
      const existing = live.goals.find((goal) => goal.name === name);
      await saveGoal(live, {
        name,
        goalType: kind,
        target: money(get(`${key}_target`, target)),
        // Never overwrite an allocated balance from this screen; step 4 owns it.
        current: existing ? dec(existing.current_amount) : ZERO,
        recommendedMonthly: money(monthly),
        userMonthly: money(get(`${key}_monthly`, monthly)),
        active: get(`${key}_enabled`, "true") === "true",
        linkedAccountId: ["emergency", "travel", "house"].includes(kind)
          ? linkedId
          : (existing?.linked_account_id ?? null),
      });
    }

    const car = live.sinkingFunds.find((fund) => fund.name === GOAL_NAMES.car);
    await saveSinkingFund(live, {
      name: GOAL_NAMES.car,
      target: money(get("car_target", "250")),
      current: car ? dec(car.current_amount) : ZERO,
      dueDate: car?.due_date ?? null,
      active: get("car_enabled", "true") === "true",
      linkedAccountId: linkedId,
    });
    return;
  }

  if (step === 7) {
    const option = get("history_option", "start_today");
    const allowed = ["start_today", "this_month", "3_months", "6_months", "12_months", "custom"];
    if (!allowed.includes(option)) throw new Error("Choose a valid historical-data option.");
    await saveProgress(live, { history_option: option });
  }
}

// --- review summary ---------------------------------------------------------

function buildSummary(
  data: FinanceData,
  get: (key: string, fallback?: string) => string,
  annualSalary: Decimal,
) {
  const gross = dec(get("gross_pay_per_period", "0"));
  const contribution = dec(get("roth_401k_percent", "8"));
  const match = dec(get("employer_match_percent", "8"));

  // A rough take-home estimate for the review screen only; the real figure comes
  // from an actual paycheck once one is recorded.
  const estimatedTaxRate = new Decimal("0.22");
  const expectedNet = money(
    gross.minus(gross.times(estimatedTaxRate)).minus(gross.times(contribution).div(100)),
  );

  const monthlyObligations = sumMoney(
    data.recurringExpenses
      .filter((row) => row.is_active)
      .map((row) => monthlyEquivalent(row.amount, row.frequency)),
  );

  const sinkingRequired = sumMoney(
    data.sinkingFunds
      .filter((fund) => fund.is_active)
      .map((fund) =>
        requiredSinkingContribution(fund.target_amount, fund.current_amount, fund.due_date, todayISO()),
      ),
  );

  const cardObligations = sumMoney(
    data.accounts
      .filter((account) => account.account_type === "credit_card" && account.is_active)
      .map((account) => account.statement_balance),
  );

  return {
    expectedNet,
    monthlyObligations,
    sinkingRequired,
    cardObligations,
    retirementRate: contribution.plus(match),
    annualSalary,
  };
}
