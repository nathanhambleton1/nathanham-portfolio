// Scheduled-paycheck helpers - a port of nexafi/services/paychecks.py, plus the
// retirement-ledger helpers that lived in app.py alongside it.
//
// The scheduler deliberately creates normal Paycheck rows. That keeps the
// generated entries visible in the same audit trail and lets a person amend an
// individual check when payroll differs from the baseline.

import { Decimal, ZERO, money, dec, quantize, toNumeric } from "./money";
import { addDays, todayISO, type ISODate } from "./dates";
import { employerMatch, ptoAccrual, roth401kContribution } from "./planning";
import { insertRow, T, updateRow } from "./db";
import type { FinanceData } from "./data";
import type { Paycheck, RetirementContribution } from "./types";

export const SCHEDULED_PAYCHECK_NOTE =
  "Automatically logged from the biweekly payroll schedule.";

export interface ScheduledPaycheckSync {
  created: Paycheck[];
  updated: Paycheck[];
  changed: boolean;
}

const EMPTY_SYNC: ScheduledPaycheckSync = { created: [], updated: [], changed: false };

/** The payroll baseline, or null when settings are missing or unusable. */
function readBaseline(settings: Record<string, string>) {
  const scheduleStart = settings.paycheck_schedule_start;
  if (!scheduleStart || !/^\d{4}-\d{2}-\d{2}$/.test(scheduleStart)) return null;

  const gross = money(settings.gross_pay_per_period ?? "0");
  const periods = Number(settings.pay_periods_per_year ?? "26");
  if (!Number.isFinite(periods)) return null;

  return {
    scheduleStart: scheduleStart as ISODate,
    gross,
    periods,
    hours: dec(settings.regular_hours_per_period ?? "80"),
    annualPto: dec(settings.annual_pto_hours ?? "0"),
    federalWithholding: money(settings.standard_federal_withholding ?? "391.58"),
    virginiaWithholding: money(settings.standard_virginia_withholding ?? "159.65"),
    socialSecurity: money(settings.standard_social_security ?? "202.52"),
    medicare: money(settings.standard_medicare ?? "47.36"),
    employeePercent: dec(settings.roth_401k_percent ?? "8"),
    employerPercent: dec(settings.employer_match_percent ?? "8"),
    otherDeductions: money(settings.standard_other_deductions ?? "0"),
    employer: (settings.employer_name ?? "").trim(),
  };
}

/**
 * Create each missing scheduled paycheck on or before `through`.
 *
 * A date that already has any paycheck is left alone. This prevents an
 * automatic entry from duplicating an imported or manually recorded actual
 * check, while still allowing the actual check to be edited in place.
 */
export async function backfillScheduledPaychecks(
  data: FinanceData,
  settings: Record<string, string>,
  options: { through?: ISODate } = {},
): Promise<ScheduledPaycheckSync> {
  if (!["true", "1", "yes"].includes((settings.automatic_paychecks_enabled ?? "true").toLowerCase())) {
    return EMPTY_SYNC;
  }

  const baseline = readBaseline(settings);
  if (!baseline) return EMPTY_SYNC;

  const through = options.through ?? todayISO();
  if (
    !baseline.employer ||
    baseline.gross.lessThanOrEqualTo(ZERO) ||
    baseline.periods < 1 ||
    baseline.scheduleStart > through
  ) {
    return EMPTY_SYNC;
  }

  const payDates: ISODate[] = [];
  for (let current = baseline.scheduleStart; current <= through; current = addDays(current, 14)) {
    payDates.push(current);
  }
  if (payDates.length === 0) return EMPTY_SYNC;

  const ptoPerPaycheck = ptoAccrual(baseline.annualPto, baseline.periods);
  const roth = roth401kContribution(baseline.gross, baseline.employeePercent);
  const match = employerMatch(baseline.gross, baseline.employeePercent, baseline.employerPercent);
  const net = money(
    baseline.gross
      .minus(baseline.federalWithholding)
      .minus(baseline.virginiaWithholding)
      .minus(baseline.socialSecurity)
      .minus(baseline.medicare)
      .minus(roth)
      .minus(baseline.otherDeductions),
  );
  // A baseline that nets nothing is a misconfiguration, not a paycheck.
  if (net.lessThanOrEqualTo(ZERO)) return EMPTY_SYNC;

  const baselineFor = (payDate: ISODate) => ({
    pay_period_start: addDays(payDate, -13),
    pay_period_end: payDate,
    employer: baseline.employer,
    regular_hours: toNumeric(baseline.hours, 2),
    gross_amount: toNumeric(baseline.gross),
    net_amount: toNumeric(net),
    federal_withholding: toNumeric(baseline.federalWithholding),
    virginia_withholding: toNumeric(baseline.virginiaWithholding),
    social_security: toNumeric(baseline.socialSecurity),
    medicare: toNumeric(baseline.medicare),
    roth_401k: toNumeric(roth),
    employer_401k_match: toNumeric(match),
    other_deductions: toNumeric(baseline.otherDeductions),
    pto_earned: toNumeric(ptoPerPaycheck, 4),
    pto_used: toNumeric(ZERO, 4),
  });

  const existing = data.paychecks.filter(
    (p) => p.pay_date >= baseline.scheduleStart && p.pay_date <= through,
  );
  const created: Paycheck[] = [];
  const updated: Paycheck[] = [];

  for (const payDate of payDates) {
    const values = baselineFor(payDate);
    const scheduled = existing.find(
      (item) => item.pay_date === payDate && item.notes === SCHEDULED_PAYCHECK_NOTE,
    );

    if (scheduled) {
      // Only write when the baseline actually moved, so an unchanged visit
      // makes no requests at all.
      const drifted = Object.entries(values).some(
        ([field, value]) => normalise(scheduled[field as keyof Paycheck]) !== normalise(value),
      );
      if (drifted) {
        const row = await updateRow<Paycheck>(T.paychecks, scheduled.id, values);
        Object.assign(scheduled, row);
        updated.push(row);
      }
      continue;
    }

    // Some other paycheck already covers this date - leave it alone.
    if (existing.some((item) => item.pay_date === payDate)) continue;

    const row = await insertRow<Paycheck>(T.paychecks, {
      pay_date: payDate,
      notes: SCHEDULED_PAYCHECK_NOTE,
      ...values,
    });
    created.push(row);
    existing.push(row);
    data.paychecks.push(row);
  }

  return { created, updated, changed: created.length > 0 || updated.length > 0 };
}

