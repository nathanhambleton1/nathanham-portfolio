// Savings buckets — one idea, two tables.
//
// The original app drew a line between a "financial goal" and a "sinking fund".
// In practice both are the same thing: a name, an amount you are trying to reach,
// and the pile of real cash currently standing behind it. The only difference was
// which table the row lived in, and that is not a distinction worth making
// someone navigate between two pages for.
//
// So the two tables stay (the data is already there and the money-flow engine
// still writes to both), and this module presents them as one list. `source`
// says which table a bucket came from, which is all any writer needs to know.
//
// The second job here is the question the balance sheet cannot answer: your
// savings account says $11,000, but what is that eleven thousand *for*? Every
// bucket points at an account, so summing them per account gives the breakdown —
// and the remainder, the part no bucket has claimed, is the honest "unassigned"
// figure.

import { Decimal, ZERO, dec, maxDec, money, sum as sumMoney } from "./money";
import { todayISO, type ISODate } from "./dates";
import { currentAccountBalances, goalProgress, requiredSinkingContribution } from "./finance";
import { defaultSavingsAccountId, goalMonthlyAmount } from "./allocation";
import type { FinanceData } from "./data";
import type { Account, FinancialGoal, SinkingFund } from "./types";
import { CASH_ACCOUNT_TYPES, GOAL_TYPE_LABELS } from "./types";

export type BucketSource = "goal" | "sinking_fund";

export interface Bucket {
  source: BucketSource;
  id: number;
  name: string;
  /** "Emergency fund", "Travel", "Earmarked savings" — what kind of bucket it is. */
  kindLabel: string;
  current: Decimal;
  target: Decimal;
  targetDate: ISODate | null;
  /** What you told it to get each month, if anything. */
  monthlyTarget: Decimal;
  /** What the app would put in this month if it were choosing. */
  suggestedMonthly: Decimal;
  /** The real account the money sits in. */
  accountId: number | null;
  isActive: boolean;
  percent: Decimal;
  /** Zero once funded. */
  remaining: Decimal;
}

function goalBucket(goal: FinancialGoal, asOf: ISODate, fallbackAccountId: number | null): Bucket {
  const current = money(goal.current_amount);
  const target = money(goal.target_amount);
  return {
    source: "goal",
    id: goal.id,
    name: goal.name,
    kindLabel: GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type,
    current,
    target,
    targetDate: goal.target_date,
    monthlyTarget: money(goal.user_monthly_target),
    suggestedMonthly: goalMonthlyAmount(goal, asOf),
    accountId: goal.linked_account_id ?? fallbackAccountId,
    isActive: goal.is_active,
    percent: goalProgress(goal),
    remaining: maxDec(ZERO, money(target.minus(current))),
  };
}

function fundBucket(fund: SinkingFund, asOf: ISODate, fallbackAccountId: number | null): Bucket {
  const current = money(fund.current_amount);
  const target = money(fund.target_amount);
  const monthly = requiredSinkingContribution(fund.target_amount, current, fund.due_date, asOf);
  return {
    source: "sinking_fund",
    id: fund.id,
    name: fund.name,
    kindLabel: "Earmarked savings",
    current,
    target,
    targetDate: fund.due_date,
    monthlyTarget: monthly,
    suggestedMonthly: monthly,
    accountId: fund.linked_account_id ?? fallbackAccountId,
    isActive: fund.is_active,
    percent: goalProgress(fund),
    remaining: maxDec(ZERO, money(target.minus(current))),
  };
}

/**
 * Every bucket, goals and funds together, largest first.
 *
 * Inactive rows are dropped rather than greyed out: an archived bucket is not
 * something you are saving toward, and leaving it in the list only makes the
 * per-account breakdown below add up to the wrong thing.
 */
export function buckets(data: FinanceData, settings: Record<string, string> = {}): Bucket[] {
  const asOf = todayISO();
  const fallback = defaultSavingsAccountId(data, settings);
  const rows = [
    ...data.goals.filter((goal) => goal.is_active).map((goal) => goalBucket(goal, asOf, fallback)),
    ...data.sinkingFunds.filter((fund) => fund.is_active).map((fund) => fundBucket(fund, asOf, fallback)),
  ];
  rows.sort((a, b) => {
    const byAmount = b.current.comparedTo(a.current);
    return byAmount !== 0 ? byAmount : a.name.localeCompare(b.name);
  });
  return rows;
}

export interface AccountBreakdown {
  account: Account;
  balance: Decimal;
  buckets: Bucket[];
  /** What the buckets claim. */
  assigned: Decimal;
  /** Balance minus assigned — negative when the buckets claim more than is there. */
  unassigned: Decimal;
  /** True when the buckets have over-claimed, which means a bucket is stale. */
  overAssigned: boolean;
}

/**
 * What each savings pot is actually made of.
 *
 * Only cash accounts get a breakdown. A brokerage's balance is not the sum of
 * anything you earmarked — it is the sum of what the market did — so claiming
 * otherwise would be a nice-looking lie.
 */
export function savingsBreakdown(
  data: FinanceData,
  settings: Record<string, string> = {},
): AccountBreakdown[] {
  const balances = currentAccountBalances(data);
  const all = buckets(data, settings);

  return data.accounts
    .filter(
      (account) =>
        account.is_active && !account.is_liability && CASH_ACCOUNT_TYPES.includes(account.account_type),
    )
    .map((account) => {
      const mine = all.filter((bucket) => bucket.accountId === account.id);
      const assigned = sumMoney(mine.map((bucket) => bucket.current));
      const balance = balances.get(account.id) ?? ZERO;
      return {
        account,
        balance,
        buckets: mine,
        assigned,
        unassigned: money(balance.minus(assigned)),
        overAssigned: assigned.greaterThan(balance),
      };
    })
    .sort((a, b) => b.balance.comparedTo(a.balance));
}

/** Buckets with no home account at all — they would otherwise vanish from the breakdown. */
export function unassignedBuckets(data: FinanceData, settings: Record<string, string> = {}): Bucket[] {
  return buckets(data, settings).filter((bucket) => bucket.accountId === null);
}

/** Total held across every bucket, whatever account it sits in. */
export function totalBucketed(data: FinanceData, settings: Record<string, string> = {}): Decimal {
  return sumMoney(buckets(data, settings).map((bucket) => bucket.current));
}

export function percentOfTotal(part: Decimal, whole: Decimal): number {
  if (whole.lessThanOrEqualTo(ZERO)) return 0;
  return Math.max(0, Math.min(100, dec(part).div(whole).times(100).toNumber()));
}
