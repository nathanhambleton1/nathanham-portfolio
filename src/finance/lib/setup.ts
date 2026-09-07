// First-run setup - a port of nexafi/services/setup.py.
//
// Every save here is an upsert keyed on name, which is what makes "Rerun Setup"
// non-destructive: walking the wizard again edits the rows you already have
// rather than creating a second Emergency Fund beside the first.

import { Decimal, ZERO, money, toNumeric } from "./money";
import { planMonthOf, todayISO, type ISODate } from "./dates";
import { insertRow, T, updateRow, upsertRow } from "./db";
import { liquidCash, monthlyTotals, netWorth } from "./finance";
import type { FinanceData } from "./data";
import type {
  Account, AccountBalance, FinancialGoal, MonthlySnapshot, RecurringExpense,
  SetupProgress, SinkingFund,
} from "./types";
import { LIABILITY_ACCOUNT_TYPES, type AccountType } from "./types";

export async function ensureSetupProgress(data: FinanceData): Promise<SetupProgress> {
  if (data.setupProgress) return data.setupProgress;
  const row = await insertRow<SetupProgress>(T.setupProgress, {
    current_step: 1,
    completed: false,
    history_option: "start_today",
  });
  data.setupProgress = row;
  return row;
}

export async function saveProgress(
  data: FinanceData,
  patch: Partial<Pick<SetupProgress, "current_step" | "completed" | "history_option" | "setup_date">>,
): Promise<SetupProgress> {
  const progress = await ensureSetupProgress(data);
  const row = await updateRow<SetupProgress>(T.setupProgress, progress.id, patch);
  Object.assign(progress, row);
  return progress;
}

/** Write a setting, creating it with sensible metadata if it is new. */
export async function saveSetting(
  data: FinanceData,
  key: string,
  value: unknown,
  options: { label?: string; valueType?: string; category?: string; description?: string } = {},
): Promise<void> {
  const text = String(value ?? "").trim();
  const existing = data.settingRows.find((row) => row.key === key);

  const row = await upsertRow<{ id: number; key: string; value: string }>(
    T.settings,
    {
      key,
      value: text,
      value_type: existing?.value_type ?? options.valueType ?? "string",
      label:
        existing?.label ??
        options.label ??
        key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      description: existing?.description ?? options.description ?? null,
      category: existing?.category ?? options.category ?? "setup",
    },
    "owner,key",
  );

  if (existing) Object.assign(existing, row);
  else data.settingRows.push(row as never);
  data.settings[key] = text;
}

export interface OpeningAccountInput {
  name: string;
  accountType: AccountType;
  openingBalance: Decimal;
  effectiveDate: ISODate;
  institution?: string | null;
  lastFour?: string | null;
  apy?: Decimal;
  statementBalance?: Decimal;
  closingDay?: number | null;
  dueDay?: number | null;
  cashbackRate?: Decimal;
  autopayEnabled?: boolean;
  paymentAccountId?: number | null;
}

/** Create or update an account and stamp its opening balance for that date. */
export async function saveOpeningAccount(
  data: FinanceData,
  input: OpeningAccountInput,
): Promise<Account> {
  const values = {
    account_type: input.accountType,
    institution: input.institution || null,
    last_four: input.lastFour ? input.lastFour.slice(-4) : null,
    is_liability: LIABILITY_ACCOUNT_TYPES.includes(input.accountType),
    apy: toNumeric(input.apy ?? ZERO, 4),
    statement_balance: toNumeric(input.statementBalance ?? ZERO),
    statement_closing_day: input.closingDay ?? null,
    payment_due_day: input.dueDay ?? null,
    cashback_rate: toNumeric(input.cashbackRate ?? ZERO, 4),
    autopay_enabled: input.autopayEnabled ?? false,
    payment_account_id: input.paymentAccountId ?? null,
    is_active: true,
  };

  let account = data.accounts.find((row) => row.name === input.name);
  if (account) {
    const row = await updateRow<Account>(T.accounts, account.id, values);
    Object.assign(account, row);
  } else {
    account = await insertRow<Account>(T.accounts, { name: input.name, ...values });
    data.accounts.push(account);
  }

  const existingBalance = data.accountBalances.find(
    (row) => row.account_id === account!.id && row.balance_date === input.effectiveDate,
  );
  const balanceValues = {
    balance: toNumeric(input.openingBalance),
    source: "opening_balance",
  };

  if (existingBalance) {
    const row = await updateRow<AccountBalance>(T.accountBalances, existingBalance.id, balanceValues);
    Object.assign(existingBalance, row);
  } else {
    const row = await insertRow<AccountBalance>(T.accountBalances, {
      account_id: account.id,
      balance_date: input.effectiveDate,
      ...balanceValues,
    });
    data.accountBalances.push(row);
  }

  return account;
}

