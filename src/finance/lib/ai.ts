// Verified monthly metrics and the commentary workflow.
// A port of nexafi/services/ai.py.
//
// ONE CAPABILITY DOES NOT PORT. The Python could call an LLM directly using a
// server-held API key (`extract_document_with_api`, `generate_monthly_commentary`).
// This app is a static bundle served from a public URL: any key it held would be
// readable by anyone who opened devtools, and would be billable by them too.
// There is no safe way to keep that button.
//
// What is kept is everything that made the feature trustworthy in the first
// place. The metrics below are computed deterministically and are the
// authoritative numbers; the prompt is generated for you to paste into Claude or
// any other model; the response is validated against the same schema before it
// is stored. The original already treated this manual path as fully supported -
// "No API key configured—manual mode is fully available" - so this is the same
// workflow with one shortcut removed, not a reduced feature.

import { Decimal, ZERO, dec, money, sum as sumMoney } from "./money";
import { monthBounds, planMonthOf, shiftMonths, type ISODate } from "./dates";
import { categorySpending, monthlyTotals } from "./finance";
import { insightCommentarySchema, type InsightCommentary } from "./importSchema";
import { upsertRow, T, updateRow } from "./db";
import type { FinanceData } from "./data";
import type { MonthlyAIInsight } from "./types";

export class AIProviderError extends Error {}

const moneyString = (value: Decimal) => money(value).toFixed(2);
const decimalString = (value: Decimal) => value.toFixed(2);

function percentChange(current: Decimal, previous: Decimal): string | null {
  if (previous.isZero()) return null;
  return decimalString(current.minus(previous).div(previous).times(100));
}

export interface VerifiedMetrics {
  verified_by: string;
  month: ISODate;
  income: string;
  spending: string;
  surplus: string;
  savings_rate_percent: string;
  retirement_contributions: string;
  investment_contributions: string;
  retirement_rate_percent: string;
  categories: Record<string, { current: string; three_month_average: string; change_percent: string | null }>;
  month_over_month: { income_change_percent: string | null; spending_change_percent: string | null };
  goals: Record<string, { current: string; target: string; progress_percent: string }>;
  unusual_transactions: { date: ISODate; merchant: string; amount: string; category: string | null }[];
  subscription_changes: {
    merchant: string; type: string; amount: string | null; previous_amount: string | null; status: string;
  }[];
  instructions: string;
}

/** A transaction this large is worth calling out by name in a review. */
const UNUSUAL_THRESHOLD = new Decimal(250);

/**
 * Everything a reviewer needs, computed here rather than by the model.
 *
 * The `instructions` field is deliberately part of the payload: it tells the
 * model that these numbers are authoritative and must not be recalculated.
 */
