// Investments - local portfolio tracking. Ported from templates/investments.html.

import { useRef, useState } from "react";
import PageFrame from "../components/PageFrame";
import {
  Button, Card, Empty, Field, FormActions, Metric, Modal, PageHead, SectionHead, Tag,
} from "../components/ui";
import { InvestmentValueChart } from "../components/charts";
import { useAction } from "../lib/actions";
import {
  importHoldingsCsv, INVESTMENT_TYPES, investmentHistory, investmentSummary,
  recordInvestmentActivity, upsertHolding,
} from "../lib/investments";
import { accountName } from "../lib/data";
import { dec, fmtMoney, money, quantize } from "../lib/money";
import { fmtDate, todayISO } from "../lib/dates";

const BLANK_HOLDING = {
  account_id: "",
  tax_treatment: "taxable",
  as_of_date: todayISO(),
  symbol: "",
  name: "",
  security_type: "etf",
  quantity: "",
  cost_basis: "",
  price: "",
};

const BLANK_ACTIVITY = {
  account_id: "",
  transaction_date: todayISO(),
  transaction_type: "contribution",
  amount: "",
  fees: "0",
  notes: "",
};

const CSV_EXAMPLE = `account,symbol,quantity,cost_basis,price,as_of_date,name,security_type,tax_treatment
Roth 401(k),VTI,12.5,2800,252.10,2026-08-23,Vanguard Total Stock Market ETF,etf,roth`;

