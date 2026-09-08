// Recurring-expense auto-logging - the bill-side counterpart to paychecks.ts's
// scheduled-payroll backfill. Rent, utilities, and subscriptions are recorded
// once as a RecurringExpense and then never touched again, so without this
// they never become a Transaction and never show up in spending-by-category -
// this creates the missing transaction the moment it's due, same as a person
// would have entered it by hand.

import { addTransaction, DuplicateTransactionError } from "./transactions";
import { addMonths, daysInMonth, parts, planMonthOf, todayISO, toISO, type ISODate } from "./dates";
import { money } from "./money";
import type { FinanceData } from "./data";
import type { RecurringExpense, Transaction } from "./types";

/** Frequencies schedulable from a plain day-of-month, and their month step. */
const MONTH_STEP: Partial<Record<RecurringExpense["frequency"], number>> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/** Name-independent so renaming the expense later doesn't break the match. */
export function recurringExpenseNote(expense: RecurringExpense): string {
  return `Automatically logged from the recurring expense schedule (#${expense.id}).`;
}

export interface RecurringExpenseSync {
  created: Transaction[];
  changed: boolean;
}

/**
 * Log each missing occurrence of every fully-configured active recurring
 * expense on or before `through`. An expense missing a due day, account, or
 * category is left alone - it isn't set up for auto-logging yet.
 */
export async function backfillRecurringExpenses(
  data: FinanceData,
  options: { through?: ISODate } = {},
): Promise<RecurringExpenseSync> {
  const through = options.through ?? todayISO();
  const created: Transaction[] = [];

  for (const expense of data.recurringExpenses) {
    if (!expense.is_active) continue;
    if (expense.due_day === null || expense.account_id === null || expense.category_id === null) continue;
    const step = MONTH_STEP[expense.frequency];
    if (!step) continue;

    const note = recurringExpenseNote(expense);
    const amount = money(expense.amount);
    let cursor = planMonthOf(expense.created_at.slice(0, 10) as ISODate);

    while (cursor <= through) {
      const { year, month } = parts(cursor);
      const dueDate = toISO(year, month, Math.min(expense.due_day, daysInMonth(year, month)));

      if (dueDate <= through) {
        const alreadyLogged = data.transactions.some(
          (t) => t.account_id === expense.account_id && t.transaction_date === dueDate && t.notes === note,
        );
        if (!alreadyLogged) {
          try {
            const row = await addTransaction({
              transaction_date: dueDate,
              account_id: expense.account_id,
              description: expense.name,
              amount,
              transaction_type: "expense",
              category_id: expense.category_id,
              notes: note,
              source: "recurring",
            });
            data.transactions.push(row);
            created.push(row);
          } catch (error) {
            // Same account/date/description/amount already exists, most
            // likely because the user logged this exact bill by hand.
            if (!(error instanceof DuplicateTransactionError)) throw error;
          }
        }
      }

      cursor = addMonths(cursor, step);
    }
  }

  return { created, changed: created.length > 0 };
}
