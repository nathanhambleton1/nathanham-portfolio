// Write operations for the finance pages.
//
// These carry over what the FastAPI route handlers did around each write: the
// Pydantic validation, the derived fields, and the side effects (an opening
// balance row, a cleared soft reference). Keeping them here means a page's
// submit handler is one call, the way the original's was one POST.

import { Decimal, ZERO, dec, money, toNumeric } from "./money";
import { todayISO, type ISODate } from "./dates";
import { deleteRow, insertRow, T, updateRow, upsertRow } from "./db";
import { accountDeletionError } from "./finance";
import { addTransaction, createTransfer } from "./transactions";
import {
  recordRetirementContribution, SCHEDULED_PAYCHECK_NOTE, updateRetirementContribution,
} from "./paychecks";
import { unallocatePaycheck } from "./allocation";
import {
  entryHours, flexHoursInPeriod, FLEX_MAX_HOURS_PER_DAY, FLEX_MAX_HOURS_PER_PERIOD, payPeriodContaining,
} from "./ptoCalendar";
import type { FinanceData } from "./data";
import type {
  Account, AccountBalance, AccountType, FinancialGoal, Paycheck, PtoEntry, RecurringExpense,
  SinkingFund, Subscription, TransactionType,
} from "./types";
import { ACCOUNT_TYPES, GOAL_TYPES, LIABILITY_ACCOUNT_TYPES, PTO_LEAVE_TYPES } from "./types";

/** Mirrors Pydantic's ValidationError: a message meant for the page's banner. */
export class ValidationError extends Error {}

function requireText(value: string, field: string, min = 1, max = 500): string {
  const text = value.trim();
  if (text.length < min) throw new ValidationError(`${field} must be at least ${min} characters.`);
  if (text.length > max) throw new ValidationError(`${field} must be at most ${max} characters.`);
  return text;
}

function requireAmount(value: string, field: string, options: { min?: Decimal; gt?: Decimal } = {}): Decimal {
  const text = String(value ?? "").trim();
  if (text === "") throw new ValidationError(`${field} is required.`);
  let parsed: Decimal;
  try {
    parsed = new Decimal(text);
  } catch {
    throw new ValidationError(`${field} must be a number.`);
  }
  if (!parsed.isFinite()) throw new ValidationError(`${field} must be a number.`);
  if (options.gt && parsed.lessThanOrEqualTo(options.gt)) {
    throw new ValidationError(`${field} must be greater than ${options.gt.toString()}.`);
  }
  if (options.min && parsed.lessThan(options.min)) {
    throw new ValidationError(`${field} cannot be below ${options.min.toString()}.`);
  }
  return money(parsed);
}

function optionalDay(value: string, field: string): number | null {
  const text = String(value ?? "").trim();
  if (text === "") return null;
  const day = Number(text);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new ValidationError(`${field} must be a day between 1 and 31.`);
  }
  return day;
}

