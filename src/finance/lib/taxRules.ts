// Versioned tax tables — a direct port of nexafi/tax_rules.py.
//
// Amounts are tax-year assumptions, deliberately kept out of component code.
// Add a new entry to TAX_RULES when a future tax year is supported.

import { Decimal } from "./money";

/** A bracket ceiling of `null` means "and everything above". */
export type Bracket = [ceiling: Decimal | null, rate: Decimal];

export interface TaxYearRules {
  year: number;
  filingStatus: string;
  federalStandardDeduction: Decimal;
  federalBrackets: Bracket[];
  virginiaStandardDeduction: Decimal;
  virginiaBrackets: Bracket[];
  socialSecurityRate: Decimal;
  socialSecurityWageBase: Decimal;
  medicareRate: Decimal;
  additionalMedicareRate: Decimal;
  additionalMedicareThreshold: Decimal;
  iraContributionLimit: Decimal;
  employee401kLimit: Decimal;
}

const d = (value: string | number) => new Decimal(value);

const RULES_2026_SINGLE: TaxYearRules = {
  year: 2026,
  filingStatus: "single",
  federalStandardDeduction: d(16100),
  federalBrackets: [
    [d(12400), d("0.10")],
    [d(50400), d("0.12")],
    [d(105700), d("0.22")],
    [d(201775), d("0.24")],
    [d(256225), d("0.32")],
    [d(640600), d("0.35")],
    [null, d("0.37")],
  ],
  virginiaStandardDeduction: d(8750),
  virginiaBrackets: [
    [d(3000), d("0.02")],
    [d(5000), d("0.03")],
    [d(17000), d("0.05")],
    [null, d("0.0575")],
  ],
  socialSecurityRate: d("0.062"),
  socialSecurityWageBase: d(184500),
  medicareRate: d("0.0145"),
  additionalMedicareRate: d("0.009"),
  additionalMedicareThreshold: d(200000),
  iraContributionLimit: d(7500),
  employee401kLimit: d(24500),
};

export const TAX_RULES: Record<string, TaxYearRules> = {
  "2026:single": RULES_2026_SINGLE,
};

export class UnsupportedTaxYearError extends Error {}

export function getTaxRules(year: number, filingStatus = "single"): TaxYearRules {
  const rules = TAX_RULES[`${year}:${filingStatus}`];
  if (!rules) {
    throw new UnsupportedTaxYearError(
      `Tax year ${year} for ${filingStatus} is not configured.`,
    );
  }
  return rules;
}

/** Years the app can actually compute, for the tax-year picker. */
export function supportedTaxYears(filingStatus = "single"): number[] {
  return Object.values(TAX_RULES)
    .filter((rules) => rules.filingStatus === filingStatus)
    .map((rules) => rules.year)
    .sort((a, b) => a - b);
}
