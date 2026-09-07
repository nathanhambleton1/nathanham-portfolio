// Money arithmetic for the finance app.
//
// NexaFi's Python original does every financial calculation with `Decimal` and
// ROUND_HALF_UP, and its README promises the numbers are deterministic. Plain
// JS numbers are binary floats, so 0.1 + 0.2 !== 0.3 and a long chain of
// compounding drifts. decimal.js keeps the port arithmetically identical to the
// Python, function for function.

import Decimal from "decimal.js";

// 28 significant digits, matching Python's default Decimal context.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type Numeric = Decimal | number | string;

export const ZERO = new Decimal(0);
export const CENT = new Decimal("0.01");

/** Quantize to cents, half-up — the direct equivalent of NexaFi's `money()`. */
export function money(value: Numeric | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0).toDP(2);
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Quantize to `places`, half-up. Used for PTO hours (4dp) and quantities (8dp). */
export function quantize(value: Numeric, places: number): Decimal {
  return new Decimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}

export function dec(value: Numeric | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  return new Decimal(value);
}

export function sum(values: Iterable<Numeric>): Decimal {
  let total = new Decimal(0);
  for (const value of values) total = total.plus(new Decimal(value));
  return money(total);
}

export function maxDec(a: Numeric, b: Numeric): Decimal {
  return Decimal.max(new Decimal(a), new Decimal(b));
}

export function minDec(a: Numeric, b: Numeric): Decimal {
  return Decimal.min(new Decimal(a), new Decimal(b));
}

/** `percent_of` from planning.py — 0 when the whole is zero. */
export function percentOf(part: Numeric, whole: Numeric): Decimal {
  const w = new Decimal(whole);
  if (w.isZero()) return ZERO;
  return money(new Decimal(part).div(w).times(100));
}

// --- formatting -------------------------------------------------------------

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "$1,234.56" — the app's default money rendering. */
export function fmtMoney(value: Numeric | null | undefined): string {
  return currencyFormatter.format(money(value).toNumber());
}

/** "$1.2K" for tight spots like chart axes. */
export function fmtCompact(value: Numeric | null | undefined): string {
  return compactFormatter.format(money(value).toNumber());
}

/** Signed, for deltas: "+$40.00" / "-$40.00". */
export function fmtSigned(value: Numeric | null | undefined): string {
  const amount = money(value);
  const text = currencyFormatter.format(amount.abs().toNumber());
  return amount.isNegative() ? `-${text}` : `+${text}`;
}

export function fmtPercent(value: Numeric | null | undefined, places = 1): string {
  return `${quantize(dec(value), places).toFixed(places)}%`;
}

/** Whole dollars, no cents — used in the retirement projection table. */
export function fmtWhole(value: Numeric | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(money(value).toNumber());
}

/** Serialize for Postgres numeric columns — a plain fixed-point string. */
export function toNumeric(value: Numeric, places = 2): string {
  return quantize(dec(value), places).toFixed(places);
}
