// Deterministic planning math — a direct port of nexafi/services/planning.py.
//
// Everything here is a pure function of its arguments: no database, no clock
// beyond an explicitly passed date. That is what makes the figures reproducible
// and testable, and it is why the port stays function-for-function faithful to
// the Python rather than being "modernised" along the way.

import { Decimal, ZERO, money, quantize, dec, minDec, maxDec, percentOf } from "./money";
import type { Bracket, TaxYearRules } from "./taxRules";
import { addMonths, todayISO, type ISODate } from "./dates";

export { percentOf };

/** Tax each slice of nonnegative income at its configured marginal rate. */
export function progressiveTax(taxableIncome: Decimal, brackets: Bracket[]): Decimal {
  const taxable = maxDec(0, taxableIncome);
  let total = new Decimal(0);
  let floor = new Decimal(0);
  for (const [ceiling, rate] of brackets) {
    const upper = ceiling === null ? taxable : minDec(taxable, ceiling);
    if (upper.greaterThan(floor)) total = total.plus(upper.minus(floor).times(rate));
    if (ceiling === null || taxable.lessThanOrEqualTo(ceiling)) break;
    floor = ceiling;
  }
  return money(total);
}

export function federalIncomeTax(grossIncome: Decimal, rules: TaxYearRules): Decimal {
  return progressiveTax(maxDec(0, grossIncome.minus(rules.federalStandardDeduction)), rules.federalBrackets);
}

export function virginiaIncomeTax(grossIncome: Decimal, rules: TaxYearRules): Decimal {
  return progressiveTax(maxDec(0, grossIncome.minus(rules.virginiaStandardDeduction)), rules.virginiaBrackets);
}

export interface FicaResult {
  socialSecurity: Decimal;
  medicare: Decimal;
  total: Decimal;
}

/**
 * Social Security stops at the wage base; Medicare does not, and gains an extra
 * rate above a threshold. `priorWages` is year-to-date wages before this
 * paycheck, so both caps are applied against the right point on the year.
 */
export function ficaTax(wagesIn: Decimal, rules: TaxYearRules, priorWagesIn: Decimal = ZERO): FicaResult {
  const wages = maxDec(0, wagesIn);
  const priorWages = maxDec(0, priorWagesIn);
  const ssRoom = maxDec(0, rules.socialSecurityWageBase.minus(priorWages));
  const socialSecurity = minDec(wages, ssRoom).times(rules.socialSecurityRate);

  let medicare = wages.times(rules.medicareRate);
  const additionalStart = maxDec(priorWages, rules.additionalMedicareThreshold);
  const additionalEnd = maxDec(priorWages.plus(wages), rules.additionalMedicareThreshold);
  medicare = medicare.plus(additionalEnd.minus(additionalStart).times(rules.additionalMedicareRate));

  const ss = money(socialSecurity);
  const mc = money(medicare);
  return { socialSecurity: ss, medicare: mc, total: money(ss.plus(mc)) };
}

/** The marginal rate (as a percent) that the next dollar of income would meet. */
export function marginalRate(income: Decimal, deduction: Decimal, brackets: Bracket[]): Decimal {
  const taxable = maxDec(0, income.minus(deduction));
  for (const [ceiling, rate] of brackets) {
    if (ceiling === null || taxable.lessThanOrEqualTo(ceiling)) return rate.times(100);
  }
  return ZERO;
}

export interface WithholdingEstimate {
  federal: Decimal;
  virginia: Decimal;
  socialSecurity: Decimal;
  medicare: Decimal;
}

/** What one paycheck "should" withhold, by annualizing its gross. */
export function estimatedPaycheckTaxes(
  grossPay: Decimal,
  payPeriods: number,
  rules: TaxYearRules,
  priorSocialSecurityWages: Decimal = ZERO,
): WithholdingEstimate {
  const annualized = grossPay.times(payPeriods);
  const fica = ficaTax(grossPay, rules, priorSocialSecurityWages);
  return {
    federal: money(federalIncomeTax(annualized, rules).div(payPeriods)),
    virginia: money(virginiaIncomeTax(annualized, rules).div(payPeriods)),
    socialSecurity: fica.socialSecurity,
    medicare: fica.medicare,
  };
}

