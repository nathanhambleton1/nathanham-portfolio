// Row types for the fin_* tables. Field names match the Postgres columns (and
// therefore the original SQLAlchemy models) exactly, so the port stays
// mechanical and a query result can be used without a mapping layer.
//
// `numeric` columns arrive from PostgREST as strings — Postgres numerics do not
// fit a JS number safely and supabase-js does not coerce them. That is a
// feature here: pass them straight into Decimal and no precision is ever lost.

import type { ISODate } from "./dates";

export type Numeric = string;
export type Timestamp = string;

export interface Account {
  id: number;
  name: string;
  account_type: AccountType;
  institution: string | null;
  last_four: string | null;
  is_liability: boolean;
  include_in_net_worth: boolean;
  is_active: boolean;
  cashback_rate: Numeric;
  statement_balance: Numeric;
  statement_closing_day: number | null;
  payment_due_day: number | null;
  apy: Numeric;
  autopay_enabled: boolean;
  payment_account_id: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export const ACCOUNT_TYPES = [
  "checking", "savings", "credit_card", "retirement", "brokerage",
  "roth_401k", "traditional_401k", "roth_ira", "traditional_ira",
  "taxable_brokerage", "other_asset", "other_liability", "other",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit card",
  retirement: "Retirement",
  brokerage: "Brokerage",
  roth_401k: "Roth 401(k)",
  traditional_401k: "Traditional 401(k)",
  roth_ira: "Roth IRA",
  traditional_ira: "Traditional IRA",
  taxable_brokerage: "Taxable brokerage",
  other_asset: "Other asset",
  other_liability: "Other liability",
  other: "Other",
};

/** Types that count as spendable cash for liquidity and flow. */
export const CASH_ACCOUNT_TYPES: AccountType[] = ["checking", "savings"];

/** Types that are debts rather than assets — used to default is_liability. */
export const LIABILITY_ACCOUNT_TYPES: AccountType[] = ["credit_card", "other_liability"];

export interface AccountBalance {
  id: number;
  account_id: number;
  balance_date: ISODate;
  balance: Numeric;
  source: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TransactionCategory {
  id: number;
  name: string;
  parent_id: number | null;
  is_active: boolean;
}

export type TransactionType = "expense" | "income" | "refund" | "transfer" | "account_transfer" | "card_payment" | "allocation";

export interface Transaction {
  id: number;
  transaction_date: ISODate;
  posting_date: ISODate | null;
  account_id: number;
  description: string;
  merchant: string | null;
  raw_description: string | null;
  source_transaction_id: string | null;
  amount: Numeric;
  transaction_type: TransactionType;
  category_id: number | null;
  subcategory_id: number | null;
  notes: string | null;
  is_transfer: boolean;
  is_recurring: boolean;
  source: string;
  confidence: Numeric | null;
  review_required: boolean;
  ai_import_id: number | null;
  fingerprint: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Transfer {
  id: number;
  transfer_date: ISODate;
  source_account_id: number;
  destination_account_id: number;
  amount: Numeric;
  source_transaction_id: number;
  destination_transaction_id: number;
  transfer_kind: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Paycheck {
  id: number;
  pay_date: ISODate;
  pay_period_start: ISODate | null;
  pay_period_end: ISODate | null;
  employer: string;
  regular_hours: Numeric;
  gross_amount: Numeric;
  net_amount: Numeric;
  federal_withholding: Numeric;
  virginia_withholding: Numeric;
  social_security: Numeric;
  medicare: Numeric;
  roth_401k: Numeric;
  employer_401k_match: Numeric;
  other_deductions: Numeric;
  pto_earned: Numeric;
  pto_used: Numeric;
  destination_account_id: number | null;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PaycheckDeduction {
  id: number;
  paycheck_id: number;
  name: string;
  deduction_type: string;
  amount: Numeric;
  is_pre_tax: boolean;
}

export interface Subscription {
  id: number;
  name: string;
  amount: Numeric;
  billing_frequency: Frequency;
  next_due_date: ISODate | null;
  account_id: number | null;
  category_id: number | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export const FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  semiannual: "Twice a year",
  annual: "Yearly",
};

export interface RecurringExpense {
  id: number;
  name: string;
  amount: Numeric;
  frequency: Frequency;
  due_day: number | null;
  is_variable: boolean;
  category_id: number | null;
  account_id: number | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SinkingFund {
  id: number;
  name: string;
  target_amount: Numeric;
  current_amount: Numeric;
  due_date: ISODate | null;
  linked_account_id: number | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export const GOAL_TYPES = ["emergency", "travel", "retirement", "house", "taxable", "other"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergency: "Emergency fund",
  travel: "Travel",
  retirement: "Retirement",
  house: "House",
  taxable: "Taxable investing",
  other: "Other",
};

export interface FinancialGoal {
  id: number;
  name: string;
  goal_type: GoalType;
  target_amount: Numeric;
  current_amount: Numeric;
  recommended_monthly: Numeric;
  user_monthly_target: Numeric;
  target_date: ISODate | null;
  linked_account_id: number | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RetirementContribution {
  id: number;
  contribution_date: ISODate;
  account_id: number;
  employee_amount: Numeric;
  employer_match: Numeric;
  contribution_type: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/**
 * How a setting's value should be parsed and rendered.
 *
 * These are the values the app actually stores: "decimal" and "money" are both
 * numeric inputs (money is quantized to cents), "integer" steps by one, and
 * "boolean" renders a checkbox. Kept as a union so a typo in a form is a
 * compile error rather than a silently mis-rendered field.
 */
export type SettingValueType =
  | "string"
  | "integer"
  | "decimal"
  | "money"
  | "boolean"
  | "date";

export interface Setting {
  id: number;
  key: string;
  value: string;
  value_type: SettingValueType;
  label: string;
  description: string | null;
  category: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SetupProgress {
  id: number;
  current_step: number;
  completed: boolean;
  history_option: string;
  setup_date: ISODate | null;
  completed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MonthlySnapshot {
  id: number;
  snapshot_month: ISODate;
  net_worth: Numeric;
  liquid_cash: Numeric;
  income: Numeric;
  spending: Numeric;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InvestmentAccount {
  id: number;
  account_id: number;
  tax_treatment: string;
}

export interface Security {
  id: number;
  symbol: string;
  name: string;
  security_type: string;
}

export interface InvestmentHolding {
  id: number;
  investment_account_id: number;
  security_id: number;
  quantity: Numeric;
  cost_basis: Numeric;
  as_of_date: ISODate | null;
}

export interface InvestmentTransaction {
  id: number;
  investment_account_id: number;
  security_id: number | null;
  transaction_date: ISODate;
  transaction_type: string;
  amount: Numeric;
  quantity: Numeric | null;
  fees: Numeric;
  notes: string | null;
}

export interface SecurityPrice {
  id: number;
  security_id: number;
  price_date: ISODate;
  price: Numeric;
  source: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InvestmentSnapshot {
  id: number;
  investment_account_id: number;
  security_id: number;
  snapshot_date: ISODate;
  quantity: Numeric;
  price: Numeric;
  market_value: Numeric;
  cost_basis: Numeric;
  source: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AIImport {
  id: number;
  source_name: string;
  status: string;
  content_hash: string;
  source_type: string;
  document_type: string | null;
  schema_version: string | null;
  account_id: number | null;
  raw_payload: string | null;
  error_message: string | null;
  transaction_count: number;
  duplicate_count: number;
  review_count: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AIReview {
  id: number;
  ai_import_id: number;
  transaction_id: number | null;
  status: string;
  suggested_payload: string | null;
  confidence: Numeric | null;
  reason: string | null;
  duplicate_transaction_id: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MerchantRule {
  id: number;
  merchant_pattern: string;
  normalized_merchant: string;
  category_id: number | null;
  subcategory_id: number | null;
  is_transfer: boolean;
  times_applied: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RecurringSuggestion {
  id: number;
  merchant: string;
  suggestion_type: string;
  status: string;
  amount: Numeric | null;
  previous_amount: Numeric | null;
  evidence: string | null;
  transaction_id: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MonthlyAIInsight {
  id: number;
  snapshot_month: ISODate;
  status: string;
  metrics_json: string;
  commentary_json: string | null;
  source: string;
  model: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MonthPlan {
  id: number;
  plan_month: ISODate;
  status: "open" | "closed";
  closed_at: Timestamp | null;
  swept_amount: Numeric;
  swept_to_account_id: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** Where an allocation's money goes. See the note on fin_paycheck_allocations. */
export type AllocationKind = "bill" | "card_payment" | "sinking_fund" | "goal" | "spendable";

/** Kinds whose money actually leaves checking. */
export const CASH_KINDS: AllocationKind[] = ["sinking_fund", "goal"];
/** Kinds that are only reserved inside checking. */
export const RESERVE_KINDS: AllocationKind[] = ["bill", "card_payment"];
export const SPENDABLE: AllocationKind = "spendable";

export interface PaycheckAllocation {
  id: number;
  paycheck_id: number;
  plan_month: ISODate;
  target_kind: AllocationKind;
  target_id: number | null;
  label: string;
  amount: Numeric;
  requested_amount: Numeric;
  destination_account_id: number | null;
  transfer_id: number | null;
  note: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
