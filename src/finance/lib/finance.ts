// Core financial calculations — a port of nexafi/services/finance.py.
//
// The Python versions took a SQLAlchemy Session and queried; these take the
// in-memory FinanceData snapshot and filter arrays. The arithmetic, rounding,
// and ordering are unchanged.

import { Decimal, ZERO, money, sum as sumMoney, minDec, maxDec } from "./money";
import { monthBounds, monthsUntilDue, shiftMonths, todayISO, type ISODate } from "./dates";
import type { FinanceData } from "./data";
import type { Account, FinancialGoal, SinkingFund } from "./types";
import { CASH_ACCOUNT_TYPES } from "./types";

/** Only true expenses count as spending; transfers never do. */
export const SPENDING_TYPES = ["expense"] as const;
export const TRANSFER_TYPES = ["transfer", "account_transfer", "card_payment"] as const;

export const SPENDING_PERIODS: [key: string, label: string][] = [
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["last_3_months", "Last 3 months"],
  ["last_6_months", "Last 6 months"],
  ["last_12_months", "Last 12 months"],
  ["all_time", "All time"],
];

// Defaults to three months rather than "this month" because transactions for
// the current month are typically not imported until it is nearly over.
export const DEFAULT_SPENDING_PERIOD = "last_3_months";
export const EARLIEST_DATE: ISODate = "2000-01-01";

export function resolveSpendingPeriod(
  period: string | null | undefined,
  asOf: ISODate = todayISO(),
): { start: ISODate; end: ISODate; key: string } {
  const validKeys = SPENDING_PERIODS.map(([key]) => key);
  const key = period && validKeys.includes(period) ? period : DEFAULT_SPENDING_PERIOD;

  if (key === "this_month") {
    const [start, end] = monthBounds(asOf);
    return { start, end, key };
  }
  if (key === "last_month") {
    const [start, end] = monthBounds(shiftMonths(asOf, 1));
    return { start, end, key };
  }
  if (key === "all_time") {
    return { start: EARLIEST_DATE, end: asOf, key };
  }
  const monthsBack = { last_3_months: 2, last_6_months: 5, last_12_months: 11 }[key] ?? 2;
  return { start: shiftMonths(asOf, monthsBack), end: asOf, key };
}

/** Total real (non-transfer) expenses in a date range. */
export function spendingTotalForRange(data: FinanceData, start: ISODate, end: ISODate): Decimal {
  return sumMoney(
    data.transactions
      .filter(
        (t) =>
          t.transaction_date >= start &&
          t.transaction_date <= end &&
          (SPENDING_TYPES as readonly string[]).includes(t.transaction_type) &&
          !t.is_transfer,
      )
      .map((t) => t.amount),
  );
}

export interface MonthlyTotals {
  income: Decimal;
  spending: Decimal;
  surplus: Decimal;
  savingsRate: Decimal;
}

/**
 * Income is the greater of imported income transactions and recorded paychecks,
 * not their sum — a paycheck that was also imported as a transaction would
 * otherwise be counted twice.
 */
export function monthlyTotals(data: FinanceData, day: ISODate = todayISO()): MonthlyTotals {
  const [start, end] = monthBounds(day);
  const spending = spendingTotalForRange(data, start, end);

  const transactionIncome = sumMoney(
    data.transactions
      .filter(
        (t) =>
          t.transaction_date >= start &&
          t.transaction_date <= end &&
          t.transaction_type === "income" &&
          !t.is_transfer,
      )
      .map((t) => t.amount),
  );
  const paycheckIncome = sumMoney(
    data.paychecks.filter((p) => p.pay_date >= start && p.pay_date <= end).map((p) => p.net_amount),
  );

  const income = maxDec(transactionIncome, paycheckIncome);
  const surplus = money(income.minus(spending));
  const savingsRate = income.isZero() ? ZERO : money(surplus.div(income).times(100));
  return { income, spending, surplus, savingsRate };
}

/**
 * The newest dated snapshot per account.
 *
 * Balances in NexaFi are dated snapshots, not a running sum of transactions, so
 * "current" means the latest row — ties broken by the higher id.
 */
export function currentAccountBalances(data: FinanceData): Map<number, Decimal> {
  const balances = new Map<number, Decimal>();
  const ordered = [...data.accountBalances].sort((a, b) => {
    if (a.account_id !== b.account_id) return a.account_id - b.account_id;
    if (a.balance_date !== b.balance_date) return a.balance_date < b.balance_date ? 1 : -1;
    return b.id - a.id;
  });
  for (const row of ordered) {
    if (!balances.has(row.account_id)) balances.set(row.account_id, money(row.balance));
  }
  return balances;
}

export function accountBalance(data: FinanceData, accountId: number): Decimal {
  return currentAccountBalances(data).get(accountId) ?? ZERO;
}

export function netWorth(data: FinanceData): Decimal {
  const balances = currentAccountBalances(data);
  let total = ZERO;
  for (const account of data.accounts.filter((a) => a.include_in_net_worth)) {
    const balance = balances.get(account.id) ?? ZERO;
    total = total.plus(account.is_liability ? balance.negated() : balance);
  }
  return money(total);
}

export function liquidCash(data: FinanceData): Decimal {
  const balances = currentAccountBalances(data);
  return sumMoney(
    data.accounts
      .filter((a) => CASH_ACCOUNT_TYPES.includes(a.account_type) && a.is_active)
      .map((a) => balances.get(a.id) ?? ZERO),
  );
}

/** The five top-level spend buckets, always in this order and always present. */
export const SPENDING_CATEGORY_ORDER = [
  "Housing & Bills",
  "Food & Dining",
  "Transportation",
  "Shopping & Personal",
  "Travel & Other",
];