export interface GoalInput {
  name: string;
  goalType: string;
  target: Decimal;
  current: Decimal;
  recommendedMonthly: Decimal;
  userMonthly: Decimal;
  active: boolean;
  linkedAccountId?: number | null;
  targetDate?: ISODate | null;
}

export async function saveGoal(data: FinanceData, input: GoalInput): Promise<FinancialGoal> {
  const values = {
    goal_type: input.goalType,
    target_amount: toNumeric(input.target),
    current_amount: toNumeric(input.current),
    recommended_monthly: toNumeric(input.recommendedMonthly),
    user_monthly_target: toNumeric(input.userMonthly),
    is_active: input.active,
    linked_account_id: input.linkedAccountId ?? null,
    target_date: input.targetDate ?? null,
  };

  const existing = data.goals.find((row) => row.name === input.name);
  if (existing) {
    const row = await updateRow<FinancialGoal>(T.goals, existing.id, values);
    Object.assign(existing, row);
    return existing;
  }

  const row = await insertRow<FinancialGoal>(T.goals, { name: input.name, ...values });
  data.goals.push(row);
  return row;
}

export interface SinkingFundInput {
  name: string;
  target: Decimal;
  current: Decimal;
  dueDate: ISODate | null;
  active: boolean;
  linkedAccountId?: number | null;
}

export async function saveSinkingFund(
  data: FinanceData,
  input: SinkingFundInput,
): Promise<SinkingFund> {
  const values = {
    target_amount: toNumeric(input.target),
    current_amount: toNumeric(input.current),
    due_date: input.dueDate,
    is_active: input.active,
    linked_account_id: input.linkedAccountId ?? null,
  };

  const existing = data.sinkingFunds.find((row) => row.name === input.name);
  if (existing) {
    const row = await updateRow<SinkingFund>(T.sinkingFunds, existing.id, values);
    Object.assign(existing, row);
    return existing;
  }

  const row = await insertRow<SinkingFund>(T.sinkingFunds, { name: input.name, ...values });
  data.sinkingFunds.push(row);
  return row;
}

export async function saveRecurringExpense(
  data: FinanceData,
  input: { name: string; amount: Decimal; frequency: string; variable?: boolean; active?: boolean },
): Promise<RecurringExpense> {
  const values = {
    amount: toNumeric(input.amount),
    frequency: input.frequency,
    is_variable: input.variable ?? false,
    is_active: input.active ?? true,
  };

  const existing = data.recurringExpenses.find((row) => row.name === input.name);
  if (existing) {
    const row = await updateRow<RecurringExpense>(T.recurringExpenses, existing.id, values);
    Object.assign(existing, row);
    return existing;
  }

  const row = await insertRow<RecurringExpense>(T.recurringExpenses, { name: input.name, ...values });
  data.recurringExpenses.push(row);
  return row;
}

/** Mark setup done and freeze the opening snapshot it just established. */
export async function completeSetup(data: FinanceData): Promise<SetupProgress> {
  const progress = await ensureSetupProgress(data);
  const today = todayISO();
  const month = planMonthOf(today);
  const totals = monthlyTotals(data, today);

  const snapshotValues = {
    snapshot_month: month,
    net_worth: toNumeric(netWorth(data)),
    liquid_cash: toNumeric(liquidCash(data)),
    income: toNumeric(totals.income),
    spending: toNumeric(totals.spending),
  };
  const snapshot = await upsertRow<MonthlySnapshot>(
    T.monthlySnapshots,
    snapshotValues,
    "owner,snapshot_month",
  );
  const existingSnapshot = data.monthlySnapshots.find((row) => row.snapshot_month === month);
  if (existingSnapshot) Object.assign(existingSnapshot, snapshot);
  else data.monthlySnapshots.push(snapshot);

  return saveProgress(data, {
    completed: true,
    current_step: 8,
    setup_date: progress.setup_date ?? today,
  });
}

export { money };
