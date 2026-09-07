// Exports and backups - a port of nexafi/services/exports.py.
//
// ONE DELIBERATE DIFFERENCE from the original. The Python offered a native
// SQLite backup (`sqlite_backup`) by copying the local database file. There is
// no local database file any more: the data lives in Postgres behind Supabase,
// which takes its own managed backups. What that download was actually *for* -
// a complete, restorable copy you hold yourself - is served here by the full
// JSON export, which covers every table and is what `restoreFromJson` reads
// back. The label on the button says so rather than pretending nothing changed.

import { fmtMoney } from "./money";
import { todayISO } from "./dates";
import type { FinanceData } from "./data";
import { accountName, categoryName } from "./data";

export const EXPORT_VERSION = "1.0";

/** The tables a full export covers, in dependency order. */
const EXPORT_TABLES: (keyof FinanceData)[] = [
  "accounts", "accountBalances", "categories", "transactions", "transfers",
  "paychecks", "paycheckDeductions", "subscriptions", "recurringExpenses",
  "goals", "sinkingFunds", "retirementContributions", "monthlySnapshots",
  "investmentAccounts", "securities", "securityPrices", "holdings",
  "investmentSnapshots", "investmentTransactions", "aiImports", "aiReviews",
  "merchantRules", "recurringSuggestions", "aiInsights", "settingRows",
  "monthPlans", "allocations",
];

/** Table names in the export match the database, not the in-memory field names. */
const TABLE_NAMES: Partial<Record<keyof FinanceData, string>> = {
  accountBalances: "account_balances",
  categories: "transaction_categories",
  paycheckDeductions: "paycheck_deductions",
  recurringExpenses: "recurring_expenses",
  goals: "financial_goals",
  sinkingFunds: "sinking_funds",
  retirementContributions: "retirement_contributions",
  monthlySnapshots: "monthly_snapshots",
  investmentAccounts: "investment_accounts",
  securityPrices: "security_prices",
  holdings: "investment_holdings",
  investmentSnapshots: "investment_snapshots",
  investmentTransactions: "investment_transactions",
  aiImports: "ai_imports",
  aiReviews: "ai_reviews",
  merchantRules: "merchant_rules",
  recurringSuggestions: "recurring_suggestions",
  aiInsights: "monthly_ai_insights",
  settingRows: "settings",
  monthPlans: "month_plans",
  allocations: "paycheck_allocations",
};

export function fullExportJson(data: FinanceData): string {
  const tables: Record<string, unknown> = {};
  for (const key of EXPORT_TABLES) {
    tables[TABLE_NAMES[key] ?? key] = data[key];
  }
  if (data.setupProgress) tables.setup_progress = [data.setupProgress];

  return JSON.stringify(
    {
      nexafi_export_version: EXPORT_VERSION,
      created_at: new Date().toISOString(),
      tables,
    },
    null,
    2,
  );
}

/** RFC 4180 quoting: double the quotes, wrap anything with a separator. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function transactionsCsv(data: FinanceData): string {
  const rows = [...data.transactions].sort((a, b) =>
    a.transaction_date === b.transaction_date
      ? a.id - b.id
      : a.transaction_date < b.transaction_date
        ? -1
        : 1,
  );

  return toCsv(
    ["date", "posting_date", "account", "description", "merchant", "amount", "type",
     "category", "subcategory", "is_transfer", "source", "notes"],
    rows.map((item) => [
      item.transaction_date,
      item.posting_date ?? "",
      accountName(data, item.account_id),
      item.description,
      item.merchant ?? "",
      item.amount,
      item.transaction_type,
      item.category_id ? categoryName(data, item.category_id) : "",
      item.subcategory_id ? categoryName(data, item.subcategory_id) : "",
      String(Boolean(item.is_transfer)).toLowerCase(),
      item.source,
      item.notes ?? "",
    ]),
  );
}

export function accountsCsv(data: FinanceData): string {
  return toCsv(
    ["name", "type", "institution", "last_four", "is_liability", "in_net_worth", "active",
     "statement_balance", "apy", "cashback_rate"],
    data.accounts.map((account) => [
      account.name,
      account.account_type,
      account.institution ?? "",
      account.last_four ?? "",
      String(account.is_liability).toLowerCase(),
      String(account.include_in_net_worth).toLowerCase(),
      String(account.is_active).toLowerCase(),
      account.statement_balance,
      account.apy,
      account.cashback_rate,
    ]),
  );
}

export function paychecksCsv(data: FinanceData): string {
  return toCsv(
    ["pay_date", "employer", "gross", "net", "federal", "virginia", "social_security",
     "medicare", "roth_401k", "employer_match", "other_deductions", "pto_earned", "pto_used"],
    [...data.paychecks]
      .sort((a, b) => (a.pay_date < b.pay_date ? -1 : 1))
      .map((item) => [
        item.pay_date, item.employer, item.gross_amount, item.net_amount,
        item.federal_withholding, item.virginia_withholding, item.social_security,
        item.medicare, item.roth_401k, item.employer_401k_match, item.other_deductions,
        item.pto_earned, item.pto_used,
      ]),
  );
}

export function accountsJson(data: FinanceData): string {
  return JSON.stringify(data.accounts, null, 2);
}

export function goalsJson(data: FinanceData): string {
  return JSON.stringify(data.goals, null, 2);
}

export function paychecksJson(data: FinanceData): string {
  return JSON.stringify(data.paychecks, null, 2);
}

/** A human-readable summary rather than a table dump. */
export function financialSummaryJson(data: FinanceData, summary: Record<string, unknown>): string {
  return JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      ...summary,
      accounts: data.accounts.length,
      transactions: data.transactions.length,
      goals: data.goals.map((goal) => ({
        name: goal.name,
        type: goal.goal_type,
        current: fmtMoney(goal.current_amount),
        target: fmtMoney(goal.target_amount),
      })),
    },
    null,
    2,
  );
}

// --- download plumbing ------------------------------------------------------

/**
 * Hand the browser a generated file.
 *
 * The blob URL is revoked on the next tick rather than immediately: Safari
 * needs the URL to still resolve when it processes the synthetic click.
 */
export function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportFilename(kind: string, extension: string): string {
  return `nexafi-${kind}-${todayISO()}.${extension}`;
}

export function downloadCsv(kind: string, content: string): void {
  downloadText(exportFilename(kind, "csv"), content, "text/csv");
}

export function downloadJson(kind: string, content: string): void {
  downloadText(exportFilename(kind, "json"), content, "application/json");
}