export default function Investments() {
  const action = useAction();
  const [showHolding, setShowHolding] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [holding, setHolding] = useState(BLANK_HOLDING);
  const [activity, setActivity] = useState(BLANK_ACTIVITY);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <PageFrame title="Investments" message={action.message} error={action.error}>
      {(data) => {
        const summary = investmentSummary(data);
        const history = investmentHistory(data);
        const accounts = data.accounts.filter(
          (account) => account.is_active && INVESTMENT_TYPES.has(account.account_type),
        );
        const investmentAccountToAccount = new Map(
          data.investmentAccounts.map((row) => [row.id, row.account_id]),
        );
        const transactions = [...data.investmentTransactions].sort((a, b) =>
          a.transaction_date === b.transaction_date
            ? b.id - a.id
            : a.transaction_date < b.transaction_date
              ? 1
              : -1,
        );

        const submitHolding = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            await upsertHolding(current, {
              accountId: Number(holding.account_id),
              taxTreatment: holding.tax_treatment,
              symbol: holding.symbol,
              name: holding.name,
              securityType: holding.security_type,
              quantity: quantize(dec(holding.quantity || "0"), 8),
              costBasis: money(holding.cost_basis || "0"),
              price: quantize(dec(holding.price || "0"), 8),
              asOfDate: holding.as_of_date,
            });
            setShowHolding(false);
            setHolding(BLANK_HOLDING);
            return "Holding snapshot saved.";
          });
        };

        const submitActivity = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            await recordInvestmentActivity(current, {
              accountId: Number(activity.account_id),
              transactionDate: activity.transaction_date,
              transactionType: activity.transaction_type,
              amount: money(activity.amount || "0"),
              fees: money(activity.fees || "0"),
              notes: activity.notes.trim() || null,
            });
            setShowActivity(false);
            setActivity(BLANK_ACTIVITY);
            return "Investment activity recorded.";
          });
        };

        const submitCsv = async (event: React.FormEvent) => {
          event.preventDefault();
          const file = fileRef.current?.files?.[0];
          if (!file) return;
          const text = await file.text();
          await action.run(async (current) => {
            const count = await importHoldingsCsv(current, text);
            if (fileRef.current) fileRef.current.value = "";
            return `Imported ${count} holding row(s).`;
          });
        };

        return (
          <>
            <PageHead
              eyebrow="Portfolio tracking"
              title="Investments"
              subtitle="Track brokerage and 401(k) positions, dated prices, contributions, and performance without depending on a live financial-data connection."
              actions={
                <Button variant="gold" onClick={() => setShowHolding(true)}>
                  Add or update holding
                </Button>
              }
            />

            <div className="principle-banner">
              <div className="principle-icon">✓</div>
              <div>
                <strong>Import-first by design</strong>
                <span>
                  Manual entries and CSV statements are authoritative. Live market and brokerage
                  APIs remain optional future enhancements.
                </span>
              </div>
              <Tag tone="green">No live feed</Tag>
            </div>

            <section className="grid metrics">
              <Metric
                label="Portfolio value"
                value={fmtMoney(summary.marketValue)}
                note="Latest recorded prices"
              />
              <Metric
                label="Cost basis"
                value={fmtMoney(summary.costBasis)}
                note={`Across ${summary.holdings.length} positions`}
              />
              <Metric
                label="Unrealized gain"
                value={
                  <span className={summary.unrealizedGain.greaterThanOrEqualTo(0) ? "income" : "danger"}>
                    {fmtMoney(summary.unrealizedGain)}
                  </span>
                }
                note="Market value less cost basis"
              />
              <Metric
                label="Tracked performance"
                value={
                  <span className={summary.performanceGain.greaterThanOrEqualTo(0) ? "income" : "danger"}>
                    {summary.performancePercent.toFixed(2)}%
                  </span>
                }
                note={`${fmtMoney(summary.performanceGain)} after recorded net contributions`}
              />
            </section>

            <section className="grid two-col">
              <Card pad={false} className="chart-card">
                <SectionHead
                  title="Portfolio history"
                  caption="Market value compared with cost basis"
                />
                <InvestmentValueChart points={history} />
              </Card>

              <Card>
                <SectionHead
                  title="Statement import"
                  caption="Repeatable snapshot format"
                  aside={<Tag tone="gold">CSV</Tag>}
                />
                <form onSubmit={submitCsv}>
                  <Field label="Holdings CSV">
                    <input ref={fileRef} type="file" name="file" accept=".csv,text/csv" required />
                  </Field>
                  <FormActions>
                    <Button type="submit" disabled={action.busy}>
                      Import holdings
                    </Button>
                  </FormActions>
                </form>
                <details style={{ marginTop: 14 }}>
                  <summary className="small-text">Required columns and example</summary>
                  <pre className="csv-example">{CSV_EXAMPLE}</pre>
                </details>
              </Card>
            </section>

            <article className="card" style={{ marginTop: 18 }}>
              <div className="card-pad" style={{ paddingBottom: 5 }}>
                <SectionHead
                  title="Current holdings"
                  caption="Allocation and security-level performance"
                  aside={
                    <Button variant="secondary" small onClick={() => setShowActivity(true)}>
                      Record activity
                    </Button>
                  }
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Security</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Market value</th>
                      <th>Cost basis</th>
                      <th>Gain / loss</th>
                      <th>Allocation</th>
                      <th>As of</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.holdings.length === 0 ? (
                      <Empty colSpan={9}>
                        No holdings yet. Add a brokerage or retirement account, then enter a holding
                        or import a statement CSV.
                      </Empty>
                    ) : (
                      summary.holdings.map((item) => (
                        <tr key={item.holding.id}>
                          <td>
                            <strong>{item.account.name}</strong>
                          </td>
                          <td>
                            <strong>{item.security.symbol}</strong>
                            <div className="small-text muted">{item.security.name}</div>
                          </td>
                          <td className="amount">{dec(item.holding.quantity).toString()}</td>
                          <td className="amount">{fmtMoney(item.price)}</td>
                          <td className="amount">{fmtMoney(item.marketValue)}</td>
                          <td className="amount">{fmtMoney(item.holding.cost_basis)}</td>
                          <td
                            className={`amount ${item.unrealizedGain.greaterThanOrEqualTo(0) ? "income" : "danger"}`}
                          >
                            {fmtMoney(item.unrealizedGain)}
                            <div className="small-text">{item.returnPercent.toFixed(2)}%</div>
                          </td>
                          <td className="amount">{item.allocationPercent.toFixed(2)}%</td>
                          <td>{item.holding.as_of_date ? fmtDate(item.holding.as_of_date) : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="card" style={{ marginTop: 18 }}>
              <div className="card-pad" style={{ paddingBottom: 5 }}>
                <h2>Contribution and activity ledger</h2>
                <div className="section-caption">
                  Contributions and withdrawals drive performance attribution; buys and sells
                  document activity without counting as external cash flow.
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Fees</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <Empty colSpan={6}>No investment activity recorded yet.</Empty>
                    ) : (
                      transactions.map((item) => (
                        <tr key={item.id}>
                          <td>{fmtDate(item.transaction_date)}</td>
                          <td>
                            {accountName(
                              data,
                              investmentAccountToAccount.get(item.investment_account_id) ?? null,
                            )}
                          </td>
                          <td>
                            <Tag>{item.transaction_type}</Tag>
                          </td>
                          <td className="amount">{fmtMoney(item.amount)}</td>
                          <td className="amount">{fmtMoney(item.fees)}</td>
                          <td className="muted">{item.notes || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <Modal
              open={showHolding}
              onClose={() => setShowHolding(false)}
              title="Add or update holding"
              eyebrow="The account, symbol, and date identify one snapshot"
            >
              <form onSubmit={submitHolding}>
                <div className="form-grid three">
                  <Field label="Account">
                    <select
                      value={holding.account_id}
                      onChange={(event) => setHolding({ ...holding, account_id: event.target.value })}
                      required
                    >
                      <option value="">Choose account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tax treatment">
                    <select
                      value={holding.tax_treatment}
                      onChange={(event) =>
                        setHolding({ ...holding, tax_treatment: event.target.value })
                      }
                    >
                      <option value="taxable">Taxable</option>
                      <option value="roth">Roth</option>
                      <option value="traditional">Traditional</option>
                      <option value="hsa">HSA</option>
                    </select>
                  </Field>
                  <Field label="As-of date">
                    <input
                      type="date"
                      value={holding.as_of_date}
                      onChange={(event) => setHolding({ ...holding, as_of_date: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Symbol">
                    <input
                      maxLength={20}
                      placeholder="VTI"
                      value={holding.symbol}
                      onChange={(event) => setHolding({ ...holding, symbol: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Security name">
                    <input
                      maxLength={150}
                      placeholder="Vanguard Total Stock Market ETF"
                      value={holding.name}
                      onChange={(event) => setHolding({ ...holding, name: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Type">
                    <select
                      value={holding.security_type}
                      onChange={(event) =>
                        setHolding({ ...holding, security_type: event.target.value })
                      }
                    >
                      <option value="etf">ETF</option>
                      <option value="stock">Stock</option>
                      <option value="mutual_fund">Mutual fund</option>
                      <option value="bond">Bond</option>
                      <option value="cash">Cash</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>
                  <Field label="Quantity">
                    <input
                      type="number"
                      min="0"
                      step="0.00000001"
                      value={holding.quantity}
                      onChange={(event) => setHolding({ ...holding, quantity: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Total cost basis">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={holding.cost_basis}
                      onChange={(event) => setHolding({ ...holding, cost_basis: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Price per unit">
                    <input
                      type="number"
                      min="0"
                      step="0.00000001"
                      value={holding.price}
                      onChange={(event) => setHolding({ ...holding, price: event.target.value })}
                      required
                    />
                  </Field>
                </div>
                <FormActions>
                  <Button variant="secondary" onClick={() => setShowHolding(false)}>
                    Cancel
                  </Button>
                  <Button variant="gold" type="submit" disabled={action.busy}>
                    Save snapshot
                  </Button>
                </FormActions>
              </form>
            </Modal>

            <Modal
              open={showActivity}
              onClose={() => setShowActivity(false)}
              title="Record investment activity"
              eyebrow="Use contribution or withdrawal only for external cash flows"
            >
              <form onSubmit={submitActivity}>
                <div className="form-grid">
                  <Field label="Account">
                    <select
                      value={activity.account_id}
                      onChange={(event) =>
                        setActivity({ ...activity, account_id: event.target.value })
                      }
                      required
                    >
                      <option value="">Choose account</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date">
                    <input
                      type="date"
                      value={activity.transaction_date}
                      onChange={(event) =>
                        setActivity({ ...activity, transaction_date: event.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field label="Activity">
                    <select
                      value={activity.transaction_type}
                      onChange={(event) =>
                        setActivity({ ...activity, transaction_type: event.target.value })
                      }
                    >
                      <option value="contribution">Contribution</option>
                      <option value="withdrawal">Withdrawal</option>
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                      <option value="dividend">Dividend</option>
                      <option value="fee">Fee</option>
                    </select>
                  </Field>
                  <Field label="Amount">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={activity.amount}
                      onChange={(event) => setActivity({ ...activity, amount: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Fees">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={activity.fees}
                      onChange={(event) => setActivity({ ...activity, fees: event.target.value })}
                    />
                  </Field>
                  <Field label="Notes">
                    <input
                      maxLength={1000}
                      value={activity.notes}
                      onChange={(event) => setActivity({ ...activity, notes: event.target.value })}
                    />
                  </Field>
                </div>
                <FormActions>
                  <Button variant="secondary" onClick={() => setShowActivity(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={action.busy}>
                    Record activity
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
