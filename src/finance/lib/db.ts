// Supabase access for the finance sub-app.
//
// Reuses the shared client so there is one auth session for the whole site.
// Every fin_* table is closed to `anon` by RLS, so each call below only ever
// returns rows once a real Supabase Auth session exists (see context/FinanceAuth).

import { supabase } from "@/lib/supabase";
import type {
  Account, AccountBalance, AIImport, AIReview, FinancialGoal, InvestmentAccount,
  InvestmentHolding, InvestmentSnapshot, InvestmentTransaction, MerchantRule,
  MonthlyAIInsight, MonthlySnapshot, MonthPlan, Paycheck, PaycheckAllocation,
  PaycheckDeduction, PtoEntry, RecurringExpense, RecurringSuggestion, RetirementContribution,
  Security, SecurityPrice, Setting, SetupProgress, SinkingFund, Subscription,
  Transaction, TransactionCategory, Transfer,
} from "./types";

/** Table names live in one place so a rename is a single edit. */
export const T = {
  accounts: "fin_accounts",
  accountBalances: "fin_account_balances",
  categories: "fin_transaction_categories",
  transactions: "fin_transactions",
  transfers: "fin_transfers",
  paychecks: "fin_paychecks",
  paycheckDeductions: "fin_paycheck_deductions",
  ptoEntries: "fin_pto_entries",
  subscriptions: "fin_subscriptions",
  recurringExpenses: "fin_recurring_expenses",
  sinkingFunds: "fin_sinking_funds",
  goals: "fin_financial_goals",
  retirementContributions: "fin_retirement_contributions",
  settings: "fin_settings",
  setupProgress: "fin_setup_progress",
  monthlySnapshots: "fin_monthly_snapshots",
  investmentAccounts: "fin_investment_accounts",
  securities: "fin_securities",
  holdings: "fin_investment_holdings",
  investmentTransactions: "fin_investment_transactions",
  securityPrices: "fin_security_prices",
  investmentSnapshots: "fin_investment_snapshots",
  aiImports: "fin_ai_imports",
  aiReviews: "fin_ai_reviews",
  merchantRules: "fin_merchant_rules",
  recurringSuggestions: "fin_recurring_suggestions",
  aiInsights: "fin_monthly_ai_insights",
  monthPlans: "fin_month_plans",
  allocations: "fin_paycheck_allocations",
} as const;

export class FinanceDbError extends Error {
  constructor(message: string, readonly table: string, readonly cause?: unknown) {
    super(message);
    this.name = "FinanceDbError";
  }
}

/** Unwrap a PostgREST result, turning its error into a thrown one. */
function unwrap<R>(table: string, result: { data: R | null; error: { message: string } | null }): R {
  if (result.error) throw new FinanceDbError(result.error.message, table, result.error);
  return (result.data ?? []) as R;
}

async function selectAll<R>(table: string, orderBy?: string): Promise<R[]> {
  let query = supabase.from(table).select("*");
  if (orderBy) query = query.order(orderBy, { ascending: true });
  else query = query.order("id", { ascending: true });
  return unwrap<R[]>(table, await query);
}

// --- reads ------------------------------------------------------------------

