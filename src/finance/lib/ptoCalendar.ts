// Balance-at-a-date projections and PTO entry math for the PTO calendar page.
//
// The actual balance and accrual rate come from ptoState/ptoAccrual, which read
// real paychecks — this layer only adds what those don't need to know about: a
// logged entry's hours (weekends and federal holidays inside it are free, the
// way a real vacation request works), and what the balance will be on a future
// date once scheduled accrual and any planned entries between now and then are
// applied.

import { Decimal, ZERO, dec, maxDec, quantize } from "./money";
import { addDays, parts, todayISO, type ISODate } from "./dates";
import { ptoAccrual } from "./planning";
import { holidaysForYears, isWeekend } from "./holidays";
import type { PtoEntry, PtoLeaveType } from "./types";

/**
 * Leave types that never draw from the PTO bank: flex is paid back as extra
 * work the same period, a paid holiday was never PTO to begin with, and
 * unpaid time isn't paid from the bank either — it's just logged as a record
 * of the day, with no hours coming out of the balance for any of the three.
 */
export const BALANCE_EXEMPT_LEAVE_TYPES: ReadonlySet<PtoLeaveType> = new Set(["flex", "paid_holiday", "unpaid"]);

/** Whole days from `a` to `b`, positive when `b` is later. */
function daysBetween(a: ISODate, b: ISODate): number {
  const from = parts(a);
  const to = parts(b);
  const ms = Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day);
  return Math.round(ms / 86_400_000);
}

/** Hours an entry spends within `[from, to]`, excluding weekends and holidays. */
export function entryHours(
  entry: PtoEntry,
  from: ISODate = entry.start_date,
  to: ISODate = entry.end_date,
): Decimal {
  const start = entry.start_date > from ? entry.start_date : from;
  const end = entry.end_date < to ? entry.end_date : to;
  if (start > end) return ZERO;

  const years = new Set<number>();
  for (let d = start; d <= end; d = addDays(d, 1)) years.add(Number(d.slice(0, 4)));
  const holidays = holidaysForYears(years);

  const perDay = dec(entry.hours_per_day);
  let total = ZERO;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (!isWeekend(d) && !holidays.has(d)) total = total.plus(perDay);
  }
  return quantize(total, 2);
}

/** Every entry whose range covers `date`. */
export function entriesOn(entries: PtoEntry[], date: ISODate): PtoEntry[] {
  return entries.filter((entry) => entry.start_date <= date && entry.end_date >= date);
}

/**
 * Dates on the app's fixed biweekly cadence — see backfillScheduledPaychecks
 * — offset `daysBeforePayDate` from each pay date. A period's start is 18 days
 * before its pay date (pay lags the period by a following-Friday pay run); its
 * end, the day PTO for it is actually available, is 5 days before that same
 * pay date.
 */
function biweeklyDates(scheduleStart: ISODate, daysBeforePayDate: number, after: ISODate, through: ISODate): ISODate[] {
  const dates: ISODate[] = [];
  let current = addDays(scheduleStart, -daysBeforePayDate);
  while (current <= after) current = addDays(current, 14);
  while (current <= through) {
    dates.push(current);
    current = addDays(current, 14);
  }
  return dates;
}

function biweeklyDatesInRange(
  scheduleStart: ISODate,
  daysBeforePayDate: number,
  rangeStart: ISODate,
  rangeEnd: ISODate,
): Set<ISODate> {
  const anchor = addDays(scheduleStart, -daysBeforePayDate);
  const steps = Math.floor(daysBetween(anchor, rangeStart) / 14) - 1;
  let current = addDays(anchor, steps * 14);
  const dates = new Set<ISODate>();
  while (current <= rangeEnd) {
    if (current >= rangeStart) dates.add(current);
    current = addDays(current, 14);
  }
  return dates;
}

