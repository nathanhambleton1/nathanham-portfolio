// Calendar-date helpers.
//
// Every date in this app is an ISO "YYYY-MM-DD" string, never a JS Date. A
// Postgres `date` has no time and no zone; parsing one into a Date makes it
// midnight UTC, which renders as the *previous day* anywhere west of London and
// would silently shift transactions into the wrong month. Strings sidestep the
// whole class of bug, and they compare correctly with plain `<` / `>`.

export type ISODate = string; // YYYY-MM-DD

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function todayISO(): ISODate {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function toISO(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parts(value: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First and last day of `value`'s month — `month_bounds` in finance.py. */
export function monthBounds(value: ISODate): [ISODate, ISODate] {
  const { year, month } = parts(value);
  return [toISO(year, month, 1), toISO(year, month, daysInMonth(year, month))];
}

/** First day of `value`'s month — `plan_month_of` in allocation.py. */
export function planMonthOf(value: ISODate): ISODate {
  const { year, month } = parts(value);
  return toISO(year, month, 1);
}

/** First day of the month `monthsBack` before `value` — `shift_months`. */
export function shiftMonths(value: ISODate, monthsBack: number): ISODate {
  const { year, month } = parts(value);
  const index = month - 1 - monthsBack;
  return toISO(year + Math.floor(index / 12), ((index % 12) + 12) % 12 + 1, 1);
}

/** Add months, clamping the day to the target month's length — `_add_months`. */
export function addMonths(value: ISODate, months: number): ISODate {
  const { year, month, day } = parts(value);
  const index = month - 1 + months;
  const targetYear = year + Math.floor(index / 12);
  const targetMonth = ((index % 12) + 12) % 12 + 1;
  return toISO(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
}

export function addDays(value: ISODate, days: number): ISODate {
  const { year, month, day } = parts(value);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return toISO(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Whole months from `asOf` until `dueDate`, floored at 1 — `months_until_due`. */
export function monthsUntilDue(dueDate: ISODate, asOf: ISODate): number {
  if (dueDate <= asOf) return 1;
  const due = parts(dueDate);
  const now = parts(asOf);
  let difference = (due.year - now.year) * 12 + due.month - now.month;
  if (due.day > now.day) difference += 1;
  return Math.max(1, difference);
}

export function isBetween(value: ISODate, start: ISODate, end: ISODate): boolean {
  return value >= start && value <= end;
}

/** 0 (Sunday) through 6 (Saturday). */
export function weekdayOf(value: ISODate): number {
  const { year, month, day } = parts(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// --- formatting -------------------------------------------------------------

/** "Sep 7, 2026" */
export function fmtDate(value: ISODate | null | undefined): string {
  if (!value) return "—";
  const { year, month, day } = parts(value);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${day}, ${year}`;
}

/** "September 2026" — month headings and plan labels. */
export function fmtMonth(value: ISODate | null | undefined): string {
  if (!value) return "—";
  const { year, month } = parts(value);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "Sep 2026" — chart axes. */
export function fmtMonthShort(value: ISODate | null | undefined): string {
  if (!value) return "—";
  const { year, month } = parts(value);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`;
}

/** "Monday, September 07" — the topbar date line. */
export function fmtLongDay(value: ISODate): string {
  const { year, month, day } = parts(value);
  const weekday = DAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${MONTH_NAMES[month - 1]} ${String(day).padStart(2, "0")}`;
}

export function yearOf(value: ISODate): number {
  return parts(value).year;
}