export const fetchAccounts = () => selectAll<Account>(T.accounts, "name");
export const fetchAccountBalances = () => selectAll<AccountBalance>(T.accountBalances);
export const fetchCategories = () => selectAll<TransactionCategory>(T.categories, "name");
export const fetchTransactions = () => selectAll<Transaction>(T.transactions, "transaction_date");
export const fetchTransfers = () => selectAll<Transfer>(T.transfers, "transfer_date");
export const fetchPaychecks = () => selectAll<Paycheck>(T.paychecks, "pay_date");
export const fetchPaycheckDeductions = () => selectAll<PaycheckDeduction>(T.paycheckDeductions);
export const fetchPtoEntries = () => selectAll<PtoEntry>(T.ptoEntries, "start_date");
export const fetchSubscriptions = () => selectAll<Subscription>(T.subscriptions, "name");
export const fetchRecurringExpenses = () => selectAll<RecurringExpense>(T.recurringExpenses, "name");
export const fetchSinkingFunds = () => selectAll<SinkingFund>(T.sinkingFunds, "name");
export const fetchGoals = () => selectAll<FinancialGoal>(T.goals, "name");
export const fetchRetirementContributions = () => selectAll<RetirementContribution>(T.retirementContributions, "contribution_date");
export const fetchSettings = () => selectAll<Setting>(T.settings, "key");
export const fetchMonthlySnapshots = () => selectAll<MonthlySnapshot>(T.monthlySnapshots, "snapshot_month");
export const fetchInvestmentAccounts = () => selectAll<InvestmentAccount>(T.investmentAccounts);
export const fetchSecurities = () => selectAll<Security>(T.securities, "symbol");
export const fetchHoldings = () => selectAll<InvestmentHolding>(T.holdings);
export const fetchInvestmentTransactions = () => selectAll<InvestmentTransaction>(T.investmentTransactions, "transaction_date");
export const fetchSecurityPrices = () => selectAll<SecurityPrice>(T.securityPrices, "price_date");
export const fetchInvestmentSnapshots = () => selectAll<InvestmentSnapshot>(T.investmentSnapshots, "snapshot_date");
export const fetchAIImports = () => selectAll<AIImport>(T.aiImports, "created_at");
export const fetchAIReviews = () => selectAll<AIReview>(T.aiReviews);
export const fetchMerchantRules = () => selectAll<MerchantRule>(T.merchantRules, "merchant_pattern");
export const fetchRecurringSuggestions = () => selectAll<RecurringSuggestion>(T.recurringSuggestions);
export const fetchAIInsights = () => selectAll<MonthlyAIInsight>(T.aiInsights, "snapshot_month");
export const fetchMonthPlans = () => selectAll<MonthPlan>(T.monthPlans, "plan_month");
export const fetchAllocations = () => selectAll<PaycheckAllocation>(T.allocations);

export async function fetchSetupProgress(): Promise<SetupProgress | null> {
  const rows = await selectAll<SetupProgress>(T.setupProgress);
  return rows[0] ?? null;
}

// --- writes -----------------------------------------------------------------

/**
 * Insert and return the created row. `owner` is never passed from the client:
 * the column defaults to auth.uid() and the RLS check would reject anything
 * else, so a forged owner is impossible rather than merely discouraged.
 */
export async function insertRow<R>(table: string, values: Record<string, unknown>): Promise<R> {
  const result = await supabase.from(table).insert(values).select().single();
  if (result.error) throw new FinanceDbError(result.error.message, table, result.error);
  return result.data as R;
}

export async function insertRows<R>(table: string, values: Record<string, unknown>[]): Promise<R[]> {
  if (values.length === 0) return [];
  const result = await supabase.from(table).insert(values).select();
  if (result.error) throw new FinanceDbError(result.error.message, table, result.error);
  return (result.data ?? []) as R[];
}

export async function updateRow<R>(table: string, id: number, values: Record<string, unknown>): Promise<R> {
  const result = await supabase.from(table).update(values).eq("id", id).select().single();
  if (result.error) throw new FinanceDbError(result.error.message, table, result.error);
  return result.data as R;
}

export async function deleteRow(table: string, id: number): Promise<void> {
  const result = await supabase.from(table).delete().eq("id", id);
  if (result.error) throw new FinanceDbError(result.error.message, table, result.error);
}

export async function deleteWhere(table: string, column: string, value: unknown): Promise<void> {
  const result = await supabase.from(table).delete().eq(column, value);
  if (result.error) throw new FinanceDbError(result.error.message, table, result.error);
}

/** Insert or update on a unique constraint — used by settings and snapshots. */
export async function upsertRow<R>(table: string, values: Record<string, unknown>, onConflict: string): Promise<R> {
  const result = await supabase.from(table).upsert(values, { onConflict }).select().single();
  if (result.error) throw new FinanceDbError(result.error.message, table, result.error);
  return result.data as R;
}
