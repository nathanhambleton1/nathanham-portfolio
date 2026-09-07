// Reporting helpers - net-worth attribution and the monthly snapshot.

import { Decimal, ZERO, money, toNumeric } from "./money";
import { planMonthOf, todayISO } from "./dates";
import { liquidCash, monthlyTotals, netWorth } from "./finance";
import { upsertRow, T } from "./db";
import type { FinanceData } from "./data";
import type { Account, MonthlySnapshot } from "./types";

export interface NetWorthAttribution {
  account: Account;
  previousBalance: Decimal;
  currentBalance: Decimal;
  change: Decimal;
}

/**
 * What moved net worth, account by account.
 *
 * Compares each account's two most recent balance snapshots. Liabilities are
 * negated first so a shrinking card balance reads as a positive change, which
 * is what it is. Ordered by the size of the move, largest first, because the
 * question the page answers is "what changed", not "which account is biggest".
 */
export function netWorthAttribution(data: FinanceData): NetWorthAttribution[] {
  const result: NetWorthAttribution[] = [];

  for (const account of data.accounts.filter((a) => a.is_active && a.include_in_net_worth)) {
    const balances = data.accountBalances
      .filter((row) => row.account_id === account.id)
      .sort((a, b) =>
        a.balance_date === b.balance_date ? b.id - a.id : a.balance_date < b.balance_date ? 1 : -1,
      )
      .slice(0, 2);

    if (balances.length === 0) continue;

    const sign = account.is_liability ? -1 : 1;
    const currentBalance = money(new Decimal(balances[0].balance).times(sign));
    const previousBalance = money(
      (balances.length > 1 ? new Decimal(balances[1].balance) : ZERO).times(sign),
    );

    result.push({
      account,
      previousBalance,
      currentBalance,
      change: money(currentBalance.minus(previousBalance)),
    });
  }

  return result.sort((a, b) => b.change.abs().comparedTo(a.change.abs()));
}

/**
 * Freeze the current month into reporting history.
 *
 * Upsert rather than insert: re-closing a month that is still in progress is a
 * normal thing to do, and it should refresh the figures rather than fail.
 */
export async function saveMonthlySnapshot(data: FinanceData): Promise<MonthlySnapshot> {
  const today = todayISO();
  const month = planMonthOf(today);
  const totals = monthlyTotals(data, today);

  const values = {
    snapshot_month: month,
    net_worth: toNumeric(netWorth(data)),
    liquid_cash: toNumeric(liquidCash(data)),
    income: toNumeric(totals.income),
    spending: toNumeric(totals.spending),
  };

  const row = await upsertRow<MonthlySnapshot>(T.monthlySnapshots, values, "owner,snapshot_month");

  const existing = data.monthlySnapshots.find((item) => item.snapshot_month === month);
  if (existing) Object.assign(existing, row);
  else data.monthlySnapshots.push(row);

  return row;
}
