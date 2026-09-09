// U.S. federal holidays, computed rather than stored — the same eleven dates
// fall out of the same rule every year, so there is nothing here for a person
// to maintain or a table row that could drift out of date.

import { daysInMonth, toISO, weekdayOf, type ISODate } from "./dates";

export interface Holiday {
  date: ISODate;
  name: string;
}

function nthWeekday(year: number, month: number, weekday: number, n: number): ISODate {
  let seen = 0;
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    if (weekdayOf(toISO(year, month, day)) === weekday) {
      seen += 1;
      if (seen === n) return toISO(year, month, day);
    }
  }
  throw new Error(`No ${n}th weekday ${weekday} in ${year}-${month}`);
}

function lastWeekday(year: number, month: number, weekday: number): ISODate {
  for (let day = daysInMonth(year, month); day >= 1; day -= 1) {
    if (weekdayOf(toISO(year, month, day)) === weekday) return toISO(year, month, day);
  }
  throw new Error(`No weekday ${weekday} in ${year}-${month}`);
}

/** The eleven federal holidays observed since Juneteenth was added in 2021. */
export function federalHolidays(year: number): Holiday[] {
  return [
    { date: toISO(year, 1, 1), name: "New Year's Day" },
    { date: nthWeekday(year, 1, 1, 3), name: "Martin Luther King Jr. Day" },
    { date: nthWeekday(year, 2, 1, 3), name: "Washington's Birthday" },
    { date: lastWeekday(year, 5, 1), name: "Memorial Day" },
    { date: toISO(year, 6, 19), name: "Juneteenth" },
    { date: toISO(year, 7, 4), name: "Independence Day" },
    { date: nthWeekday(year, 9, 1, 1), name: "Labor Day" },
    { date: nthWeekday(year, 10, 1, 2), name: "Columbus Day" },
    { date: toISO(year, 11, 11), name: "Veterans Day" },
    { date: nthWeekday(year, 11, 4, 4), name: "Thanksgiving Day" },
    { date: toISO(year, 12, 25), name: "Christmas Day" },
  ];
}

/** Holiday name by date, across every year `years` names. */
export function holidaysForYears(years: Iterable<number>): Map<ISODate, string> {
  const map = new Map<ISODate, string>();
  const seen = new Set<number>();
  for (const year of years) {
    if (seen.has(year)) continue;
    seen.add(year);
    for (const holiday of federalHolidays(year)) map.set(holiday.date, holiday.name);
  }
  return map;
}

export function isWeekend(value: ISODate): boolean {
  const day = weekdayOf(value);
  return day === 0 || day === 6;
}
