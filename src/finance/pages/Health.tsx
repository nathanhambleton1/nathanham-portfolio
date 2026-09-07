// Financial health - editable benchmarks. Ported from templates/health.html.
//
// Every figure here is a comparison against a target you set, not a rule. The
// original is careful about that wording and it is kept verbatim.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Advisory, Button, Card, Field, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { saveSettings } from "../lib/mutations";
import { buildAllocation } from "../lib/advice";
import { currentAccountBalances, monthlyTotals } from "../lib/finance";
import { goalForecast, houseRiskPath, percentOf } from "../lib/planning";
import { Decimal, ZERO, dec, fmtMoney, money, sum as sumMoney } from "../lib/money";
import { addMonths, fmtMonth, todayISO, yearOf } from "../lib/dates";
import type { FinancialGoal } from "../lib/types";

const TARGET_FIELDS: { key: string; label: string; min?: string; max?: string; step?: string }[] = [
  { key: "travel_recommended_monthly", label: "Travel / month" },
  { key: "ira_user_monthly_target", label: "Roth IRA / month" },
  { key: "house_user_monthly_target", label: "House fund / month" },
  { key: "brokerage_user_monthly_target", label: "Taxable investing / month" },
  { key: "house_horizon_years", label: "House horizon (years)", min: "1", step: "1" },
  { key: "house_equity_percent", label: "House equity allocation %", max: "100" },
  { key: "house_derisk_years", label: "De-risk window (years)", min: "1", step: "1" },
];

function Benchmark({
  title,
  badge,
  badgeTone,
  amount,
  detail,
}: {
  title: string;
  badge: string;
  badgeTone?: "gold" | "green";
  amount: string;
  detail: string;
}) {
  return (
    <Card>
      <div className="account-head">
        <h2>{title}</h2>
        <Tag tone={badgeTone}>{badge}</Tag>
      </div>
      <div className="goal-amount">{amount}</div>
      <div className="goal-target">{detail}</div>
    </Card>
  );
}

