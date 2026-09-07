// Accounts - the balance sheet. Ported from templates/accounts.html.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Button, Card, Field, FormActions, Modal, PageHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { currentAccountBalances } from "../lib/finance";
import { createAccount, editAccount, removeAccount, setAccountBalance } from "../lib/mutations";
import { fmtMoney, fmtPercent } from "../lib/money";
import { todayISO } from "../lib/dates";
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
              subtitle="Your owned accounts and latest reported balances."
              actions={<Button onClick={openAdd}>+ Add account</Button>}
            />

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