export type WithholdingStatus = "On Track" | "Potential Overwithholding" | "Potential Underwithholding";

export function withholdingStatus(actual: Decimal, expected: Decimal, tolerance: Decimal): WithholdingStatus {
  const difference = actual.minus(expected);
  if (difference.abs().lessThanOrEqualTo(tolerance)) return "On Track";
  return difference.greaterThan(0) ? "Potential Overwithholding" : "Potential Underwithholding";
}

export interface TaxForecast {
  projectedIncome: Decimal;
  federalLiability: Decimal;
  virginiaLiability: Decimal;
  federalWithholding: Decimal;
  virginiaWithholding: Decimal;
  /** Positive = refund, negative = balance due. */
  federalResult: Decimal;
  virginiaResult: Decimal;
  combinedResult: Decimal;
}

export function taxForecast(input: {
  ytdIncome: Decimal;
  projectedRemainingIncome: Decimal;
  federalWithholdingYtd: Decimal;
  virginiaWithholdingYtd: Decimal;
  projectedFederalWithholding: Decimal;
  projectedVirginiaWithholding: Decimal;
  rules: TaxYearRules;
}): TaxForecast {
  const income = money(input.ytdIncome.plus(input.projectedRemainingIncome));
  const federalWithholding = money(input.federalWithholdingYtd.plus(input.projectedFederalWithholding));
  const virginiaWithholding = money(input.virginiaWithholdingYtd.plus(input.projectedVirginiaWithholding));
  const federal = federalIncomeTax(income, input.rules);
  const virginia = virginiaIncomeTax(income, input.rules);
  const federalResult = money(federalWithholding.minus(federal));
  const virginiaResult = money(virginiaWithholding.minus(virginia));
  return {
    projectedIncome: income,
    federalLiability: federal,
    virginiaLiability: virginia,
    federalWithholding,
    virginiaWithholding,
    federalResult,
    virginiaResult,
    combinedResult: money(federalResult.plus(virginiaResult)),
  };
}

// --- payroll ----------------------------------------------------------------

export function ptoAccrual(annualHours: Decimal, payPeriods = 26): Decimal {
  return quantize(dec(annualHours).div(payPeriods), 4);
}

export function roth401kContribution(grossPay: Decimal, contributionPercent: Decimal): Decimal {
  return money(grossPay.times(contributionPercent).div(100));
}

/** The employer matches up to its own cap, never more than you defer. */
export function employerMatch(grossPay: Decimal, employeePercent: Decimal, matchPercent: Decimal): Decimal {
  const matched = minDec(maxDec(employeePercent, 0), maxDec(matchPercent, 0));
  return money(grossPay.times(matched).div(100));
}

// --- retirement -------------------------------------------------------------

export interface RetirementMilestone {
  age: number;
  year: number;
  startingBalance: Decimal;
  employeeContributions: Decimal;
  employerContributions: Decimal;
  otherContributions: Decimal;
  investmentGrowth: Decimal;
  total: Decimal;
}

/**
 * Year-by-year projection, reported at the first year, every fifth age, and
 * retirement itself. Contributions go in before growth is applied for the year.
 */
