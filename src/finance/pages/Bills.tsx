// Bills — every fixed cost, in one editable list.
//
// This is the page that has to be effortless, because it is the only thing that
// genuinely needs keeping up to date: rent goes up, a subscription lapses, the
// insurance renews at a different number. Everything else in the app is derived
// from these rows and from the paycheck.
//
// Two tables feed it. `fin_recurring_expenses` and `fin_subscriptions` model the
// same thing and the original app gave them a page each; here they are one list,
// sorted by what they actually cost per month. New bills are written as
// recurring expenses — the subscription rows stay editable so nothing has to be
// migrated by hand, but there is no reason to keep creating them.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Button, Card, Field, FormActions, Modal, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { monthlyEquivalent } from "../lib/allocation";
import {
  createRecurringExpense, removeRecurringExpense, removeSubscription,
  updateRecurringExpense, updateSubscription,
} from "../lib/mutations";
import { Decimal, fmtMoney, sum as sumMoney } from "../lib/money";
import type { FinanceData } from "../lib/data";
import { FREQUENCIES, FREQUENCY_LABELS, type Frequency } from "../lib/types";

type Source = "recurring" | "subscription";

interface Bill {
  source: Source;
  id: number;
  name: string;
  amount: Decimal;
  frequency: Frequency;
  dueDay: number | null;
  /** What it costs per month once the frequency is levelled out. */
  monthly: Decimal;
  accountId: number | null;
  categoryId: number | null;
}

const BLANK = { name: "", amount: "", frequency: "monthly", due_day: "", account_id: "", category_id: "" };

function collectBills(data: FinanceData): Bill[] {
  const bills: Bill[] = [
    ...data.recurringExpenses
      .filter((row) => row.is_active)
      .map((row) => ({
        source: "recurring" as const,
        id: row.id,
        name: row.name,
        amount: new Decimal(row.amount),
        frequency: row.frequency,
        dueDay: row.due_day,
        monthly: monthlyEquivalent(row.amount, row.frequency),
        accountId: row.account_id,
        categoryId: row.category_id,
      })),
    ...data.subscriptions
      .filter((row) => row.is_active)
      .map((row) => ({
        source: "subscription" as const,
        id: row.id,
        name: row.name,
        amount: new Decimal(row.amount),
        frequency: row.billing_frequency,
        dueDay: null,
        monthly: monthlyEquivalent(row.amount, row.billing_frequency),
        accountId: row.account_id,
        categoryId: row.category_id,
      })),
  ];
  bills.sort((a, b) => {
    const byMonthly = b.monthly.comparedTo(a.monthly);
    return byMonthly !== 0 ? byMonthly : a.name.localeCompare(b.name);
  });
  return bills;
}

