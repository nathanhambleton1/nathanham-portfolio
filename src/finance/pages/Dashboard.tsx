// Dashboard - the overview. Ported from templates/dashboard.html.

import { Link, useSearchParams } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import {
  Advisory, Card, EquationPart, Metric, PageHead, ProgressRow, SectionHead, Tag,
} from "../components/ui";
import { IncomeSpendingChart, SpendingDonut } from "../components/charts";
import { buildAllocation, snapshotPoints } from "../lib/advice";
import {
  categorySpendingForRange, goalProgress, liquidCash, monthEndRecommendation,
  monthlyTotals, netWorth, resolveSpendingPeriod, SPENDING_PERIODS,
} from "../lib/finance";
import { fmtMoney, fmtPercent, money } from "../lib/money";

const ICONS = {
  netWorth: "m4 17 5-5 4 3 7-8m-5 0h5v5",
  cash: "M3 7h18v12H3V7Zm3 4h6",
  spending: "M12 3v18m5-14H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6",
  surplus: "M5 20V10m7 10V4m7 16v-7",
};

export default function Dashboard() {
  const [params, setParams] = useSearchParams();

  return (
    <PageFrame title="Dashboard">
      {(data) => {
        const period = resolveSpendingPeriod(params.get("period"));
        const periodLabel =
          SPENDING_PERIODS.find(([key]) => key === period.key)?.[1] ?? "Last 3 months";
        const categoryRows = categorySpendingForRange(data, period.start, period.end).map(
          ([name, amount]) => ({ name, amount }),
        );
        const periodSpending = categoryRows.reduce(
          (total, row) => money(total.plus(row.amount)),
          money(0),
        );

        const totals = monthlyTotals(data);
        const recommendation = monthEndRecommendation(data);
        const allocation = buildAllocation(data, totals);
        const points = snapshotPoints(data);

        const goals = data.goals.filter((goal) => goal.is_active);
        const funds = data.sinkingFunds.filter((fund) => fund.is_active);
        const recurring = [...data.recurringExpenses]
          .filter((item) => item.is_active)
          .sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99));
        const cards = data.accounts.filter(
          (account) => account.account_type === "credit_card" && Number(account.statement_balance) > 0,
        );

        return (
          <>
            <PageHead
              eyebrow="Financial overview"
              title="Your money, clearly."
              subtitle="A concise view of the balances, progress, and near-term cash decisions that matter."
              actions={
                <Link className="button" to="/finance/transactions">
                  + Add transaction
                </Link>
              }
            />

            <section className="grid metrics">
              <Metric
                label="Net worth"
                value={fmtMoney(netWorth(data))}
                note="Assets minus liabilities"
                notePositive
                icon={ICONS.netWorth}
              />
              <Metric
                label="Liquid cash"
                value={fmtMoney(liquidCash(data))}
                note="Checking + savings"
                icon={ICONS.cash}
              />
              <Metric
                label={`Spending · ${periodLabel.toLowerCase()}`}
                value={fmtMoney(periodSpending)}
                note="Transfers excluded"
                icon={ICONS.spending}
              />
              <Metric
                label="Monthly surplus"
                value={fmtMoney(totals.surplus)}
                note={`${fmtPercent(totals.savingsRate)} savings rate`}
                notePositive
                icon={ICONS.surplus}
              />
            </section>

            <section className="month-end-action">
              <div>
                <p className="eyebrow">Month-end action</p>
                <h2>Turn this live view into a durable monthly record</h2>
                <p>Review balances and pending imports, then save the month from Reports.</p>
              </div>
              <Link className="button gold" to="/finance/reports">
                Review &amp; close month
              </Link>
            </section>

            <section className="chart-grid">
              <Card pad={false} className="chart-card">
                <SectionHead
                  title="Spending mix"
                  caption={`Five categories · ${periodLabel.toLowerCase()}`}
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
                <SpendingDonut rows={categoryRows} />
              </Card>

              <Card pad={false} className="chart-card">
                <SectionHead title="Income vs spending" caption="Monthly cash-flow trend" />
                <IncomeSpendingChart points={points.slice(-6)} />
              </Card>
            </section>

            <section className="grid two-col">
              <div className="grid">
                <Card>
                  <SectionHead
                    title="Month-end outlook"
                    caption="Deterministic advisory foundation"
                    aside={<Tag>No automatic transfers</Tag>}
                  />
                  <div className="cash-equation">
                    <EquationPart label="Liquid cash" value={fmtMoney(recommendation.liquidCash)} />
                    <EquationPart label="+ Expected pay" value={fmtMoney(recommendation.expectedIncome)} />
                    <EquationPart
                      label="− Card statements"
                      value={fmtMoney(recommendation.upcomingCardPayments)}
                    />
                    <EquationPart
                      label="− Bills & sinking funds"
                      value={fmtMoney(
                        recommendation.upcomingBills.plus(recommendation.requiredSinking),
                      )}
                    />
                    <EquationPart
                      label="Available cash"
                      value={fmtMoney(recommendation.availableCash)}
                      result
                    />
                  </div>
                  <Advisory>
                    NexaFi separates purchase dates from card-payment dates. Statement payments
                    reduce cash but never become spending again.
                  </Advisory>
                </Card>

                <Card>
                  <SectionHead
                    title="Savings progress"
                    caption="Virtual buckets inside savings"
                    aside={
                      <Link className="small-text muted" to="/finance/goals">
                        Manage goals →
                      </Link>
                    }
                  />
                  {goals.length > 0 ? (
                    goals.map((goal) => {
                      const percent = goalProgress(goal);
                      return (
                        <ProgressRow
                          key={goal.id}
                          title={goal.name}
                          value={`${fmtMoney(goal.current_amount)} / ${fmtMoney(goal.target_amount)}`}
                          percent={percent}
                          leftDetail={`${fmtPercent(percent)} funded`}
                          rightDetail={
                            Number(goal.user_monthly_target) > 0
                              ? `${fmtMoney(goal.user_monthly_target)}/mo`
                              : "Target held"
                          }
                        />
                      );
                    })
                  ) : (
                    <p className="muted">No active goals yet.</p>
                  )}
                </Card>
              </div>

              <Card>
                <SectionHead title="Upcoming obligations" caption="Cash requirements still ahead" />
                {cards.map((account) => (
                  <div className="obligation" key={`card-${account.id}`}>
                    <div className="obligation-date">
                      DUE<strong>{account.payment_due_day ?? "—"}</strong>
                    </div>
                    <div className="obligation-info">
                      <strong>{account.name}</strong>
                      <span>Statement payment · not spending</span>
                    </div>
                    <span className="obligation-amount">{fmtMoney(account.statement_balance)}</span>
                  </div>
                ))}
                {recurring.slice(0, 5).map((item) => (
                  <div className="obligation" key={`bill-${item.id}`}>
                    <div className="obligation-info">
                      <strong>{item.name}</strong>
                      <span>{item.is_variable ? "Variable budget" : "Recurring bill"}</span>
                    </div>
                    <span className="obligation-amount">{fmtMoney(item.amount)}</span>
                  </div>
                ))}
                {funds.map((fund) => (
                  <div className="obligation" key={`fund-${fund.id}`}>
                    <div className="obligation-date">
                      FUND<strong>↗</strong>
                    </div>
                    <div className="obligation-info">
                      <strong>{fund.name}</strong>
                      <span>Earmarked asset in savings</span>
                    </div>
                    <span className="obligation-amount">{fmtMoney(fund.current_amount)}</span>
                  </div>
                ))}
                {cards.length === 0 && recurring.length === 0 && funds.length === 0 && (
                  <p className="muted">Nothing outstanding.</p>
                )}
              </Card>
            </section>

            <article className="card card-pad" style={{ marginTop: 18 }}>
                <SectionHead
                  title="Recommended surplus allocation"
                  caption="Priorities are editable and explainable · no transfers are initiated"
                  aside={
                    <Link className="small-text muted" to="/finance/health">
                      View health benchmarks →
                    </Link>
                  }
                />
                <div className="allocation-list">
                  {allocation.items.map((item) => (
                    <div className="allocation-row" key={item.name}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.explanation}</span>
                      </div>
                      <strong>{fmtMoney(item.amount)}</strong>
                    </div>
                  ))}
                  <div className="allocation-row total">
                    <div>
                      <strong>Remaining flexible cash</strong>
                      <span>Available after recommendations</span>
                    </div>
                    <strong>{fmtMoney(allocation.remaining)}</strong>
                  </div>
                </div>
            </article>
          </>
        );
      }}
    </PageFrame>
  );
}