export function categorySpendingForRange(
  data: FinanceData,
  start: ISODate,
  end: ISODate,
): [name: string, amount: Decimal][] {
  const parents = new Map(
    data.categories.filter((c) => c.parent_id === null).map((c) => [c.id, c.name]),
  );
  const values = new Map<string, Decimal>();
  for (const t of data.transactions) {
    if (t.transaction_date < start || t.transaction_date > end) continue;
    if (!(SPENDING_TYPES as readonly string[]).includes(t.transaction_type) || t.is_transfer) continue;
    if (t.category_id === null) continue;
    const name = parents.get(t.category_id);
    if (!name) continue;
    values.set(name, money((values.get(name) ?? ZERO).plus(t.amount)));
  }
  return SPENDING_CATEGORY_ORDER.map((name) => [name, values.get(name) ?? ZERO]);
}

export function categorySpending(data: FinanceData, day: ISODate = todayISO()) {
  const [start, end] = monthBounds(day);
  return categorySpendingForRange(data, start, end);
}

export { monthsUntilDue };

/** Monthly amount needed to close a sinking fund's gap by its due date. */
export function requiredSinkingContribution(
  target: Decimal | string,
  current: Decimal | string,
  dueDate: ISODate | null,
  asOf: ISODate = todayISO(),
): Decimal {
  const remaining = maxDec(ZERO, money(new Decimal(target).minus(new Decimal(current))));
  const months = dueDate ? monthsUntilDue(dueDate, asOf) : 12;
  return money(remaining.div(months));
}

export function projectedInterest(balance: Decimal, apyPercent: Decimal, months = 12): Decimal {
  if (balance.lessThanOrEqualTo(0) || apyPercent.lessThanOrEqualTo(0) || months <= 0) return ZERO;
  const monthlyRate = apyPercent.div(100).div(12);
  return money(balance.times(monthlyRate.plus(1).pow(months).minus(1)));
}

export function goalProgress(goal: FinancialGoal | SinkingFund): Decimal {
  const target = new Decimal(goal.target_amount);
  if (target.lessThanOrEqualTo(0)) return ZERO;
  return minDec(100, money(new Decimal(goal.current_amount).div(target).times(100)));
}

// --- month-end cash recommendation ------------------------------------------

export interface CashRecommendation {
  liquidCash: Decimal;
  expectedIncome: Decimal;
  upcomingCardPayments: Decimal;
  upcomingBills: Decimal;
  requiredSinking: Decimal;
  availableCash: Decimal;
}

/** What is genuinely free to spend or invest between today and month end. */
export function monthEndRecommendation(
  data: FinanceData,
  day: ISODate = todayISO(),
): CashRecommendation {
  const [, end] = monthBounds(day);
  const balances = currentAccountBalances(data);
  const dayOfMonth = Number(day.slice(8, 10));
  const endDay = Number(end.slice(8, 10));

  const cardPayments = sumMoney(
    data.accounts
      .filter((a) => a.account_type === "credit_card" && a.is_active)
      .map((a) => a.statement_balance),
  );

  const bills = sumMoney(
    data.recurringExpenses
      .filter(
        (e) =>
          e.is_active &&
          e.frequency === "monthly" &&
          e.due_day !== null &&
          e.due_day >= dayOfMonth &&
          e.due_day <= endDay,
      )
      .map((e) => e.amount),
  );

  const required = sumMoney(
    data.sinkingFunds
      .filter((f) => f.is_active)
      .map((f) => requiredSinkingContribution(f.target_amount, f.current_amount, f.due_date, day)),
  );

  const expectedIncome = sumMoney(
    data.paychecks.filter((p) => p.pay_date > day && p.pay_date <= end).map((p) => p.net_amount),
  );

  const cash = sumMoney(
    data.accounts
      .filter((a) => CASH_ACCOUNT_TYPES.includes(a.account_type) && a.is_active)
      .map((a) => balances.get(a.id) ?? ZERO),
  );

  return {
    liquidCash: cash,
    expectedIncome,
    upcomingCardPayments: cardPayments,
    upcomingBills: bills,
    requiredSinking: required,
    availableCash: money(
      cash.plus(expectedIncome).minus(cardPayments).minus(bills).minus(required),
    ),
  };
}

// --- account deletion guard -------------------------------------------------

export class AccountInUseError extends Error {}

/**
 * What still depends on an account, in the words the error message uses.
 *
 * Real financial history blocks deletion outright rather than being guessed at;
 * soft links (recurring expenses, subscriptions, goals, funds, another
 * account's autopay) are cleared by the caller instead.
 */
export function accountDeletionBlockers(data: FinanceData, account: Account): string[] {
  const blockers: string[] = [];
  if (data.transactions.some((t) => t.account_id === account.id)) blockers.push("transactions");
  if (data.transfers.some((t) => t.source_account_id === account.id || t.destination_account_id === account.id)) {
    blockers.push("transfers");
  }
  if (data.aiImports.some((i) => i.account_id === account.id)) blockers.push("import batches");
  if (data.retirementContributions.some((c) => c.account_id === account.id)) {
    blockers.push("retirement contributions");
  }
  if (data.investmentAccounts.some((i) => i.account_id === account.id)) {
    blockers.push("an investment account");
  }
  if (data.paychecks.some((p) => p.destination_account_id === account.id)) blockers.push("paychecks");
  return blockers;
}

export function accountDeletionError(data: FinanceData, account: Account): string | null {
  const blockers = accountDeletionBlockers(data, account);
  if (blockers.length === 0) return null;
  return `Can't delete ${account.name}: it still has ${blockers.join(", ")}. Remove those first.`;
}
