// Accounts — the balance sheet and everything that happened on it.
//
// This was three pages: Accounts, Transactions, and Spending. They were three
// answers to one question — where is my money and what did it do — and reading
// them meant holding one page in your head while looking at another. The
// balances, the ledger, and the category split now sit on one page, in that
// order, because that is the order you actually ask them in.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import {
  Advisory, Button, Card, Empty, Field, FormActions, Modal, Money, PageHead, SectionHead, Tag,
} from "../components/ui";
import { SpendingDonut } from "../components/charts";
import { useAction } from "../lib/actions";
import {
  categorySpendingForRange, currentAccountBalances, liquidCash, netWorth,
  resolveSpendingPeriod, spendingTotalForRange, SPENDING_PERIODS,
} from "../lib/finance";
import {
  createAccount, createTransaction, editAccount, recordTransfer, removeAccount, setAccountBalance,
} from "../lib/mutations";
import { fmtMoney, fmtPercent, percentOf } from "../lib/money";
import { accountName, categoryName, type FinanceData } from "../lib/data";
import { fmtDate, todayISO } from "../lib/dates";
import type { Account, AccountType } from "../lib/types";
import { ACCOUNT_TYPE_LABELS } from "../lib/types";

/** The subset offered in the picker, in the order the original listed them. */
const SELECTABLE_TYPES: AccountType[] = [
  "checking", "savings", "credit_card", "roth_401k", "traditional_401k",
  "roth_ira", "traditional_ira", "taxable_brokerage", "other_asset", "other_liability",
];

interface FormState {
  name: string;
  account_type: AccountType;
  opening_balance: string;
  institution: string;
  last_four: string;
  apy: string;
  statement_balance: string;
  cashback_rate: string;
  closing_day: string;
  due_day: string;
}

const BLANK: FormState = {
  name: "", account_type: "checking", opening_balance: "0", institution: "", last_four: "",
  apy: "0", statement_balance: "0", cashback_rate: "0", closing_day: "", due_day: "",
};

function fromAccount(account: Account): FormState {
  return {
    name: account.name,
    account_type: account.account_type,
    opening_balance: "0",
    institution: account.institution ?? "",
    last_four: account.last_four ?? "",
    apy: String(account.apy),
    statement_balance: String(account.statement_balance),
    cashback_rate: String(account.cashback_rate),
    closing_day: account.statement_closing_day ? String(account.statement_closing_day) : "",
    due_day: account.payment_due_day ? String(account.payment_due_day) : "",
  };
}