export function retirementProjection(input: {
  currentAge: number;
  retirementAge: number;
  currentBalance: Decimal;
  annualSalary: Decimal;
  salaryGrowthPercent: Decimal;
  employeePercent: Decimal;
  employerMatchPercent: Decimal;
  annualOtherContribution: Decimal;
  returnPercent: Decimal;
  startYear: number;
}): RetirementMilestone[] {
  if (input.retirementAge <= input.currentAge) return [];

  let balance = money(input.currentBalance);
  const starting = balance;
  let salary = dec(input.annualSalary);
  let employeeTotal = new Decimal(0);
  let employerTotal = new Decimal(0);
  let otherTotal = new Decimal(0);
  const milestones: RetirementMilestone[] = [];
  const rate = input.returnPercent.div(100);
  const salaryGrowth = input.salaryGrowthPercent.div(100);

  for (let offset = 1; offset <= input.retirementAge - input.currentAge; offset += 1) {
    const employee = salary.times(input.employeePercent).div(100);
    const employer = salary.times(minDec(input.employeePercent, input.employerMatchPercent)).div(100);
    const other = dec(input.annualOtherContribution);
    employeeTotal = employeeTotal.plus(employee);
    employerTotal = employerTotal.plus(employer);
    otherTotal = otherTotal.plus(other);
    balance = balance.plus(employee).plus(employer).plus(other).times(rate.plus(1));
    salary = salary.times(salaryGrowth.plus(1));

    const age = input.currentAge + offset;
    if (offset === 1 || age % 5 === 0 || age === input.retirementAge) {
      const total = money(balance);
      milestones.push({
        age,
        year: input.startYear + offset,
        startingBalance: starting,
        employeeContributions: money(employeeTotal),
        employerContributions: money(employerTotal),
        otherContributions: money(otherTotal),
        investmentGrowth: money(total.minus(starting).minus(employeeTotal).minus(employerTotal).minus(otherTotal)),
        total,
      });
    }
  }
  return milestones;
}

// --- surplus allocation waterfall -------------------------------------------

export interface AllocationItem {
  name: string;
  amount: Decimal;
  explanation: string;
}

export interface AllocationPlan {
  availableSurplus: Decimal;
  items: AllocationItem[];
  remaining: Decimal;
}

/**
 * Spend a month's surplus down a fixed priority order, stopping when it runs
 * out. This is advisory only — `allocation.ts` is the engine that records real
 * decisions — but the two share the same ordering on purpose.
 */
export function allocationRecommendation(
  availableSurplus: Decimal,
  input: {
    requiredBills: Decimal;
    cardStatements: Decimal;
    emergencyGap: Decimal;
    sinkingFunds: Decimal;
    travelTarget: Decimal;
    rothIraTarget: Decimal;
    houseTarget: Decimal;
    brokerageTarget: Decimal;
    employerMatchCaptured: boolean;
  },
): AllocationPlan {
  let remaining = maxDec(ZERO, money(availableSurplus));
  const items: AllocationItem[] = [];

  const allocate = (name: string, target: Decimal, explanation: string) => {
    const amount = minDec(remaining, maxDec(ZERO, money(target)));
    if (amount.greaterThan(0)) {
      items.push({ name, amount, explanation });
      remaining = money(remaining.minus(amount));
    }
  };

  allocate("Required bills", input.requiredBills, "Reserve cash for bills still due this month.");
  allocate("Credit-card statements", input.cardStatements, "Pay statements in full before investing.");
  if (!input.employerMatchCaptured) {
    // Deliberately a zero-amount item: the fix is a payroll change, not cash.
    items.push({
      name: "401(k) match",
      amount: ZERO,
      explanation: "Raise payroll deferral to capture the full match first.",
    });
  }
  allocate("Emergency fund", input.emergencyGap, "Close the gap to the editable cash reserve target.");
  allocate("Required sinking funds", input.sinkingFunds, "Fund known costs by their due dates.");
  allocate("Travel", input.travelTarget, "Fund the editable travel target.");
  allocate("Roth IRA", input.rothIraTarget, "Add diversified retirement savings without forcing the annual maximum.");
  allocate("House fund", input.houseTarget, "Build a down-payment pool on the selected horizon.");
  allocate("Taxable investments", input.brokerageTarget, "Invest accessible long-term money after nearer priorities.");

  return { availableSurplus: money(availableSurplus), items, remaining };
}