/** Compare numerics by value, not by the string Postgres happened to return. */
function normalise(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) return new Decimal(value).toString();
  if (typeof value === "number") return new Decimal(value).toString();
  return String(value);
}

// --- retirement ledger ------------------------------------------------------

/** The account the 401(k) ledger posts against, matched by name as in the original. */
function retirementAccountId(data: FinanceData): number | null {
  return data.accounts.find((a) => a.name === "Roth 401(k)" && a.is_active)?.id ?? null;
}

/** Keep the 401(k) activity ledger in step with a newly logged paycheck. */
export async function recordRetirementContribution(
  data: FinanceData,
  paycheck: Paycheck,
): Promise<void> {
  const accountId = retirementAccountId(data);
  if (accountId === null) return;

  const employee = dec(paycheck.roth_401k);
  const employer = dec(paycheck.employer_401k_match);
  if (employee.isZero() && employer.isZero()) return;

  const row = await insertRow<RetirementContribution>(T.retirementContributions, {
    contribution_date: paycheck.pay_date,
    account_id: accountId,
    employee_amount: toNumeric(employee),
    employer_match: toNumeric(employer),
    contribution_type: "roth",
  });
  data.retirementContributions.push(row);
}

/** Update the matching activity entry when a paycheck is corrected. */
export async function updateRetirementContribution(
  data: FinanceData,
  paycheck: Paycheck,
  options: { originalPayDate?: ISODate | null } = {},
): Promise<void> {
  const accountId = retirementAccountId(data);
  if (accountId === null) return;

  const onDate = options.originalPayDate ?? paycheck.pay_date;
  const contribution = [...data.retirementContributions]
    .filter((c) => c.account_id === accountId && c.contribution_date === onDate)
    .sort((a, b) => b.id - a.id)[0];

  if (!contribution) {
    await recordRetirementContribution(data, paycheck);
    return;
  }

  const row = await updateRow<RetirementContribution>(T.retirementContributions, contribution.id, {
    contribution_date: paycheck.pay_date,
    employee_amount: toNumeric(paycheck.roth_401k),
    employer_match: toNumeric(paycheck.employer_401k_match),
  });
  Object.assign(contribution, row);
}

// --- PTO --------------------------------------------------------------------

export interface PtoState {
  accrual: Decimal;
  current: Decimal;
  projected: Decimal;
}

/**
 * PTO balance from the beginning-of-year figure plus what each paycheck earned,
 * less what was used. Precision is kept at four decimals internally; the pages
 * round only for display.
 */
export function ptoState(
  data: FinanceData,
  settings: Record<string, string>,
  year: number,
): PtoState {
  const periods = Number(settings.pay_periods_per_year ?? "26") || 26;
  const annual = dec(settings.annual_pto_hours ?? "0");
  const beginning = dec(settings.pto_beginning_balance ?? "0");
  const accrual = ptoAccrual(annual, periods);

  const inYear = data.paychecks.filter((p) => p.pay_date.startsWith(String(year)));
  let earned = new Decimal(0);
  let used = new Decimal(0);
  for (const paycheck of inYear) {
    earned = earned.plus(paycheck.pto_earned);
    used = used.plus(paycheck.pto_used);
  }

  const current = quantize(beginning.plus(earned).minus(used), 4);
  const remainingPeriods = Math.max(0, periods - inYear.length);
  return {
    accrual,
    current,
    projected: quantize(current.plus(accrual.times(remainingPeriods)), 4),
  };
}