export default function Health() {
  const action = useAction();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  return (
    <PageFrame title="Financial Health" message={action.message} error={action.error}>
      {(data) => {
        const settings = data.settings;
        const values =
          draft ?? Object.fromEntries(TARGET_FIELDS.map(({ key }) => [key, settings[key] ?? "0"]));

        const totals = monthlyTotals(data);
        const allocation = buildAllocation(data, totals);
        const year = Number(settings.tax_year) || yearOf(todayISO());

        const goalsByType = new Map<string, FinancialGoal>();
        for (const goal of data.goals.filter((item) => item.is_active)) {
          goalsByType.set(goal.goal_type, goal);
        }
        const emergency = goalsByType.get("emergency");
        const travel = goalsByType.get("travel");
        const house = goalsByType.get("house");

        const pays = data.paychecks.filter((item) => yearOf(item.pay_date) === year);
        const gross = sumMoney(pays.map((item) => item.gross_amount));
        const retirementSaved = sumMoney(
          pays.map((item) => dec(item.roth_401k).plus(item.employer_401k_match)),
        );
        const retirementRate = percentOf(retirementSaved, gross);

        const rent = data.recurringExpenses.find((item) => item.name === "Rent");
        const monthlyGross = dec(settings.annual_salary ?? "0").div(12);
        const housingRate = percentOf(rent ? dec(rent.amount) : ZERO, monthlyGross);

        const balances = currentAccountBalances(data);
        const activeAccounts = data.accounts.filter((account) => account.is_active);
        const bucketFor = (types: string[]) =>
          sumMoney(
            activeAccounts
              .filter((account) => types.includes(account.account_type))
              .map((account) => balances.get(account.id) ?? ZERO),
          );

        const buckets = {
          retirement: bucketFor(["retirement"]),
          taxable: bucketFor(["brokerage"]),
          cash: bucketFor(["checking", "savings"]),
          house: house ? money(house.current_amount) : ZERO,
        };

        // Three house scenarios: all-cash, the configured equity mix, and a
        // pure-equity reference. The middle one is what the settings describe.
        const houseForecasts: { label: string; rate: Decimal; forecast: ReturnType<typeof goalForecast> }[] = [];
        if (house) {
          const savingsRate = dec(settings.savings_apy ?? "0");
          const equityRate = dec(settings.expected_return_percent ?? "0");
          const equityWeight = dec(values.house_equity_percent || "0").div(100);
          const blendedRate = savingsRate
            .times(new Decimal(1).minus(equityWeight))
            .plus(equityRate.times(equityWeight));

          const horizonYears = Number(values.house_horizon_years) || 1;
          const horizonDate =
            house.target_date ?? addMonths(todayISO(), horizonYears * 12);

          for (const [label, rate] of [
            ["Capital preservation", savingsRate],
            ["Configured mix", blendedRate],
            ["Equity return reference", equityRate],
          ] as [string, Decimal][]) {
            houseForecasts.push({
              label,
              rate: money(rate),
              forecast: goalForecast({
                currentAmount: dec(house.current_amount),
                targetAmount: dec(house.target_amount),
                monthlyContribution: dec(house.user_monthly_target),
                annualReturnPercent: rate,
                targetDate: horizonDate,
              }),
            });
          }
        }

        const housePath = houseRiskPath(
          Number(values.house_horizon_years) || 1,
          dec(values.house_equity_percent || "0"),
          Number(values.house_derisk_years) || 1,
        );

        const submit = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            await saveSettings(current, values);
            setDraft(null);
            return "Planning assumptions saved.";
          });
        };

        return (
          <>
            <PageHead
              eyebrow="Editable benchmarks"
              title="Financial health"
              subtitle="Contextual comparisons—not absolute requirements—based on your accounts, paychecks, transactions, and targets."
              actions={<Tag>No automatic transfers</Tag>}
            />

            <section className="grid three-col">
              <Benchmark
                title="Emergency fund"
                badge="Editable"
                badgeTone="gold"
                amount={fmtMoney(emergency?.current_amount ?? 0)}
                detail={`Recommended ${fmtMoney(settings.emergency_recommended_target ?? 0)} · user target ${fmtMoney(emergency?.target_amount ?? 0)}`}
              />
              <Benchmark
                title="Retirement savings"
                badge={`${retirementRate.toFixed(2)}%`}
                badgeTone="green"
                amount={fmtMoney(retirementSaved)}
                detail={`YTD employee + employer · editable benchmark ${settings.retirement_savings_rate_target ?? "0"}%`}
              />
              <Benchmark
                title="Housing cost"
                badge={`${housingRate.toFixed(2)}%`}
                badgeTone="green"
                amount="Gross income"
                detail={`Monthly rent share · comparison target ≤ ${settings.housing_cost_rate_target ?? "0"}%`}
              />
              <Benchmark
                title="Cash-flow surplus"
                badge={`${totals.savingsRate.toFixed(2)}%`}
                badgeTone={totals.surplus.greaterThanOrEqualTo(0) ? "green" : "gold"}
                amount={fmtMoney(totals.surplus)}
                detail="Current month · transfers excluded"
              />
              <Benchmark
                title="Consumer debt"
                badge="None configured"
                badgeTone="green"
                amount="$0.00"
                detail="Credit-card statements are bills to pay in full, not long-term debt."
              />
              <Benchmark
                title="Known low-cost advantages"
                badge="Active"
                badgeTone="green"
                amount="6 items"
                detail="No car payment, consumer debt, parking, phone, personal health premium, or pet expense."
              />
              <Benchmark
                title="Total savings / investing"
                badge={`${retirementRate.toFixed(2)}%`}
                badgeTone="gold"
                amount="Recorded"
                detail={`YTD recorded contributions / gross pay · editable benchmark ${settings.total_savings_rate_target ?? "0"}%`}
              />
              <Benchmark
                title="Travel funding"
                badge={fmtMoney(travel?.current_amount ?? 0)}
                badgeTone="gold"
                amount={`${fmtMoney(travel?.user_monthly_target ?? settings.travel_recommended_monthly ?? 0)}/mo`}
                detail={`Recommended ${fmtMoney(settings.travel_recommended_monthly ?? 0)}/mo`}
              />
              <Benchmark
                title="House funding"
                badge={fmtMoney(house?.current_amount ?? 0)}
                badgeTone="gold"
                amount={`${fmtMoney(values.house_user_monthly_target ?? 0)}/mo`}
                detail={`${values.house_horizon_years}-year planning horizon`}
              />
              <Benchmark
                title="Credit-card interest"
                badge="$0 recorded"
                badgeTone="green"
                amount="Pay in full"
                detail="Statements remain a first-priority cash obligation."
              />
            </section>

            <article className="card card-pad" style={{ marginTop: 18 }}>
              <SectionHead
                title="Asset buckets"
                caption="Retirement, accessible investing, cash, and house earmarks remain distinct"
              />
              <div className="cash-equation">
                <div className="equation-part">
                  <small>Retirement assets</small>
                  <strong>{fmtMoney(buckets.retirement)}</strong>
                </div>
                <div className="equation-part">
                  <small>Taxable investments</small>
                  <strong>{fmtMoney(buckets.taxable)}</strong>
                </div>
                <div className="equation-part">
                  <small>Cash &amp; savings</small>
                  <strong>{fmtMoney(buckets.cash)}</strong>
                </div>
                <div className="equation-part">
                  <small>House earmark</small>
                  <strong>{fmtMoney(buckets.house)}</strong>
                </div>
              </div>
            </article>

            <article className="card card-pad" style={{ marginTop: 18 }}>
              <SectionHead
                title="Month-end allocation recommendation"
                caption="An explainable priority order; recommendations never initiate money movement"
                aside={<Tag tone="gold">Available surplus {fmtMoney(allocation.availableSurplus)}</Tag>}
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
                    <span>Available after the listed recommendations</span>
                  </div>
                  <strong>{fmtMoney(allocation.remaining)}</strong>
                </div>
              </div>
            </article>

            <form className="card card-pad" style={{ marginTop: 18 }} onSubmit={submit}>
              <SectionHead
                title="Planning targets"
                caption="Adjust targets to fit your priorities"
                aside={
                  <Button small type="submit" disabled={action.busy}>
                    Recalculate
                  </Button>
                }
              />
              <div className="form-grid three">
                {TARGET_FIELDS.map(({ key, label, min, max, step }) => (
                  <Field key={key} label={label}>
                    <input
                      type="number"
                      min={min ?? "0"}
                      max={max}
                      step={step ?? "0.01"}
                      value={values[key] ?? ""}
                      onChange={(event) => setDraft({ ...values, [key]: event.target.value })}
                    />
                  </Field>
                ))}
              </div>
              <Advisory>
                The house glide path below is a configurable risk assumption, not a promise or
                instruction to hold the fund entirely in equities.
              </Advisory>
            </form>

            {houseForecasts.length > 0 && (
              <article className="card" style={{ marginTop: 18 }}>
                <div className="card-pad" style={{ paddingBottom: 5 }}>
                  <h2>House goal projections</h2>
                  <div className="section-caption">
                    Completion timing under transparent return assumptions; none is a guaranteed
                    outcome
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>Annual return assumption</th>
                        <th>Estimated completion</th>
                        <th>Contributions</th>
                        <th>Estimated growth</th>
                        <th>Target-date status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {houseForecasts.map((item) => (
                        <tr key={item.label}>
                          <td>
                            <strong>{item.label}</strong>
                          </td>
                          <td>{item.rate.toFixed(2)}%</td>
                          <td>
                            {item.forecast.projectedDate
                              ? fmtMonth(item.forecast.projectedDate)
                              : "Not reached"}
                          </td>
                          <td className="amount">{fmtMoney(item.forecast.contributions)}</td>
                          <td className="amount income">{fmtMoney(item.forecast.growth)}</td>
                          <td>
                            <Tag tone={item.forecast.onTrack ? "green" : "gold"}>
                              {item.forecast.onTrack ? "On track" : "Behind horizon"}
                            </Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            <article className="card" style={{ marginTop: 18 }}>
              <div className="card-pad" style={{ paddingBottom: 5 }}>
                <h2>House-fund de-risking path</h2>
                <div className="section-caption">
                  Equity exposure declines during the configured final window
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Years until target</th>
                      <th>Equity assumption</th>
                      <th>Capital-preservation assumption</th>
                    </tr>
                  </thead>
                  <tbody>
                    {housePath.map((row) => (
                      <tr key={row.yearsUntilGoal}>
                        <td>{row.yearsUntilGoal}</td>
                        <td>{row.equityPercent.toFixed(2)}%</td>
                        <td>{row.capitalPreservationPercent.toFixed(2)}%</td>
                      </tr>
                    ))}
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
