// Spending - expenses only. Ported from templates/spending.html.
//
// Transfers and statement payments are deliberately absent: paying a card moves
// cash but is not new spending, and counting it again would double it.

import { Link, useSearchParams } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import { Card, Empty, PageHead, SectionHead, Tag } from "../components/ui";
import { SpendingDonut } from "../components/charts";
import {
  categorySpendingForRange, resolveSpendingPeriod, spendingTotalForRange, SPENDING_PERIODS,
} from "../lib/finance";
import { accountName, categoryName } from "../lib/data";
import { fmtDate } from "../lib/dates";
import { fmtMoney, percentOf } from "../lib/money";

export default function Spending() {
  const [params, setParams] = useSearchParams();

  return (
    <PageFrame title="Spending">
      {(data) => {
        const period = resolveSpendingPeriod(params.get("period"));
        const periodLabel =
          SPENDING_PERIODS.find(([key]) => key === period.key)?.[1] ?? "Last 3 months";
        const rows = categorySpendingForRange(data, period.start, period.end).map(
          ([name, amount]) => ({ name, amount }),
        );
        const periodSpending = spendingTotalForRange(data, period.start, period.end);

        const recent = [...data.transactions]
          .filter((item) => item.transaction_type === "expense" && !item.is_transfer)
          .sort((a, b) =>
            a.transaction_date === b.transaction_date
              ? b.id - a.id
              : a.transaction_date < b.transaction_date
                ? 1
                : -1,
          )
          .slice(0, 20);

        return (
          <>
            <PageHead
              eyebrow="Purchase activity"
              title="Spending"
              subtitle="A focused view of expenses only. Transfers and statement payments are excluded."
              actions={
                <Link className="button" to="/finance/transactions">
                  Add transaction
                </Link>
              }
            />

            <section className="grid two-col">
              <Card pad={false} className="chart-card">
                <SectionHead
                  title="Spending by category"
                  caption={`Five intentionally broad groups · ${periodLabel.toLowerCase()}`}
                  aside={
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Tag tone="gold">{fmtMoney(periodSpending)}</Tag>
                      <select
                        className="period-select"
                        aria-label="Spending period"
                        value={period.key}
                        onChange={(event) => setParams({ period: event.target.value })}
                      >
                        {SPENDING_PERIODS.map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  }
                />
                <SpendingDonut rows={rows} />
              </Card>

              <Card>
                <SectionHead title="Category totals" caption={periodLabel} />
                {rows.map((row) => (
                  <div className="obligation" key={row.name}>
                    <div className="obligation-info">
                      <strong>{row.name}</strong>
                      <span>{percentOf(row.amount, periodSpending).toFixed(1)}% of spending</span>
                    </div>
                    <span className="obligation-amount">{fmtMoney(row.amount)}</span>
                  </div>
                ))}
              </Card>
            </section>

            <article className="card" style={{ marginTop: 18 }}>
              <div className="card-pad" style={{ paddingBottom: 6 }}>
                <h2>Recent expenses</h2>
                <div className="section-caption">Spending-date ledger</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Merchant</th>
                      <th>Category</th>
                      <th>Account</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <Empty colSpan={5}>No expenses recorded yet.</Empty>
                    ) : (
                      recent.map((item) => (
                        <tr key={item.id}>
                          <td>{fmtDate(item.transaction_date)}</td>
                          <td>
                            <strong>{item.description}</strong>
                          </td>
                          <td>
                            {categoryName(data, item.category_id)}
                            {item.subcategory_id && (
                              <div className="muted small-text">
                                {categoryName(data, item.subcategory_id)}
                              </div>
                            )}
                          </td>
                          <td className="muted">{accountName(data, item.account_id)}</td>
                          <td className="amount">{fmtMoney(item.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        );
      }}
    </PageFrame>
  );
}
