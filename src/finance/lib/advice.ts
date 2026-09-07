// Advisory helpers that lived alongside the routes in app.py.
//
// These read settings and current state to feed the pure waterfall in
// planning.ts. Nothing here initiates a transfer - the dashboard says so
// explicitly, and that stays true.

import { Decimal, ZERO, dec, maxDec, money, sum as sumMoney } from "./money";
import { todayISO } from "./dates";
import { monthEndRecommendation, requiredSinkingContribution, type MonthlyTotals } from "./finance";
import { allocationRecommendation, type AllocationPlan } from "./planning";
import type { FinanceData } from "./data";

/**
 * The recommended split of this month's surplus.
 *
 * Settings supply the editable targets; everything else is derived from current
 * balances. The employer-match flag is a comparison of two payroll percentages,
 * not a cash figure, which is why it produces advice rather than an allocation.
 */
export function buildAllocation(data: FinanceData, totals: MonthlyTotals): AllocationPlan {
  const settings = data.settings;
  const today = todayISO();

  const emergency = data.goals.find((goal) => goal.goal_type === "emergency");
  const emergencyTarget = dec(settings.emergency_recommended_target ?? "0");
  const emergencyGap = maxDec(
    ZERO,
    emergencyTarget.minus(emergency ? dec(emergency.current_amount) : ZERO),
  );

  const requiredSinking = sumMoney(
    data.sinkingFunds
      .filter((fund) => fund.is_active)
      .map((fund) =>
        requiredSinkingContribution(fund.target_amount, fund.current_amount, fund.due_date, today),
      ),
  );

  const outlook = monthEndRecommendation(data, today);

  return allocationRecommendation(maxDec(ZERO, totals.surplus), {
    requiredBills: outlook.upcomingBills,
    cardStatements: outlook.upcomingCardPayments,
    emergencyGap: money(emergencyGap),
    sinkingFunds: requiredSinking,
    travelTarget: dec(settings.travel_recommended_monthly ?? "0"),
    rothIraTarget: dec(settings.ira_user_monthly_target ?? "0"),
    houseTarget: dec(settings.house_user_monthly_target ?? "0"),
    brokerageTarget: dec(settings.brokerage_user_monthly_target ?? "0"),
    employerMatchCaptured: dec(settings.roth_401k_percent ?? "0").greaterThanOrEqualTo(
      dec(settings.employer_match_percent ?? "0"),
    ),
  });
}

/** Monthly snapshots shaped for the chart components. */
export function snapshotPoints(data: FinanceData) {
  return [...data.monthlySnapshots]
    .sort((a, b) => (a.snapshot_month < b.snapshot_month ? -1 : 1))
    .map((snapshot) => ({
      month: snapshot.snapshot_month,
      income: new Decimal(snapshot.income).toNumber(),
      spending: new Decimal(snapshot.spending).toNumber(),
      netWorth: new Decimal(snapshot.net_worth).toNumber(),
      liquidCash: new Decimal(snapshot.liquid_cash).toNumber(),
    }));
}
