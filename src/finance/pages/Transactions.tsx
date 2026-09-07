// Transactions - the ledger. Ported from templates/transactions.html.
//
// Purchases are recorded on their spending date; account movements and card
// payments go through the transfer form instead, which writes a linked pair
// that never counts as spending.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import {
  Advisory, Button, Empty, Field, FormActions, Modal, Money, PageHead, TableCard, Tag,
} from "../components/ui";
import { useAction } from "../lib/actions";
import { createTransaction, recordTransfer } from "../lib/mutations";
import { accountName, categoryName } from "../lib/data";
import { fmtDate, todayISO } from "../lib/dates";
import type { FinanceData } from "../lib/data";

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

export default function Transactions() {
  const action = useAction();
  const [showTransaction, setShowTransaction] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transaction, setTransaction] = useState(BLANK_TRANSACTION);
  const [transfer, setTransfer] = useState(BLANK_TRANSFER);

  return (
    <PageFrame title="Transactions" message={action.message} error={action.error}>
      {(data) => {
        const accounts = data.accounts.filter((account) => account.is_active);
        const parents = data.categories.filter((c) => c.parent_id === null && c.is_active);
        const children = data.categories.filter((c) => c.parent_id !== null && c.is_active);

        // Newest first, and by id within a day so a same-day pair keeps the
        // order it was entered in.
        const rows = [...data.transactions].sort((a, b) =>
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

        return (
          <>
            <PageHead
              eyebrow="Ledger"
              title="Transactions"
              subtitle="Record purchase activity on its spending date. Use a transfer for account movements and card payments."
              actions={
                <>
                  <Button variant="secondary" onClick={() => setShowTransfer(true)}>
                    Record transfer
                  </Button>
                  <Button onClick={() => setShowTransaction(true)}>+ Add transaction</Button>
                </>
              }
            />

            <TableCard
              head={
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Amount</th>
                </tr>
              }
            >
              {rows.length === 0 ? (
                <Empty colSpan={6}>No transactions yet.</Empty>
              ) : (
                rows.map((item) => (
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
                      <Tag>{item.source}</Tag>
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
            </TableCard>

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
                      onChange={(event) =>
                        setTransaction({ ...transaction, description: event.target.value })
                      }
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
                </div>

                <div className="form-grid" style={{ marginTop: 14 }}>
                  <Field label="Primary category">
                    <select
                      value={transaction.category_id}
                      onChange={(event) =>
                        setTransaction({ ...transaction, category_id: event.target.value })
                      }
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
                        // Once a parent is chosen, only its own children apply.
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

                <div className="field" style={{ marginTop: 14 }}>
                  <label htmlFor="transaction-notes">Notes</label>
                  <textarea
                    id="transaction-notes"
                    value={transaction.notes}
                    onChange={(event) => setTransaction({ ...transaction, notes: event.target.value })}
                  />
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
                  <Button type="submit" disabled={action.busy}>
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

                <Advisory>
                  This creates a linked debit and credit. Neither entry counts as spending.
                </Advisory>

                <FormActions>
                  <Button variant="secondary" onClick={() => setShowTransfer(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={action.busy}>
                    Record transfer
                  </Button>
                </FormActions>
              </form>
            </Modal>

            {accounts.length === 0 && (
              <p className="muted small-text" style={{ marginTop: 12 }}>
                Add an account before recording activity.
              </p>
            )}
          </>
        );
      }}
    </PageFrame>
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
