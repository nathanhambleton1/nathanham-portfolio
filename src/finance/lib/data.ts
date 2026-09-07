// The whole finance dataset, loaded once and computed over in memory.
//
// The Python original ran against a local SQLite file, so its services queried
// freely — `monthly_obligations` alone issues five separate SELECTs. Doing that
// over the network would mean dozens of round trips per page. Instead every
// table is fetched once into this snapshot and the ported services run as pure
// functions over plain arrays, which keeps them a faithful translation of the
// Python while making a page render exactly one batch of requests.
//
// The dataset is small by nature (one person's finances), so holding it in
// memory is the right shape here, not a shortcut.

import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import * as db from "./db";
import type {
  Account, AccountBalance, AIImport, AIReview, FinancialGoal, InvestmentAccount,
  InvestmentHolding, InvestmentSnapshot, InvestmentTransaction, MerchantRule,
  MonthlyAIInsight, MonthlySnapshot, MonthPlan, Paycheck, PaycheckAllocation,
  PaycheckDeduction, RecurringExpense, RecurringSuggestion, RetirementContribution,
  Security, SecurityPrice, Setting, SetupProgress, SinkingFund, Subscription,
  Transaction, TransactionCategory, Transfer,
} from "./types";

export interface FinanceData {
  accounts: Account[];
  accountBalances: AccountBalance[];
  categories: TransactionCategory[];
  transactions: Transaction[];
  transfers: Transfer[];
  paychecks: Paycheck[];
  paycheckDeductions: PaycheckDeduction[];
  subscriptions: Subscription[];
  recurringExpenses: RecurringExpense[];
  sinkingFunds: SinkingFund[];
  goals: FinancialGoal[];
  retirementContributions: RetirementContribution[];
  settingRows: Setting[];
  setupProgress: SetupProgress | null;
  monthlySnapshots: MonthlySnapshot[];
  investmentAccounts: InvestmentAccount[];
  securities: Security[];
  holdings: InvestmentHolding[];
  investmentTransactions: InvestmentTransaction[];
  securityPrices: SecurityPrice[];
  investmentSnapshots: InvestmentSnapshot[];
  aiImports: AIImport[];
  aiReviews: AIReview[];
  merchantRules: MerchantRule[];
  recurringSuggestions: RecurringSuggestion[];
  aiInsights: MonthlyAIInsight[];
  monthPlans: MonthPlan[];
  allocations: PaycheckAllocation[];
  /** settings flattened to key → value, the shape every service expects. */
  settings: Record<string, string>;
}

export const FINANCE_QUERY_KEY = ["finance", "dataset"] as const;

export async function loadFinanceData(): Promise<FinanceData> {
  const [
    accounts, accountBalances, categories, transactions, transfers, paychecks,
    paycheckDeductions, subscriptions, recurringExpenses, sinkingFunds, goals,
    retirementContributions, settingRows, setupProgress, monthlySnapshots,
    investmentAccounts, securities, holdings, investmentTransactions,
    securityPrices, investmentSnapshots, aiImports, aiReviews, merchantRules,
    recurringSuggestions, aiInsights, monthPlans, allocations,
  ] = await Promise.all([
    db.fetchAccounts(), db.fetchAccountBalances(), db.fetchCategories(),
    db.fetchTransactions(), db.fetchTransfers(), db.fetchPaychecks(),
    db.fetchPaycheckDeductions(), db.fetchSubscriptions(), db.fetchRecurringExpenses(),
    db.fetchSinkingFunds(), db.fetchGoals(), db.fetchRetirementContributions(),
    db.fetchSettings(), db.fetchSetupProgress(), db.fetchMonthlySnapshots(),
    db.fetchInvestmentAccounts(), db.fetchSecurities(), db.fetchHoldings(),
    db.fetchInvestmentTransactions(), db.fetchSecurityPrices(), db.fetchInvestmentSnapshots(),
    db.fetchAIImports(), db.fetchAIReviews(), db.fetchMerchantRules(),
    db.fetchRecurringSuggestions(), db.fetchAIInsights(), db.fetchMonthPlans(),
    db.fetchAllocations(),
  ]);

  const settings: Record<string, string> = {};
  for (const row of settingRows) settings[row.key] = row.value;

  return {
    accounts, accountBalances, categories, transactions, transfers, paychecks,
    paycheckDeductions, subscriptions, recurringExpenses, sinkingFunds, goals,
    retirementContributions, settingRows, setupProgress, monthlySnapshots,
    investmentAccounts, securities, holdings, investmentTransactions,
    securityPrices, investmentSnapshots, aiImports, aiReviews, merchantRules,
    recurringSuggestions, aiInsights, monthPlans, allocations, settings,
  };
}

export function useFinanceData(enabled = true): UseQueryResult<FinanceData> {
  return useQuery({
    queryKey: FINANCE_QUERY_KEY,
    queryFn: loadFinanceData,
    enabled,
    staleTime: 30_000,
  });
}

/** Refetch the dataset after any mutation. */
export function useRefreshFinanceData(): () => Promise<void> {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
  };
}

// --- lookups ----------------------------------------------------------------

export function byId<R extends { id: number }>(rows: R[]): Map<number, R> {
  return new Map(rows.map((row) => [row.id, row]));
}

export function accountName(data: FinanceData, id: number | null | undefined): string {
  if (id === null || id === undefined) return "—";
  return data.accounts.find((account) => account.id === id)?.name ?? "—";
}

export function categoryName(data: FinanceData, id: number | null | undefined): string {
  if (id === null || id === undefined) return "Uncategorized";
  return data.categories.find((category) => category.id === id)?.name ?? "Uncategorized";
}

/** Top-level categories, in the app's fixed display order. */
export function parentCategories(data: FinanceData): TransactionCategory[] {
  return data.categories.filter((category) => category.parent_id === null);
}

export function childCategories(data: FinanceData, parentId: number): TransactionCategory[] {
  return data.categories.filter((category) => category.parent_id === parentId);
}

// --- settings helpers -------------------------------------------------------

export function settingValue(settings: Record<string, string>, key: string, fallback = ""): string {
  const value = settings[key];
  return value === undefined || value === "" ? fallback : value;
}

/** `truthy()` from allocation.py — an unset flag takes the caller's default. */
export function settingFlag(settings: Record<string, string>, key: string, fallback = true): boolean {
  const value = settings[key];
  if (value === undefined) return fallback;
  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

export function settingNumber(settings: Record<string, string>, key: string, fallback: number): number {
  const parsed = Number(settings[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}