export default function Accounts() {
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<FormState>(BLANK);
  const [balanceDrafts, setBalanceDrafts] = useState<Record<number, string>>({});

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const openAdd = () => {
    setForm(BLANK);
    setAdding(true);
  };

  const openEdit = (account: Account) => {
    setForm(fromAccount(account));
    setEditing(account);
  };

  return (
    <PageFrame title="Accounts" message={action.message} error={action.error}>
      {(data) => {
        const balances = currentAccountBalances(data);
        const accounts = [...data.accounts].sort((a, b) => {
          if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
          return a.id - b.id;
        });

        const submitAdd = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            const message = await createAccount(current, form);
            setAdding(false);
            return message;
          });
        };

        const submitEdit = async (event: React.FormEvent) => {
          event.preventDefault();
          if (!editing) return;
          await action.run(async (current) => {
            const message = await editAccount(current, editing.id, form);
            setEditing(null);
            return message;
          });
        };

        const isCredit = form.account_type === "credit_card";

        return (
          <>
            <PageHead
              eyebrow="Balance sheet"
              title="Accounts"
              subtitle="What you hold, what moved, and what it went on."
              actions={<Button onClick={openAdd}>+ Add account</Button>}
            />

            <section className="grid three-col">
              <Card>
                <span className="metric-label">Net worth</span>
                <div className="metric-value">{fmtMoney(netWorth(data))}</div>
                <div className="metric-note">Assets minus what you owe</div>
              </Card>
              <Card>
                <span className="metric-label">Liquid cash</span>
                <div className="metric-value">{fmtMoney(liquidCash(data))}</div>
                <div className="metric-note">Checking and savings you could reach today</div>
              </Card>
              <Card>
                <span className="metric-label">Accounts</span>
                <div className="metric-value">{accounts.filter((a) => a.is_active).length}</div>
                <div className="metric-note">{accounts.length - accounts.filter((a) => a.is_active).length} inactive</div>
              </Card>
            </section>

            <div className="account-grid">
              {accounts.map((account) => {
                const balance = balances.get(account.id);
                const draft = balanceDrafts[account.id] ?? (balance ? balance.toFixed(2) : "0.00");
                return (
                  <Card key={account.id} pad={false} className="account-card">
                    <div className="account-head">
                      <div>
                        <div className="account-type">{ACCOUNT_TYPE_LABELS[account.account_type]}</div>
                        <h2>{account.name}</h2>
                      </div>
                      <Tag tone={account.account_type === "credit_card" ? "gold" : "green"}>
                        {account.is_liability ? "Liability" : "Asset"}
                      </Tag>
                    </div>

                    <div className="account-balance">{fmtMoney(balance ?? 0)}</div>

                    {account.account_type === "credit_card" ? (
                      <div className="account-detail">
                        <span>
                          Statement <strong>{fmtMoney(account.statement_balance)}</strong>
                        </span>
                        <span>
                          Due <strong>day {account.payment_due_day ?? "—"}</strong>
                        </span>
                        <span>
                          Cashback <strong>{fmtPercent(account.cashback_rate, 2)}</strong>
                        </span>
                      </div>
                    ) : (
                      <div className="account-detail">
                        <span>{account.institution || "Personal account"}</span>
                        <span>{account.include_in_net_worth ? "In net worth" : "Excluded"}</span>
                      </div>
                    )}

                    <form
                      className="inline-form"
                      style={{ marginTop: 14 }}
                      onSubmit={async (event) => {
                        event.preventDefault();
                        await action.run((current) =>
                          setAccountBalance(current, account.id, draft, todayISO()),
                        );
                      }}
                    >
                      <Field label="Update balance">
                        <input
                          type="number"
                          step="0.01"
                          value={draft}
                          onChange={(event) =>
                            setBalanceDrafts((current) => ({
                              ...current,
                              [account.id]: event.target.value,
                            }))
                          }
                          required
                        />
                      </Field>
                      <Button variant="secondary" small type="submit" disabled={action.busy}>
                        Save
                      </Button>
                    </form>

                    <div className="button-row" style={{ marginTop: 8 }}>
                      <Button variant="secondary" small onClick={() => openEdit(account)}>
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        small
                        disabled={action.busy}
                        onClick={() => {
                          const confirmed = window.confirm(
                            `Delete ${account.name}? This only works if it has no transactions, transfers, or other history.`,
                          );
                          if (confirmed) void action.run((current) => removeAccount(current, account));
                        }}
                      >
                        Delete account
                      </Button>
                    </div>
                  </Card>
                );
              })}

              {accounts.length === 0 && <p className="empty">No accounts yet.</p>}
            </div>

            <Activity data={data} action={action} />

            <Modal
              open={adding || editing !== null}
              onClose={() => {
                setAdding(false);
                setEditing(null);
              }}
              eyebrow={editing ? "Edit account" : "New account"}
              title={editing ? editing.name : "Add account"}
            >
              <form onSubmit={editing ? submitEdit : submitAdd}>
                <div className="form-grid">
                  <Field label="Name">
                    <input
                      value={form.name}
                      onChange={(event) => set("name", event.target.value)}
                      maxLength={100}
                      placeholder="Everyday Checking"
                      required
                    />
                  </Field>
                  <Field label="Type">
                    <select
                      value={form.account_type}
                      onChange={(event) => set("account_type", event.target.value as AccountType)}
                      required
                    >
                      {SELECTABLE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {ACCOUNT_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {!editing && (
                    <Field label="Opening / latest balance">
                      <input
                        type="number"
                        step="0.01"
                        value={form.opening_balance}
                        onChange={(event) => set("opening_balance", event.target.value)}
                        required
                      />
                    </Field>
                  )}

                  <Field label="Institution (optional)">
                    <input
                      value={form.institution}
                      onChange={(event) => set("institution", event.target.value)}
                      maxLength={100}
                    />
                  </Field>
                  <Field label="Last four digits (optional)">
                    <input
                      value={form.last_four}
                      onChange={(event) => set("last_four", event.target.value)}
                      maxLength={4}
                      pattern="[0-9]{4}"
                    />
                  </Field>
                  <Field label="Savings APY %">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.apy}
                      onChange={(event) => set("apy", event.target.value)}
                    />
                  </Field>
                </div>

                {/* Card-only fields, shown when the type calls for them. */}
                {isCredit && (
                  <div className="form-grid" style={{ marginTop: 14 }}>
                    <Field label="Statement balance">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.statement_balance}
                        onChange={(event) => set("statement_balance", event.target.value)}
                      />
                    </Field>
                    <Field label="Cashback %">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.cashback_rate}
                        onChange={(event) => set("cashback_rate", event.target.value)}
                      />
                    </Field>
                    <Field label="Statement closing day">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={form.closing_day}
                        onChange={(event) => set("closing_day", event.target.value)}
                      />
                    </Field>
                    <Field label="Payment due day">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={form.due_day}
                        onChange={(event) => set("due_day", event.target.value)}
                      />
                    </Field>
                  </div>
                )}

                <FormActions>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAdding(false);
                      setEditing(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={action.busy}>
                    {editing ? "Save changes" : "Add account"}
                  </Button>
                </FormActions>
              </form>
            </Modal>
          </>
        );
      }}
    </PageFrame>
  );
}