function validScheduleStart(settings: Record<string, string>): ISODate | null {
  const value = settings.paycheck_schedule_start;
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * The first day of every biweekly pay period within `[rangeStart, rangeEnd]` —
 * a Monday, 18 days before the pay date that eventually covers it. Computed
 * rather than read from fin_paychecks so a period still shows before payroll
 * has caught up to it.
 */
export function payPeriodStartsInRange(
  settings: Record<string, string>,
  rangeStart: ISODate,
  rangeEnd: ISODate,
): Set<ISODate> {
  const scheduleStart = validScheduleStart(settings);
  return scheduleStart ? biweeklyDatesInRange(scheduleStart, 18, rangeStart, rangeEnd) : new Set();
}

/**
 * The day PTO for a closed period actually becomes available — the Sunday the
 * period ends, five days before the paycheck that eventually pays it lands.
 */
export function ptoAvailableDatesInRange(
  settings: Record<string, string>,
  rangeStart: ISODate,
  rangeEnd: ISODate,
): Set<ISODate> {
  const scheduleStart = validScheduleStart(settings);
  return scheduleStart ? biweeklyDatesInRange(scheduleStart, 5, rangeStart, rangeEnd) : new Set();
}

/** The Monday–Sunday pay period that contains `date`, or null with no schedule configured. */
export function payPeriodContaining(
  settings: Record<string, string>,
  date: ISODate,
): { start: ISODate; end: ISODate } | null {
  const scheduleStart = validScheduleStart(settings);
  if (!scheduleStart) return null;

  const firstPeriodStart = addDays(scheduleStart, -18);
  const periodIndex = Math.floor(daysBetween(firstPeriodStart, date) / 14);
  const start = addDays(firstPeriodStart, periodIndex * 14);
  return { start, end: addDays(start, 13) };
}

// --- flex time ----------------------------------------------------------

/** You can flex away at most a full day at once, and two full days across a period. */
export const FLEX_MAX_HOURS_PER_DAY = 8;
export const FLEX_MAX_HOURS_PER_PERIOD = 16;

/** Hours logged as "flex" within `[periodStart, periodEnd]`, across every entry that overlaps it. */
export function flexHoursInPeriod(
  entries: PtoEntry[],
  periodStart: ISODate,
  periodEnd: ISODate,
  excludeEntryId?: number,
): Decimal {
  return entries
    .filter((entry) => entry.leave_type === "flex" && entry.id !== excludeEntryId)
    .reduce((total, entry) => total.plus(entryHours(entry, periodStart, periodEnd)), ZERO);
}

/**
 * A flexed hour isn't PTO the bank pays for — it's owed back as extra work,
 * spread evenly over whichever days in the same pay period you're actually
 * still working (not a weekend, not a holiday, not already covered by any
 * logged entry, flex or otherwise). Empty when nothing was flexed, or when the
 * whole period is already spoken for.
 */
export function flexMakeupPerDay(
  entries: PtoEntry[],
  periodStart: ISODate,
  periodEnd: ISODate,
): Map<ISODate, Decimal> {
  const flexHours = flexHoursInPeriod(entries, periodStart, periodEnd);
  const makeup = new Map<ISODate, Decimal>();
  if (flexHours.isZero()) return makeup;

  const years = new Set<number>();
  for (let d = periodStart; d <= periodEnd; d = addDays(d, 1)) years.add(Number(d.slice(0, 4)));
  const holidays = holidaysForYears(years);

  const eligibleDays: ISODate[] = [];
  for (let d = periodStart; d <= periodEnd; d = addDays(d, 1)) {
    if (isWeekend(d) || holidays.has(d)) continue;
    if (entriesOn(entries, d).length > 0) continue;
    eligibleDays.push(d);
  }
  if (eligibleDays.length === 0) return makeup;

  const perDay = quantize(flexHours.div(eligibleDays.length), 2);
  for (const day of eligibleDays) makeup.set(day, perDay);
  return makeup;
}

/**
 * A period's accrual, prorated down by any unpaid time inside it. PTO accrues
 * on hours actually worked, so a period with unpaid days earns less than the
 * full per-period rate — never negative, and untouched when nothing unpaid
 * was logged against it.
 */
export function periodAccrual(
  entries: PtoEntry[],
  fullAccrual: Decimal,
  regularHours: Decimal,
  periodStart: ISODate,
  periodEnd: ISODate,
): Decimal {
  if (regularHours.lessThanOrEqualTo(0)) return fullAccrual;

  const unpaidHours = entries
    .filter((entry) => entry.leave_type === "unpaid")
    .reduce((total, entry) => total.plus(entryHours(entry, periodStart, periodEnd)), ZERO);
  if (unpaidHours.isZero()) return fullAccrual;

  const workedFraction = maxDec(ZERO, regularHours.minus(unpaidHours)).div(regularHours);
  return quantize(fullAccrual.times(workedFraction), 4);
}

/**
 * Projected balance at a future (or today's) date: today's actual balance,
 * plus each pay period that will have *closed* — not been paid out, closed —
 * between now and then contributing its accrual (prorated down by any unpaid
 * time logged in that period — see periodAccrual), less the hours of any
 * planned entry that falls in that same window and actually draws from the
 * bank — see BALANCE_EXEMPT_LEAVE_TYPES for what's excluded from that
 * deduction.
 *
 * Accrual is keyed to the period's end rather than its pay date because that's
 * when the hours are actually available: a period that ends this Sunday adds
 * to the balance right away, even though the paycheck for it doesn't land
 * until the following Friday.
 *
 * A date on or before today returns today's balance rather than attempting a
 * day-by-day historical reconstruction the paycheck ledger — recorded every
 * two weeks, not daily — can't actually support.
 */
export function projectedBalance(
  currentBalance: Decimal,
  entries: PtoEntry[],
  settings: Record<string, string>,
  targetDate: ISODate,
  today: ISODate = todayISO(),
): Decimal {
  if (targetDate <= today) return currentBalance;

  let balance = currentBalance;
  const scheduleStart = validScheduleStart(settings);
  if (scheduleStart) {
    const periods = Number(settings.pay_periods_per_year ?? "26") || 26;
    const annual = dec(settings.annual_pto_hours ?? "0");
    const fullAccrual = ptoAccrual(annual, periods);
    const regularHours = dec(settings.regular_hours_per_period ?? "80");

    for (const periodEnd of biweeklyDates(scheduleStart, 5, today, targetDate)) {
      const periodStart = addDays(periodEnd, -13);
      balance = balance.plus(periodAccrual(entries, fullAccrual, regularHours, periodStart, periodEnd));
    }
  }

  for (const entry of entries) {
    if (BALANCE_EXEMPT_LEAVE_TYPES.has(entry.leave_type)) continue;
    if (entry.start_date > today) {
      balance = balance.minus(entryHours(entry, addDays(today, 1), targetDate));
    }
  }
  return quantize(balance, 2);
}