export default function Bills() {
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [editing, setEditing] = useState<Bill | null>(null);

  return (
    <PageFrame title="Bills" message={action.message} error={action.error}>
      {(data) => {
        const bills = collectBills(data);
        // Monthly and weekly costs are the rhythm of a month; anything rarer is
        // money you have to remember, which is a different mental job.
        const regular = bills.filter((bill) => ["weekly", "biweekly", "monthly"].includes(bill.frequency));
        const periodic = bills.filter((bill) => !["weekly", "biweekly", "monthly"].includes(bill.frequency));
        const monthlyTotal = sumMoney(bills.map((bill) => bill.monthly));
        const yearlyTotal = monthlyTotal.times(12);

        const add = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            const message = await createRecurringExpense(current, draft);
            setAdding(false);
            setDraft(BLANK);
            return message;
          });
        };

        const remove = (bill: Bill) =>
          action.run((current) =>
            bill.source === "recurring"
              ? removeRecurringExpense(current, bill.id)
              : removeSubscription(current, bill.id),
          );

        return (
          <>
            <PageHead
              eyebrow="Fixed costs"
              title="Bills"
              subtitle="Everything that comes out whether you think about it or not. Money Flow takes these off the top."
              actions={<Button onClick={() => setAdding(true)}>+ Add bill</Button>}
            />

            <section className="grid three-col">
              <Card>
                <span className="metric-label">Per month</span>
                <div className="metric-value">{fmtMoney(monthlyTotal)}</div>
                <div className="metric-note">{bills.length} bills, levelled out</div>
              </Card>
              <Card>
                <span className="metric-label">Per year</span>
                <div className="metric-value">{fmtMoney(yearlyTotal)}</div>
                <div className="metric-note">What these cost you over twelve months</div>
              </Card>
              <Card>
                <span className="metric-label">Not monthly</span>
                <div className="metric-value">{periodic.length}</div>
                <div className="metric-note">Annual and quarterly costs, spread out above</div>
              </Card>
            </section>

            <BillList
              title="Every month"
              caption="Rent, utilities, subscriptions — the steady ones"
              bills={regular}
              onEdit={setEditing}
              onRemove={remove}
              busy={action.busy}
              data={data}
            />

            <BillList
              title="Now and then"
              caption="Annual and quarterly costs, shown at what they work out to per month"
              bills={periodic}
              onEdit={setEditing}
              onRemove={remove}
              busy={action.busy}
              data={data}
            />

            <Modal open={adding} onClose={() => setAdding(false)} eyebrow="Fixed cost" title="Add a bill">
              <form onSubmit={add}>
                <div className="form-grid">
                  <Field label="Name" full>
                    <input
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Amount">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.amount}
                      onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="How often">
                    <select
                      value={draft.frequency}
                      onChange={(event) => setDraft({ ...draft, frequency: event.target.value })}
                    >
                      {FREQUENCIES.map((frequency) => (
                        <option key={frequency} value={frequency}>
                          {FREQUENCY_LABELS[frequency]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Day of the month (optional)" hint="Only used to sort your bills by when they land.">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={draft.due_day}
                      onChange={(event) => setDraft({ ...draft, due_day: event.target.value })}
                    />
                  </Field>
                  <Field label="Paid from">
                    <select
                      value={draft.account_id}
                      onChange={(event) => setDraft({ ...draft, account_id: event.target.value })}
                    >
                      <option value="">Not set</option>
                      {data.accounts
                        .filter((account) => account.is_active)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field
                    label="Category"
                    full
                    hint="Needed so this bill counts toward your spending breakdown once it's logged."
                  >
                    <select
                      value={draft.category_id}
                      onChange={(event) => setDraft({ ...draft, category_id: event.target.value })}
                    >
                      <option value="">Uncategorized</option>
                      {data.categories
                        .filter((category) => category.parent_id === null && category.is_active)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <FormActions>
                  <Button variant="secondary" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={action.busy}>
                    Add bill
                  </Button>
                </FormActions>
              </form>
            </Modal>

            <EditBill
              bill={editing}
              onClose={() => setEditing(null)}
              action={action}
              data={data}
            />
          </>
        );
      }}
    </PageFrame>
  );
}

function BillList({
  title, caption, bills, onEdit, onRemove, busy, data,
}: {
  title: string;
  caption: string;
  bills: Bill[];
  onEdit: (bill: Bill) => void;
  onRemove: (bill: Bill) => void;
  busy: boolean;
  data: FinanceData;
}) {
  const total = sumMoney(bills.map((bill) => bill.monthly));
  const accountNames = new Map(data.accounts.map((account) => [account.id, account.name]));

  return (
    <Card>
      <SectionHead title={title} caption={caption} aside={<Tag tone="gold">{fmtMoney(total)}/mo</Tag>} />
      {bills.length === 0 ? (
        <p className="empty">Nothing here yet.</p>
      ) : (
        <div className="plan-rows">
          {bills.map((bill) => (
            <div className="plan-row bill-row" key={`${bill.source}-${bill.id}`}>
              <div className="plan-row-label">
                <strong>{bill.name}</strong>
                <span className="flow-note">
                  {FREQUENCY_LABELS[bill.frequency] ?? bill.frequency}
                  {bill.dueDay ? ` · day ${bill.dueDay}` : ""}
                  {bill.accountId ? ` · ${accountNames.get(bill.accountId) ?? "—"}` : ""}
                </span>
              </div>
              <div className="bill-amounts">
                <span className="flow-amount">{fmtMoney(bill.amount)}</span>
                {!bill.monthly.equals(bill.amount) && (
                  <small className="muted">{fmtMoney(bill.monthly)}/mo</small>
                )}
              </div>
              <div className="button-row">
                <Button variant="secondary" small onClick={() => onEdit(bill)} disabled={busy}>
                  Edit
                </Button>
                <Button variant="secondary" small onClick={() => onRemove(bill)} disabled={busy}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EditBill({
  bill, onClose, action, data,
}: {
  bill: Bill | null;
  onClose: () => void;
  action: ReturnType<typeof useAction>;
  data: FinanceData;
}) {
  // Keyed on the bill so opening a different row remounts with its own values
  // rather than carrying the last one's over.
  if (!bill) return null;
  return <EditBillForm key={`${bill.source}-${bill.id}`} bill={bill} onClose={onClose} action={action} data={data} />;
}

function EditBillForm({
  bill, onClose, action, data,
}: {
  bill: Bill;
  onClose: () => void;
  action: ReturnType<typeof useAction>;
  data: FinanceData;
}) {
  const [form, setForm] = useState({
    name: bill.name,
    amount: bill.amount.toFixed(2),
    frequency: bill.frequency as string,
    due_day: bill.dueDay ? String(bill.dueDay) : "",
    account_id: bill.accountId ? String(bill.accountId) : "",
    category_id: bill.categoryId ? String(bill.categoryId) : "",
  });

  const cashAccounts = data.accounts.filter((account) => account.is_active);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await action.run(async (current) => {
      const message =
        bill.source === "recurring"
          ? await updateRecurringExpense(current, bill.id, {
              name: form.name,
              amount: form.amount,
              frequency: form.frequency,
              due_day: form.due_day,
              account_id: form.account_id,
              category_id: form.category_id,
            })
          : await updateSubscription(current, bill.id, {
              name: form.name,
              amount: form.amount,
              billing_frequency: form.frequency,
            });
      onClose();
      return message;
    });
  };

  return (
    <Modal open onClose={onClose} eyebrow="Fixed cost" title={`Edit ${bill.name}`}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name" full>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Amount">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              required
            />
          </Field>
          <Field label="How often">
            <select
              value={form.frequency}
              onChange={(event) => setForm({ ...form, frequency: event.target.value })}
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {FREQUENCY_LABELS[frequency]}
                </option>
              ))}
            </select>
          </Field>
          {bill.source === "recurring" && (
            <>
              <Field label="Day of the month">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={form.due_day}
                  onChange={(event) => setForm({ ...form, due_day: event.target.value })}
                />
              </Field>
              <Field label="Paid from">
                <select
                  value={form.account_id}
                  onChange={(event) => setForm({ ...form, account_id: event.target.value })}
                >
                  <option value="">Not set</option>
                  {cashAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Category" full>
                <select
                  value={form.category_id}
                  onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                >
                  <option value="">Uncategorized</option>
                  {data.categories
                    .filter((category) => category.parent_id === null && category.is_active)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </Field>
            </>
          )}
        </div>
        <p className="small-text muted">
          Works out to <strong>{fmtMoney(monthlyEquivalent(form.amount || "0", form.frequency))}</strong> per
          month.
        </p>
        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={action.busy}>
            Save
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}