export function contributionLimitWarning(annualContribution: Decimal, annualLimit: Decimal): string | null {
  if (annualContribution.greaterThan(annualLimit)) {
    return `Planned contribution exceeds the configured annual limit by ${money(annualContribution.minus(annualLimit)).toFixed(2)}.`;
  }
  return null;
}

// --- house glide path -------------------------------------------------------

export interface HouseRiskMilestone {
  yearsUntilGoal: number;
  equityPercent: Decimal;
  capitalPreservationPercent: Decimal;
}

/** A simple glide path that reaches 0% equity at the target date. */
export function houseRiskPath(
  horizonYears: number,
  equityPercent: Decimal,
  deriskYears: number,
): HouseRiskMilestone[] {
  const horizon = Math.max(1, horizonYears);
  const derisk = Math.max(1, Math.min(deriskYears, horizon));
  const startingEquity = minDec(100, maxDec(0, equityPercent));
  const rows: HouseRiskMilestone[] = [];
  for (let yearsLeft = horizon; yearsLeft >= 0; yearsLeft -= 1) {
    const raw = yearsLeft >= derisk ? startingEquity : startingEquity.times(yearsLeft).div(derisk);
    const equity = quantize(raw, 2);
    rows.push({
      yearsUntilGoal: yearsLeft,
      equityPercent: equity,
      capitalPreservationPercent: money(new Decimal(100).minus(equity)),
    });
  }
  return rows;
}

// --- goal forecasting -------------------------------------------------------

export interface GoalForecast {
  /** Months to reach the target, or null if it never does within `maxMonths`. */
  months: number | null;
  projectedDate: ISODate | null;
  projectedBalance: Decimal;
  contributions: Decimal;
  growth: Decimal;
  /** null when there is no target date to judge against. */
  onTrack: boolean | null;
}

/** Forecast a goal with end-of-month deposits and monthly compounding. */
export function goalForecast(input: {
  currentAmount: Decimal;
  targetAmount: Decimal;
  monthlyContribution: Decimal;
  annualReturnPercent?: Decimal;
  startDate?: ISODate;
  targetDate?: ISODate | null;
  maxMonths?: number;
}): GoalForecast {
  const maxMonths = input.maxMonths ?? 1200;
  const start = input.startDate ?? todayISO();
  const targetDate = input.targetDate ?? null;
  let balance = money(maxDec(ZERO, input.currentAmount));
  const target = money(maxDec(ZERO, input.targetAmount));
  const contribution = money(maxDec(ZERO, input.monthlyContribution));
  const monthlyRate = maxDec(-1, (input.annualReturnPercent ?? ZERO).div(100)).div(12);

  if (balance.greaterThanOrEqualTo(target)) {
    return { months: 0, projectedDate: start, projectedBalance: balance, contributions: ZERO, growth: ZERO, onTrack: true };
  }
  // Nothing going in and nothing growing: the goal is unreachable, and saying
  // so is more useful than looping 1200 times to reach the same conclusion.
  if (contribution.isZero() && monthlyRate.lessThanOrEqualTo(0)) {
    return {
      months: null, projectedDate: null, projectedBalance: balance,
      contributions: ZERO, growth: ZERO, onTrack: targetDate ? false : null,
    };
  }

  const starting = balance;
  for (let month = 1; month <= maxMonths; month += 1) {
    balance = balance.times(monthlyRate.plus(1)).plus(contribution);
    if (balance.greaterThanOrEqualTo(target)) {
      const projectedDate = addMonths(start, month);
      const deposited = money(contribution.times(month));
      return {
        months: month,
        projectedDate,
        projectedBalance: money(balance),
        contributions: deposited,
        growth: money(balance.minus(starting).minus(deposited)),
        onTrack: targetDate ? projectedDate <= targetDate : null,
      };
    }
  }
  const deposited = money(contribution.times(maxMonths));
  return {
    months: null,
    projectedDate: null,
    projectedBalance: money(balance),
    contributions: deposited,
    growth: money(balance.minus(starting).minus(deposited)),
    onTrack: targetDate ? false : null,
  };
}