// --- activity: the ledger and the category split ----------------------------

const BLANK_TRANSACTION = {
  transaction_date: todayISO(),
  account_id: "",
  description: "",
  amount: "",
  transaction_type: "expense",
  category_id: "",
  subcategory_id: "",
  notes: "",
  is_recurring: false,
};

const BLANK_TRANSFER = {
  transfer_date: todayISO(),
  transfer_kind: "account_transfer",
  source_account_id: "",
  destination_account_id: "",
  amount: "",
  description: "Account transfer",
};

/** How many ledger rows to show before the list stops being readable. */
const LEDGER_LIMIT = 60;

function Activity({
  data,
  action,
}: {
  data: FinanceData;
  action: ReturnType<typeof useAction>;
}) {
  const [periodKey, setPeriodKey] = useState("last_3_months");
  const [showTransaction, setShowTransaction] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transaction, setTransaction] = useState(BLANK_TRANSACTION);
  const [transfer, setTransfer] = useState(BLANK_TRANSFER);

  const period = resolveSpendingPeriod(periodKey);
  const periodLabel = SPENDING_PERIODS.find(([key]) => key === period.key)?.[1] ?? "Last 3 months";
  const rows = categorySpendingForRange(data, period.start, period.end).map(([name, amount]) => ({
    name,
    amount,
  }));
  const periodSpending = spendingTotalForRange(data, period.start, period.end);

  const parents = data.categories.filter((c) => c.parent_id === null && c.is_active);
  const children = data.categories.filter((c) => c.parent_id !== null && c.is_active);

  // Newest first, and by id within a day so a same-day pair keeps the order it
  // was entered in.
  const ledger = [...data.transactions]
    .filter((item) => item.transaction_date >= period.start && item.transaction_date <= period.end)
    .sort((a, b) =>
      a.transaction_date === b.transaction_date
        ? b.id - a.id
        : a.transaction_date < b.transaction_date
          ? 1
          : -1,
    );

  const submitTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    await action.run(async (current) => {
      const message = await createTransaction(current, transaction);
      setShowTransaction(false);
      setTransaction({ ...BLANK_TRANSACTION, account_id: transaction.account_id });
      return message;
    });
  };

  const submitTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    await action.run(async (current) => {
      const message = await recordTransfer(current, transfer);
      setShowTransfer(false);
      setTransfer(BLANK_TRANSFER);
      return message;
    });
  };

  const periodPicker = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Tag tone="gold">{fmtMoney(periodSpending)}</Tag>
      <select
        className="period-select"
        aria-label="Period"
        value={period.key}
        onChange={(event) => setPeriodKey(event.target.value)}
      >
        {SPENDING_PERIODS.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <section className="grid two-col" style={{ marginTop: 18 }}>
        <Card pad={false} className="chart-card">
          <SectionHead
            title="What you spent it on"
            caption={`Five intentionally broad groups · ${periodLabel.toLowerCase()}`}
            aside={periodPicker}
          />
          <SpendingDonut rows={rows} />
        </Card>

        <Card>
          <SectionHead title="Category totals" caption={periodLabel} />
          {rows.length === 0 ? (
            <p className="empty">No spending in this period.</p>
          ) : (
            rows.map((row) => (
              <div className="obligation" key={row.name}>
                <div className="obligation-info">
                  <strong>{row.name}</strong>
                  <span>{percentOf(row.amount, periodSpending).toFixed(1)}% of spending</span>
                </div>
                <span className="obligation-amount">{fmtMoney(row.amount)}</span>
              </div>
            ))
          )}
        </Card>
      </section>

      <article className="card" style={{ marginTop: 18 }}>
        <div className="card-pad" style={{ paddingBottom: 6 }}>
          <SectionHead
            title="Everything that moved"
            caption={`${periodLabel} · newest first${ledger.length > LEDGER_LIMIT ? `, showing ${LEDGER_LIMIT} of ${ledger.length}` : ""}`}
            aside={
              <div className="button-row">
                <Button variant="secondary" small onClick={() => setShowTransfer(true)}>
                  Record transfer
                </Button>
                <Button small onClick={() => setShowTransaction(true)}>
                  + Transaction
                </Button>
              </div>
            }
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Account</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <Empty colSpan={5}>Nothing recorded in this period.</Empty>
              ) : (
                ledger.slice(0, LEDGER_LIMIT).map((item) => (
                  <tr key={item.id}>
                    <td className="small-text">{fmtDate(item.transaction_date)}</td>
                    <td>
                      <strong>{item.description}</strong>{" "}
                      {item.is_transfer && <Tag>Transfer</Tag>}{" "}
                      {item.is_recurring && <Tag tone="gold">Recurring</Tag>}
                    </td>
                    <td className="muted small-text">{accountName(data, item.account_id)}</td>
                    <td className="small-text">
                      {item.category_id ? categoryName(data, item.category_id) : "—"}
                      {item.subcategory_id && (
                        <div className="muted">{categoryName(data, item.subcategory_id)}</div>
                      )}
                    </td>
                    <td>
                      <Money
                        value={item.amount}
                        income={item.transaction_type === "income"}
                        signed={item.transaction_type === "income"}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <Modal
        open={showTransaction}
        onClose={() => setShowTransaction(false)}
        eyebrow="Manual entry"
        title="Add transaction"
      >
        <form onSubmit={submitTransaction}>
          <div className="form-grid">
            <Field label="Date">
              <input
                type="date"
                value={transaction.transaction_date}
                onChange={(event) =>
                  setTransaction({ ...transaction, transaction_date: event.target.value })
                }
                required
              />
            </Field>
            <Field label="Account">
              <AccountSelect
                data={data}
                value={transaction.account_id}
                onChange={(value) => setTransaction({ ...transaction, account_id: value })}
              />
            </Field>
            <Field label="Merchant / description" full>
              <input
                minLength={2}
                maxLength={180}
                value={transaction.description}
                onChange={(event) => setTransaction({ ...transaction, description: event.target.value })}
                required
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={transaction.amount}
                onChange={(event) => setTransaction({ ...transaction, amount: event.target.value })}
                required
              />
            </Field>
            <Field label="Type">
              <select
                value={transaction.transaction_type}
                onChange={(event) =>
                  setTransaction({ ...transaction, transaction_type: event.target.value })
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="refund">Refund</option>
              </select>
            </Field>
            <Field label="Primary category">
              <select
                value={transaction.category_id}
                onChange={(event) => setTransaction({ ...transaction, category_id: event.target.value })}
              >
                <option value="">Uncategorized</option>
                {parents.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subcategory">
              <select
                value={transaction.subcategory_id}
                onChange={(event) =>
                  setTransaction({ ...transaction, subcategory_id: event.target.value })
                }
              >
                <option value="">None</option>
                {children
                  .filter(
                    (category) =>
                      !transaction.category_id ||
                      String(category.parent_id) === transaction.category_id,
                  )
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <label className="checkbox" style={{ marginTop: 12 }}>
            <input
              type="checkbox"
              checked={transaction.is_recurring}
              onChange={(event) =>
                setTransaction({ ...transaction, is_recurring: event.target.checked })
              }
            />
            This is recurring
          </label>

          <FormActions>
            <Button variant="secondary" onClick={() => setShowTransaction(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={action.busy}>
              Save transaction
            </Button>
          </FormActions>
        </form>
      </Modal>

      <Modal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        eyebrow="Internal movement"
        title="Record transfer or payment"
      >
        <form onSubmit={submitTransfer}>
          <div className="form-grid">
            <Field label="Date">
              <input
                type="date"
                value={transfer.transfer_date}
                onChange={(event) => setTransfer({ ...transfer, transfer_date: event.target.value })}
                required
              />
            </Field>
            <Field label="Kind">
              <select
                value={transfer.transfer_kind}
                onChange={(event) => setTransfer({ ...transfer, transfer_kind: event.target.value })}
              >
                <option value="account_transfer">Account transfer</option>
                <option value="card_payment">Credit-card payment</option>
              </select>
            </Field>
            <Field label="From">
              <AccountSelect
                data={data}
                value={transfer.source_account_id}
                onChange={(value) => setTransfer({ ...transfer, source_account_id: value })}
              />
            </Field>
            <Field label="To">
              <AccountSelect
                data={data}
                value={transfer.destination_account_id}
                onChange={(value) => setTransfer({ ...transfer, destination_account_id: value })}
              />
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={transfer.amount}
                onChange={(event) => setTransfer({ ...transfer, amount: event.target.value })}
                required
              />
            </Field>
            <Field label="Description">
              <input
                value={transfer.description}
                onChange={(event) => setTransfer({ ...transfer, description: event.target.value })}
              />
            </Field>
          </div>

          <Advisory>This creates a linked debit and credit. Neither entry counts as spending.</Advisory>

          <FormActions>
            <Button variant="secondary" onClick={() => setShowTransfer(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={action.busy}>
              Record transfer
            </Button>
          </FormActions>
        </form>
      </Modal>
    </>
  );
}

function AccountSelect({
  data,
  value,
  onChange,
  id,
}: {
  data: FinanceData;
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="" disabled>
        Choose an account
      </option>
      {data.accounts
        .filter((account) => account.is_active)
        .map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
    </select>
  );
}