function optionalId(value: string): number | null {
  const text = String(value ?? "").trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

function validAccountType(value: string): AccountType {
  if (!(ACCOUNT_TYPES as readonly string[]).includes(value)) {
    throw new ValidationError("Choose a supported account type.");
  }
  return value as AccountType;
}

function optionalLastFour(value: string): string | null {
  const text = String(value ?? "").trim();
  if (text === "") return null;
  if (!/^\d{4}$/.test(text)) throw new ValidationError("Last four digits must be exactly 4 digits.");
  return text;
}

function ratePercent(value: string, field: string): Decimal {
  const text = String(value ?? "").trim() || "0";
  const parsed = dec(text);
  if (parsed.lessThan(0) || parsed.greaterThan(100)) {
    throw new ValidationError(`${field} must be between 0 and 100.`);
  }
  return parsed;
}

// --- accounts ---------------------------------------------------------------

export interface AccountForm {
  name: string;
  account_type: string;
  opening_balance?: string;
  institution?: string;
  last_four?: string;
  apy?: string;
  cashback_rate?: string;
  statement_balance?: string;
  closing_day?: string;
  due_day?: string;
}

function accountValues(form: AccountForm) {
  const accountType = validAccountType(form.account_type);
  return {
    name: requireText(form.name, "Name", 2, 100),
    account_type: accountType,
    institution: form.institution?.trim() || null,
    last_four: optionalLastFour(form.last_four ?? ""),
    // Derived, not asked: a credit card is always a liability.
    is_liability: LIABILITY_ACCOUNT_TYPES.includes(accountType),
    apy: toNumeric(ratePercent(form.apy ?? "0", "APY"), 4),
    cashback_rate: toNumeric(ratePercent(form.cashback_rate ?? "0", "Cashback"), 4),
    statement_balance: toNumeric(requireAmount(form.statement_balance || "0", "Statement balance", { min: ZERO })),
    statement_closing_day: optionalDay(form.closing_day ?? "", "Statement closing day"),
    payment_due_day: optionalDay(form.due_day ?? "", "Payment due day"),
  };
}

export async function createAccount(data: FinanceData, form: AccountForm): Promise<string> {
  const values = accountValues(form);
  const openingBalance = requireAmount(form.opening_balance || "0", "Opening balance");

  const account = await insertRow<Account>(T.accounts, values);
  data.accounts.push(account);

  // The opening balance is a dated snapshot like any other, tagged with its
  // origin so a later correction is distinguishable from the starting figure.
  const balance = await insertRow<AccountBalance>(T.accountBalances, {
    account_id: account.id,
    balance_date: todayISO(),
    balance: toNumeric(openingBalance),
    source: "opening_balance",
  });
  data.accountBalances.push(balance);

  return "Account added.";
}

export async function editAccount(data: FinanceData, id: number, form: AccountForm): Promise<string> {
  const values = accountValues(form);
  const row = await updateRow<Account>(T.accounts, id, values);
  const existing = data.accounts.find((account) => account.id === id);
  if (existing) Object.assign(existing, row);
  return "Account updated.";
}

export async function setAccountBalance(
  data: FinanceData,
  accountId: number,
  balanceRaw: string,
  balanceDate: ISODate = todayISO(),
): Promise<string> {
  const balance = requireAmount(balanceRaw, "Balance");
  const existing = data.accountBalances.find(
    (row) => row.account_id === accountId && row.balance_date === balanceDate,
  );

  if (existing) {
    const row = await updateRow<AccountBalance>(T.accountBalances, existing.id, {
      balance: toNumeric(balance),
    });
    Object.assign(existing, row);
  } else {
    const row = await insertRow<AccountBalance>(T.accountBalances, {
      account_id: accountId,
      balance_date: balanceDate,
      balance: toNumeric(balance),
      source: "manual",
    });
    data.accountBalances.push(row);
  }
  return "Balance updated.";
}

/**
 * Delete an account, but only if nothing depends on it.
 *
 * Refuses when the account has real financial history rather than guessing what
 * to do with it. Optional links from recurring expenses, subscriptions, goals,
 * sinking funds, and another account's autopay are cleared automatically, since
 * those are soft references rather than history. Balance rows cascade in the
 * database.
 */
export async function removeAccount(data: FinanceData, account: Account): Promise<string> {
  const blocked = accountDeletionError(data, account);
  if (blocked) throw new ValidationError(blocked);

  for (const other of data.accounts.filter((a) => a.payment_account_id === account.id)) {
    await updateRow<Account>(T.accounts, other.id, { payment_account_id: null });
    other.payment_account_id = null;
  }
  for (const expense of data.recurringExpenses.filter((e) => e.account_id === account.id)) {
    await updateRow<RecurringExpense>(T.recurringExpenses, expense.id, { account_id: null });
    expense.account_id = null;
  }
  for (const subscription of data.subscriptions.filter((s) => s.account_id === account.id)) {
    await updateRow<Subscription>(T.subscriptions, subscription.id, { account_id: null });
    subscription.account_id = null;
  }
  for (const fund of data.sinkingFunds.filter((f) => f.linked_account_id === account.id)) {
    await updateRow<SinkingFund>(T.sinkingFunds, fund.id, { linked_account_id: null });
    fund.linked_account_id = null;
  }
  for (const goal of data.goals.filter((g) => g.linked_account_id === account.id)) {
    await updateRow<FinancialGoal>(T.goals, goal.id, { linked_account_id: null });
    goal.linked_account_id = null;
  }

  await deleteRow(T.accounts, account.id);
  data.accounts = data.accounts.filter((a) => a.id !== account.id);
  return `${account.name} deleted.`;
}

// --- transactions and transfers ---------------------------------------------

export interface TransactionForm {
  transaction_date: string;
  account_id: string;
  description: string;
  amount: string;
  transaction_type: string;
  category_id?: string;
  subcategory_id?: string;
  notes?: string;
  is_recurring?: boolean;
}

export async function createTransaction(data: FinanceData, form: TransactionForm): Promise<string> {
  if (!["expense", "income", "refund"].includes(form.transaction_type)) {
    throw new ValidationError("Choose expense, income, or refund.");
  }
  const accountId = optionalId(form.account_id);
  if (accountId === null) throw new ValidationError("Choose an account.");

  const transaction = await addTransaction({
    transaction_date: form.transaction_date,
    account_id: accountId,
    description: requireText(form.description, "Description", 2, 180),
    amount: requireAmount(form.amount, "Amount", { gt: ZERO }),
    transaction_type: form.transaction_type as TransactionType,
    category_id: optionalId(form.category_id ?? ""),
    subcategory_id: optionalId(form.subcategory_id ?? ""),
    notes: form.notes?.trim() || null,
    is_recurring: form.is_recurring ?? false,
    is_transfer: false,
    source: "manual",
  });
  data.transactions.push(transaction);
  return "Transaction saved.";
}

export interface TransferForm {
  transfer_date: string;
  source_account_id: string;
  destination_account_id: string;
  amount: string;
  transfer_kind?: string;
  description?: string;
}

export async function recordTransfer(data: FinanceData, form: TransferForm): Promise<string> {
  const source = optionalId(form.source_account_id);
  const destination = optionalId(form.destination_account_id);
  if (source === null || destination === null) throw new ValidationError("Choose both accounts.");

  const transfer = await createTransfer({
    transferDate: form.transfer_date,
    sourceAccountId: source,
    destinationAccountId: destination,
    amount: requireAmount(form.amount, "Amount", { gt: ZERO }),
    description: form.description?.trim() || "Transfer",
    transferKind: form.transfer_kind || "account_transfer",
  });
  data.transfers.push(transfer);
  return "Transfer recorded without affecting spending.";
}

// --- paychecks --------------------------------------------------------------

export interface PaycheckForm {
  pay_date: string;
  pay_period_start?: string;
  pay_period_end?: string;
  employer: string;
  regular_hours?: string;
  gross_amount: string;
  net_amount: string;
  federal_withholding?: string;
  virginia_withholding?: string;
  social_security?: string;
  medicare?: string;
  roth_401k?: string;
  employer_401k_match?: string;
  other_deductions?: string;
  pto_earned?: string;
  pto_used?: string;
  destination_account_id?: string;
  notes?: string;
}

/**
 * Validate a paycheck and derive its deposit.
 *
 * Net pay is never taken from the form: it is gross less the employee taxes and
 * deductions actually entered, so the recorded deposit can't disagree with the
 * lines above it. The employer match is excluded because it never touches the
 * deposit.
 */
function paycheckValues(form: PaycheckForm) {
  const gross = requireAmount(form.gross_amount, "Gross pay", { gt: ZERO });

  const federal = requireAmount(form.federal_withholding || "0", "Federal withholding", { min: ZERO });
  const virginia = requireAmount(form.virginia_withholding || "0", "Virginia withholding", { min: ZERO });
  const socialSecurity = requireAmount(form.social_security || "0", "Social Security", { min: ZERO });
  const medicare = requireAmount(form.medicare || "0", "Medicare", { min: ZERO });
  const roth = requireAmount(form.roth_401k || "0", "Roth 401(k)", { min: ZERO });
  const other = requireAmount(form.other_deductions || "0", "Other deductions", { min: ZERO });

  const net = money(
    gross.minus(federal).minus(virginia).minus(socialSecurity).minus(medicare).minus(roth).minus(other),
  );
  if (net.lessThanOrEqualTo(ZERO)) {
    throw new ValidationError("Taxes and employee deductions cannot consume the entire paycheck.");
  }

  const start = form.pay_period_start?.trim() || null;
  const end = form.pay_period_end?.trim() || null;
  if (start && end && end < start) {
    throw new ValidationError("Pay-period end cannot be before its start.");
  }

  return {
    pay_date: form.pay_date,
    pay_period_start: start,
    pay_period_end: end,
    employer: requireText(form.employer, "Employer", 2, 120),
    regular_hours: toNumeric(dec(form.regular_hours || "80"), 2),
    gross_amount: toNumeric(gross),
    net_amount: toNumeric(net),
    federal_withholding: toNumeric(federal),
    virginia_withholding: toNumeric(virginia),
    social_security: toNumeric(socialSecurity),
    medicare: toNumeric(medicare),
    roth_401k: toNumeric(roth),
    employer_401k_match: toNumeric(requireAmount(form.employer_401k_match || "0", "Employer match", { min: ZERO })),
    other_deductions: toNumeric(other),
    pto_earned: toNumeric(dec(form.pto_earned || "0"), 4),
    pto_used: toNumeric(dec(form.pto_used || "0"), 4),
    destination_account_id: optionalId(form.destination_account_id ?? ""),
    notes: form.notes?.trim() || null,
  };
}

export async function createPaycheck(data: FinanceData, form: PaycheckForm): Promise<string> {
  const paycheck = await insertRow<Paycheck>(T.paychecks, paycheckValues(form));
  data.paychecks.push(paycheck);
  await recordRetirementContribution(data, paycheck);
  return "Paycheck recorded.";
}

export async function editPaycheck(
  data: FinanceData,
  id: number,
  form: PaycheckForm,
): Promise<string> {
  const existing = data.paychecks.find((p) => p.id === id);
  if (!existing) throw new ValidationError("Paycheck not found.");

  const values = paycheckValues(form);
  const originalPayDate = existing.pay_date;

  // A corrected paycheck has a stale plan: drop it so the next visit
  // re-earmarks from the corrected net pay.
  await unallocatePaycheck(data, existing);

  const patch: Record<string, unknown> = { ...values };
  // Once corrected by hand, it is no longer the untouched scheduled entry, and
  // the scheduler must stop overwriting it with the payroll baseline.
  if (existing.notes === SCHEDULED_PAYCHECK_NOTE) {
    patch.notes = "Corrected manually from scheduled paycheck.";
  }

  const row = await updateRow<Paycheck>(T.paychecks, id, patch);
  Object.assign(existing, row);
  await updateRetirementContribution(data, row, { originalPayDate });
  return "Paycheck updated.";
}

// --- goals, funds, recurring costs ------------------------------------------

export async function updateGoal(
  data: FinanceData,
  id: number,
  values: {
    name?: string;
    goal_type?: string;
    user_monthly_target?: string;
    current_amount?: string;
    target_amount?: string;
    target_date?: string | null;
    linked_account_id?: string;
    is_active?: boolean;
  },
): Promise<string> {
  const patch: Record<string, unknown> = {};
  if (values.name !== undefined) patch.name = requireText(values.name, "Name", 2, 100);
  if (values.goal_type !== undefined && (GOAL_TYPES as readonly string[]).includes(values.goal_type)) {
    patch.goal_type = values.goal_type;
  }
  if (values.linked_account_id !== undefined) {
    patch.linked_account_id = optionalId(values.linked_account_id);
  }
  if (values.is_active !== undefined) patch.is_active = values.is_active;
  if (values.user_monthly_target !== undefined) {
    patch.user_monthly_target = toNumeric(requireAmount(values.user_monthly_target || "0", "Monthly target", { min: ZERO }));
  }
  if (values.current_amount !== undefined) {
    patch.current_amount = toNumeric(requireAmount(values.current_amount || "0", "Current amount", { min: ZERO }));
  }
  if (values.target_amount !== undefined) {
    patch.target_amount = toNumeric(requireAmount(values.target_amount || "0", "Target amount", { min: ZERO }));
  }
  if (values.target_date !== undefined) {
    patch.target_date = values.target_date?.trim() || null;
  }

  const row = await updateRow<FinancialGoal>(T.goals, id, patch);
  const existing = data.goals.find((goal) => goal.id === id);
  if (existing) Object.assign(existing, row);
  return "Bucket updated.";
}

export interface SinkingFundForm {
  name: string;
  target_amount: string;
  current_amount?: string;
  due_date?: string;
  linked_account_id?: string;
}

export async function createSinkingFund(data: FinanceData, form: SinkingFundForm): Promise<string> {
  const row = await insertRow<SinkingFund>(T.sinkingFunds, {
    name: requireText(form.name, "Name", 2, 100),
    target_amount: toNumeric(requireAmount(form.target_amount, "Target amount", { gt: ZERO })),
    current_amount: toNumeric(requireAmount(form.current_amount || "0", "Current amount", { min: ZERO })),
    due_date: form.due_date?.trim() || null,
    linked_account_id: optionalId(form.linked_account_id ?? ""),
    is_active: true,
  });
  data.sinkingFunds.push(row);
  return "Bucket added.";
}

export async function updateSinkingFund(
  data: FinanceData,
  id: number,
  values: {
    name?: string;
    current_amount?: string;
    target_amount?: string;
    due_date?: string | null;
    linked_account_id?: string;
    is_active?: boolean;
  },
): Promise<string> {
  const patch: Record<string, unknown> = {};
  if (values.name !== undefined) patch.name = requireText(values.name, "Name", 2, 100);
  if (values.linked_account_id !== undefined) {
    patch.linked_account_id = optionalId(values.linked_account_id);
  }
  if (values.current_amount !== undefined) {
    patch.current_amount = toNumeric(requireAmount(values.current_amount || "0", "Current amount", { min: ZERO }));
  }
  if (values.target_amount !== undefined) {
    patch.target_amount = toNumeric(requireAmount(values.target_amount || "0", "Target amount", { min: ZERO }));
  }
  if (values.due_date !== undefined) patch.due_date = values.due_date?.trim() || null;
  if (values.is_active !== undefined) patch.is_active = values.is_active;

  const row = await updateRow<SinkingFund>(T.sinkingFunds, id, patch);
  const existing = data.sinkingFunds.find((fund) => fund.id === id);
  if (existing) Object.assign(existing, row);
  return "Bucket updated.";
}

export interface RecurringExpenseForm {
  name: string;
  amount: string;
  frequency?: string;
  due_day?: string;
  is_variable?: boolean;
  account_id?: string;
  category_id?: string;
}

export async function createRecurringExpense(
  data: FinanceData,
  form: RecurringExpenseForm,
): Promise<string> {
  const row = await insertRow<RecurringExpense>(T.recurringExpenses, {
    name: requireText(form.name, "Name", 2, 100),
    amount: toNumeric(requireAmount(form.amount, "Amount", { gt: ZERO })),
    frequency: form.frequency || "monthly",
    due_day: optionalDay(form.due_day ?? "", "Due day"),
    is_variable: form.is_variable ?? false,
    account_id: optionalId(form.account_id ?? ""),
    category_id: optionalId(form.category_id ?? ""),
    is_active: true,
  });
  data.recurringExpenses.push(row);
  return "Bill added.";
}

export async function updateRecurringExpense(
  data: FinanceData,
  id: number,
  form: Partial<RecurringExpenseForm> & { is_active?: boolean },
): Promise<string> {
  const patch: Record<string, unknown> = {};
  if (form.name !== undefined) patch.name = requireText(form.name, "Name", 2, 100);
  if (form.amount !== undefined) {
    patch.amount = toNumeric(requireAmount(form.amount, "Amount", { gt: ZERO }));
  }
  if (form.frequency !== undefined) patch.frequency = form.frequency || "monthly";
  if (form.due_day !== undefined) patch.due_day = optionalDay(form.due_day ?? "", "Due day");
  if (form.is_variable !== undefined) patch.is_variable = form.is_variable;
  if (form.account_id !== undefined) patch.account_id = optionalId(form.account_id ?? "");
  if (form.category_id !== undefined) patch.category_id = optionalId(form.category_id ?? "");
  if (form.is_active !== undefined) patch.is_active = form.is_active;

  const row = await updateRow<RecurringExpense>(T.recurringExpenses, id, patch);
  const existing = data.recurringExpenses.find((item) => item.id === id);
  if (existing) Object.assign(existing, row);
  return "Bill updated.";
}

/**
 * Subscriptions are edited but never created here.
 *
 * The two tables model the same thing and the Bills page shows them as one
 * list, so new bills all go to `fin_recurring_expenses`. The subscription rows
 * that already exist stay editable so nothing has to be migrated by hand.
 */
export async function updateSubscription(
  data: FinanceData,
  id: number,
  form: {
    name?: string;
    amount?: string;
    billing_frequency?: string;
    next_due_date?: string | null;
    is_active?: boolean;
  },
): Promise<string> {
  const patch: Record<string, unknown> = {};
  if (form.name !== undefined) patch.name = requireText(form.name, "Name", 2, 100);
  if (form.amount !== undefined) {
    patch.amount = toNumeric(requireAmount(form.amount, "Amount", { gt: ZERO }));
  }
  if (form.billing_frequency !== undefined) {
    patch.billing_frequency = form.billing_frequency || "monthly";
  }
  if (form.next_due_date !== undefined) patch.next_due_date = form.next_due_date?.trim() || null;
  if (form.is_active !== undefined) patch.is_active = form.is_active;

  const row = await updateRow<Subscription>(T.subscriptions, id, patch);
  const existing = data.subscriptions.find((item) => item.id === id);
  if (existing) Object.assign(existing, row);
  return "Bill updated.";
}

export async function removeSubscription(data: FinanceData, id: number): Promise<string> {
  await deleteRow(T.subscriptions, id);
  data.subscriptions = data.subscriptions.filter((item) => item.id !== id);
  return "Bill removed.";
}

// --- savings buckets --------------------------------------------------------

export interface GoalForm {
  name: string;
  goal_type: string;
  target_amount: string;
  current_amount?: string;
  user_monthly_target?: string;
  target_date?: string;
  linked_account_id?: string;
}

export async function createGoal(data: FinanceData, form: GoalForm): Promise<string> {
  const goalType = (GOAL_TYPES as readonly string[]).includes(form.goal_type)
    ? form.goal_type
    : "other";
  const row = await insertRow<FinancialGoal>(T.goals, {
    name: requireText(form.name, "Name", 2, 100),
    goal_type: goalType,
    target_amount: toNumeric(requireAmount(form.target_amount, "Target amount", { gt: ZERO })),
    current_amount: toNumeric(requireAmount(form.current_amount || "0", "Current amount", { min: ZERO })),
    user_monthly_target: toNumeric(
      requireAmount(form.user_monthly_target || "0", "Monthly target", { min: ZERO }),
    ),
    recommended_monthly: toNumeric(ZERO),
    target_date: form.target_date?.trim() || null,
    linked_account_id: optionalId(form.linked_account_id ?? ""),
    is_active: true,
  });
  data.goals.push(row);
  return "Bucket added.";
}

/**
 * Archive rather than delete.
 *
 * A bucket that has been funded is referenced by every allocation row that ever
 * fed it, and those rows are the record of what you decided in past months.
 * Deleting the bucket would either fail on the foreign key or take that history
 * with it, so a removed bucket is simply switched off: it leaves every list and
 * every breakdown, and the history it explains stays readable.
 */
export async function archiveGoal(data: FinanceData, id: number): Promise<string> {
  const row = await updateRow<FinancialGoal>(T.goals, id, { is_active: false });
  const existing = data.goals.find((goal) => goal.id === id);
  if (existing) Object.assign(existing, row);
  return "Bucket archived.";
}

export async function archiveSinkingFund(data: FinanceData, id: number): Promise<string> {
  const row = await updateRow<SinkingFund>(T.sinkingFunds, id, { is_active: false });
  const existing = data.sinkingFunds.find((fund) => fund.id === id);
  if (existing) Object.assign(existing, row);
  return "Bucket archived.";
}

export async function removeRecurringExpense(data: FinanceData, id: number): Promise<string> {
  await deleteRow(T.recurringExpenses, id);
  data.recurringExpenses = data.recurringExpenses.filter((item) => item.id !== id);
  return "Bill removed.";
}

// --- pto ----------------------------------------------------------------

export interface PtoEntryForm {
  start_date: string;
  end_date: string;
  hours_per_day?: string;
  leave_type: string;
  notes?: string;
}

function ptoEntryValues(form: PtoEntryForm) {
  const start = form.start_date?.trim();
  if (!start) throw new ValidationError("Start date is required.");
  const end = form.end_date?.trim() || start;
  if (end < start) throw new ValidationError("End date cannot be before the start date.");

  const leaveType = (PTO_LEAVE_TYPES as readonly string[]).includes(form.leave_type)
    ? form.leave_type
    : "vacation";

  return {
    start_date: start,
    end_date: end,
    hours_per_day: toNumeric(requireAmount(form.hours_per_day || "8", "Hours per day", { gt: ZERO }), 2),
    leave_type: leaveType,
    notes: form.notes?.trim() || null,
  };
}

/**
 * Flex isn't paid from the PTO bank — it's owed back as extra work the same
 * pay period, so it gets its own caps: a day of it at most, two days of it
 * across the whole period.
 */
function validateFlexEntry(
  data: FinanceData,
  values: { start_date: ISODate; end_date: ISODate; hours_per_day: string; leave_type: string },
  excludeEntryId?: number,
): void {
  if (values.leave_type !== "flex") return;

  const perDay = dec(values.hours_per_day);
  if (perDay.greaterThan(FLEX_MAX_HOURS_PER_DAY)) {
    throw new ValidationError(`Flex time can't exceed ${FLEX_MAX_HOURS_PER_DAY} hours in a single day.`);
  }

  const bounds = payPeriodContaining(data.settings, values.start_date);
  if (!bounds) return;

  const draftEntry = { start_date: values.start_date, end_date: values.end_date, hours_per_day: values.hours_per_day } as PtoEntry;
  const existingFlexHours = flexHoursInPeriod(data.ptoEntries, bounds.start, bounds.end, excludeEntryId);
  const periodTotal = existingFlexHours.plus(entryHours(draftEntry, bounds.start, bounds.end));

  if (periodTotal.greaterThan(FLEX_MAX_HOURS_PER_PERIOD)) {
    throw new ValidationError(
      `Flex time can't exceed ${FLEX_MAX_HOURS_PER_PERIOD} hours in one pay period — this period already has ${existingFlexHours.toFixed(2)} hrs flexed.`,
    );
  }
}

export async function createPtoEntry(data: FinanceData, form: PtoEntryForm): Promise<string> {
  const values = ptoEntryValues(form);
  validateFlexEntry(data, values);
  const row = await insertRow<PtoEntry>(T.ptoEntries, values);
  data.ptoEntries.push(row);
  return values.leave_type === "flex" ? "Flex time logged." : "PTO logged.";
}

export async function updatePtoEntry(data: FinanceData, id: number, form: PtoEntryForm): Promise<string> {
  const values = ptoEntryValues(form);
  validateFlexEntry(data, values, id);
  const row = await updateRow<PtoEntry>(T.ptoEntries, id, values);
  const existing = data.ptoEntries.find((entry) => entry.id === id);
  if (existing) Object.assign(existing, row);
  return "PTO entry updated.";
}

export async function removePtoEntry(data: FinanceData, id: number): Promise<string> {
  await deleteRow(T.ptoEntries, id);
  data.ptoEntries = data.ptoEntries.filter((entry) => entry.id !== id);
  return "PTO entry removed.";
}

// --- settings ---------------------------------------------------------------

/**
 * Write one setting, creating it if this install has never had it.
 *
 * Upsert rather than update so a setting introduced by a later version appears
 * the first time it is saved instead of silently doing nothing.
 */
export async function saveSetting(
  data: FinanceData,
  key: string,
  value: string,
  fallbackLabel?: string,
): Promise<void> {
  const existing = data.settingRows.find((row) => row.key === key);
  const row = await upsertRow<{ id: number; key: string; value: string }>(
    T.settings,
    {
      key,
      value,
      value_type: existing?.value_type ?? "string",
      label: existing?.label ?? fallbackLabel ?? key,
      description: existing?.description ?? null,
      category: existing?.category ?? "general",
    },
    "owner,key",
  );
  if (existing) {
    Object.assign(existing, row);
  } else {
    data.settingRows.push(row as never);
  }
  data.settings[key] = value;
}

export async function saveSettings(
  data: FinanceData,
  values: Record<string, string>,
): Promise<string> {
  for (const [key, value] of Object.entries(values)) {
    await saveSetting(data, key, value);
  }
  return "Settings saved.";
}