export function buildVerifiedMetrics(data: FinanceData, monthIn: ISODate): VerifiedMetrics {
  const month = planMonthOf(monthIn);
  const totals = monthlyTotals(data, month);
  const previousTotals = monthlyTotals(data, shiftMonths(month, 1));

  const categories = new Map(categorySpending(data, month));

  // The three months before this one, for a trend the model can cite.
  const priorRows: Map<string, Decimal>[] = [];
  let cursor = shiftMonths(month, 1);
  for (let index = 0; index < 3; index += 1) {
    priorRows.push(new Map(categorySpending(data, cursor)));
    cursor = shiftMonths(cursor, 1);
  }

  const categoryMetrics: VerifiedMetrics["categories"] = {};
  for (const [name, amount] of categories) {
    const average = priorRows
      .reduce((total, rows) => total.plus(rows.get(name) ?? ZERO), ZERO)
      .div(3);
    categoryMetrics[name] = {
      current: moneyString(amount),
      three_month_average: moneyString(average),
      change_percent: average.isZero()
        ? null
        : decimalString(amount.minus(average).div(average).times(100)),
    };
  }

  const [start, end] = monthBounds(month);
  const paychecks = data.paychecks.filter((row) => row.pay_date >= start && row.pay_date <= end);

  let retirement = sumMoney(
    paychecks.map((row) => dec(row.roth_401k).plus(row.employer_401k_match)),
  );
  // With no paychecks that month, fall back to the contributions ledger so a
  // manually recorded contribution still shows up.
  if (paychecks.length === 0) {
    retirement = sumMoney(
      data.retirementContributions
        .filter((row) => row.contribution_date >= start && row.contribution_date <= end)
        .map((row) => row.employee_amount),
    );
  }

  const investmentContributions = sumMoney(
    data.investmentTransactions
      .filter(
        (row) =>
          row.transaction_date >= start &&
          row.transaction_date <= end &&
          ["contribution", "buy"].includes(row.transaction_type),
      )
      .map((row) => row.amount),
  );

  const grossTotal = sumMoney(paychecks.map((row) => row.gross_amount));

  const goals: VerifiedMetrics["goals"] = {};
  for (const goal of data.goals.filter((row) => row.is_active)) {
    const target = dec(goal.target_amount);
    goals[goal.goal_type] = {
      current: moneyString(dec(goal.current_amount)),
      target: moneyString(target),
      progress_percent: decimalString(
        target.isZero() ? ZERO : dec(goal.current_amount).div(target).times(100),
      ),
    };
  }

  const categoryNameFor = (id: number | null) =>
    id ? (data.categories.find((row) => row.id === id)?.name ?? null) : null;

  const unusual = data.transactions
    .filter(
      (row) =>
        row.transaction_date >= start &&
        row.transaction_date <= end &&
        !row.is_transfer &&
        row.transaction_type === "expense" &&
        dec(row.amount).greaterThanOrEqualTo(UNUSUAL_THRESHOLD),
    )
    .sort((a, b) => dec(b.amount).comparedTo(dec(a.amount)))
    .slice(0, 10)
    .map((row) => ({
      date: row.transaction_date,
      merchant: row.merchant || row.description,
      amount: moneyString(dec(row.amount)),
      category: categoryNameFor(row.category_id),
    }));

  const subscriptionChanges = data.recurringSuggestions
    .filter((row) => row.created_at >= start)
    .map((row) => ({
      merchant: row.merchant,
      type: row.suggestion_type,
      amount: row.amount === null ? null : moneyString(dec(row.amount)),
      previous_amount: row.previous_amount === null ? null : moneyString(dec(row.previous_amount)),
      status: row.status,
    }));

  return {
    verified_by: "NexaFi deterministic calculation engine",
    month,
    income: moneyString(totals.income),
    spending: moneyString(totals.spending),
    surplus: moneyString(totals.surplus),
    savings_rate_percent: decimalString(totals.savingsRate),
    retirement_contributions: moneyString(retirement),
    investment_contributions: moneyString(investmentContributions),
    retirement_rate_percent: decimalString(
      grossTotal.isZero() ? ZERO : retirement.div(grossTotal).times(100),
    ),
    categories: categoryMetrics,
    month_over_month: {
      income_change_percent: percentChange(totals.income, previousTotals.income),
      spending_change_percent: percentChange(totals.spending, previousTotals.spending),
    },
    goals,
    unusual_transactions: unusual,
    subscription_changes: subscriptionChanges,
    instructions: "Treat every numeric value as authoritative. Do not recalculate totals.",
  };
}

export function monthlyReviewPrompt(metrics: VerifiedMetrics): string {
  return `Write a balanced, evidence-based monthly financial review using only the verified facts below.
Do not recalculate or replace any numeric value. Do not invent criticism. It is acceptable to say no
major changes are needed. Explain material changes in context and distinguish observations from advice.
Return only JSON with these sections: overall_assessment, wins, watch_items, opportunities,
unusual_activity, recommended_actions.

VERIFIED NEXAFI METRICS:
${JSON.stringify(metrics, null, 2)}
`;
}

/** Freeze this month's verified facts before any commentary is written about them. */
export async function saveMetricsSnapshot(
  data: FinanceData,
  monthIn: ISODate,
): Promise<MonthlyAIInsight> {
  const month = planMonthOf(monthIn);
  const metrics = buildVerifiedMetrics(data, month);

  const row = await upsertRow<MonthlyAIInsight>(
    T.aiInsights,
    {
      snapshot_month: month,
      metrics_json: JSON.stringify(metrics),
      status: "metrics_ready",
    },
    "owner,snapshot_month",
  );

  const existing = data.aiInsights.find((item) => item.snapshot_month === month);
  if (existing) Object.assign(existing, row);
  else data.aiInsights.push(row);

  return row;
}

/** Validate pasted commentary against the schema before it becomes history. */
export async function saveManualCommentary(
  data: FinanceData,
  insight: MonthlyAIInsight,
  content: string,
  options: { source?: string; model?: string | null } = {},
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new AIProviderError(
      `That is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = insightCommentarySchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const location = first.path.join(".") || "commentary";
    throw new AIProviderError(`Invalid commentary JSON at ${location}: ${first.message}`);
  }

  const row = await updateRow<MonthlyAIInsight>(T.aiInsights, insight.id, {
    commentary_json: JSON.stringify(result.data),
    status: "complete",
    source: options.source ?? "manual",
    model: options.model ?? null,
  });
  Object.assign(insight, row);
}

export function insightPayload(insight: MonthlyAIInsight | null): InsightCommentary | null {
  if (!insight?.commentary_json) return null;
  try {
    return JSON.parse(insight.commentary_json) as InsightCommentary;
  } catch {
    return null;
  }
}

export function insightMetrics(insight: MonthlyAIInsight | null): VerifiedMetrics | null {
  if (!insight?.metrics_json) return null;
  try {
    return JSON.parse(insight.metrics_json) as VerifiedMetrics;
  } catch {
    return null;
  }
}
