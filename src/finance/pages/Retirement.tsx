// Retirement planning. Ported from templates/retirement.html.
//
// Three fixed scenarios (5/7/9%) sit above a milestone table at whatever return
// you have selected. The numbers are arithmetic on your assumptions, not
// forecasts - the page says so, and the wording is kept.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Button, Card, Empty, Field, Metric, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { currentAccountBalances } from "../lib/finance";
import { contributionLimitWarning, retirementProjection } from "../lib/planning";
import { saveSettings } from "../lib/mutations";
import { accountName } from "../lib/data";
import { Decimal, ZERO, dec, fmtMoney, money, sum as sumMoney } from "../lib/money";
import { fmtDate, todayISO, yearOf } from "../lib/dates";
import { ACCOUNT_TYPE_LABELS } from "../lib/types";
import type { AccountType } from "../lib/types";

/** Everything that counts as a long-term investment account here. */
const RETIREMENT_TYPES: AccountType[] = [
  "retirement", "brokerage", "roth_401k", "traditional_401k",
  "roth_ira", "traditional_ira", "taxable_brokerage",
];

const ASSUMPTION_FIELDS: { key: string; label: string; min?: string; step?: string }[] = [
  { key: "current_age", label: "Current age", min: "18", step: "1" },
  { key: "retirement_age", label: "Retirement age", min: "19", step: "1" },
  { key: "annual_salary", label: "Annual salary" },
  { key: "salary_growth_percent", label: "Salary increase %" },
  { key: "roth_401k_percent", label: "Roth 401(k) %" },
  { key: "employer_match_percent", label: "Employer match %" },
  { key: "ira_user_monthly_target", label: "Roth IRA monthly" },
  { key: "expected_return_percent", label: "Expected return %" },
  { key: "ira_contribution_limit_2026", label: "2026 IRA limit" },
];

const SCENARIOS: [label: string, rate: number][] = [
  ["Conservative", 5],
  ["Baseline", 7],
  ["Aggressive", 9],
];

export default function Retirement() {
  const action = useAction();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  return (
    <PageFrame title="Retirement" message={action.message} error={action.error}>
      {(data) => {
        const settings = data.settings;
        const values =
          draft ??
          Object.fromEntries(ASSUMPTION_FIELDS.map(({ key }) => [key, settings[key] ?? "0"]));

        const balances = currentAccountBalances(data);
        const accounts = data.accounts.filter((account) =>
          RETIREMENT_TYPES.includes(account.account_type),
        );
        const contributions = [...data.retirementContributions].sort((a, b) =>
          a.contribution_date === b.contribution_date
            ? b.id - a.id
            : a.contribution_date < b.contribution_date
              ? 1
              : -1,
        );

        const currentBalance = sumMoney(
          accounts.map((account) => balances.get(account.id) ?? ZERO),
        );
        const currentAge = Number(values.current_age) || 0;
        const retirementAge = Number(values.retirement_age) || 0;
        const annualOther = dec(values.ira_user_monthly_target || "0").times(12);
        const startYear = yearOf(todayISO());

        const base = {
          currentAge,
          retirementAge,
          currentBalance,
          annualSalary: dec(values.annual_salary || "0"),
          salaryGrowthPercent: dec(values.salary_growth_percent || "0"),
          employeePercent: dec(values.roth_401k_percent || "0"),
          employerMatchPercent: dec(values.employer_match_percent || "0"),
          annualOtherContribution: annualOther,
          startYear,
        };

        const scenarios = SCENARIOS.map(([label, rate]) => {
          const rows = retirementProjection({ ...base, returnPercent: new Decimal(rate) });
          return {
            label,
            rate,
            final: rows.length > 0 ? rows[rows.length - 1].total : currentBalance,
          };
        });

        const projection = retirementProjection({
          ...base,
          returnPercent: dec(values.expected_return_percent || "0"),
        });

        const iraLimit = dec(values.ira_contribution_limit_2026 || "0");
        const iraWarning = contributionLimitWarning(money(annualOther), iraLimit);

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
              eyebrow="Long-term wealth"
              title="Retirement planning"
              subtitle="Roth 401(k), employer match, and Roth IRA projections with editable assumptions. Returns are scenarios, not promises."
              actions={<Tag tone="gold">Deterministic projection</Tag>}
            />

            <section className="account-grid">
              {accounts.map((account) => (
                <Card key={account.id} pad={false} className="account-card">
                  <div className="account-head">
                    <div>
                      <div className="account-type">
                        {ACCOUNT_TYPE_LABELS[account.account_type]}
                      </div>
                      <h2>{account.name}</h2>
                    </div>
                    <Tag tone="green">
                      {account.account_type === "brokerage" || account.account_type === "taxable_brokerage"
                        ? "Taxable"
                        : "Retirement"}
                    </Tag>
                  </div>
                  <div className="account-balance">{fmtMoney(balances.get(account.id) ?? 0)}</div>
                  <div className="account-detail">
                    <span>Latest recorded balance</span>
                    <span>Tracked asset</span>
                  </div>
                </Card>
              ))}
              {accounts.length === 0 && <p className="empty">No retirement accounts yet.</p>}
            </section>

            <form className="card card-pad" style={{ marginTop: 18 }} onSubmit={submit}>
              <SectionHead
                title="Projection assumptions"
                caption="Change any input to recalculate immediately"
                aside={
                  <Button small type="submit" disabled={action.busy}>
                    Recalculate
                  </Button>
                }
              />
              <div className="form-grid three">
                {ASSUMPTION_FIELDS.map(({ key, label, min, step }) => (
                  <Field key={key} label={label}>
                    <input
                      type="number"
                      min={min ?? "0"}
                      step={step ?? "0.01"}
                      value={values[key] ?? ""}
                      onChange={(event) =>
                        setDraft({ ...values, [key]: event.target.value })
                      }
                    />
                  </Field>
                ))}
              </div>
              {iraWarning && (
                <div className="alert error" style={{ marginTop: 16, marginBottom: 0 }}>
                  {iraWarning} Configured annual limit: {fmtMoney(iraLimit)}.
                </div>
              )}
            </form>

            <section className="grid three-col" style={{ marginTop: 18 }}>
              {scenarios.map((scenario) => (
                <Metric
                  key={scenario.label}
                  label={`${scenario.label} · ${scenario.rate}%`}
                  value={fmtMoney(scenario.final)}
                  note={`At age ${retirementAge} · assumption only`}
                />
              ))}
            </section>

            <article className="card" style={{ marginTop: 18 }}>
              <div className="card-pad" style={{ paddingBottom: 5 }}>
                <h2>{values.expected_return_percent}% selected-return milestones</h2>
                <div className="section-caption">Balance components remain distinct</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Age / year</th>
                      <th>Starting balance</th>
                      <th>Employee</th>
                      <th>Employer</th>
                      <th>Roth IRA / other</th>
                      <th>Investment growth</th>
                      <th>Projected total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.length === 0 ? (
                      <Empty colSpan={7}>Retirement age must be greater than current age.</Empty>
                    ) : (
                      projection.map((row) => (
                        <tr key={row.age}>
                          <td>
                            <strong>{row.age}</strong>
                            <div className="small-text muted">{row.year}</div>
                          </td>
                          <td className="amount">{fmtMoney(row.startingBalance)}</td>
                          <td className="amount">{fmtMoney(row.employeeContributions)}</td>
                          <td className="amount income">{fmtMoney(row.employerContributions)}</td>
                          <td className="amount">{fmtMoney(row.otherContributions)}</td>
                          <td className="amount income">{fmtMoney(row.investmentGrowth)}</td>
                          <td className="amount">{fmtMoney(row.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="card" style={{ marginTop: 18 }}>
              <div className="card-pad" style={{ paddingBottom: 5 }}>
                <h2>Recorded 401(k) contributions</h2>
                <div className="section-caption">
                  Employee Roth and employer funding tracked separately
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Account</th>
                      <th>Employee</th>
                      <th>Employer match</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributions.length === 0 ? (
                      <Empty colSpan={5}>No contributions yet.</Empty>
                    ) : (
                      contributions.map((item) => (
                        <tr key={item.id}>
                          <td>{fmtDate(item.contribution_date)}</td>
                          <td>{accountName(data, item.account_id)}</td>
                          <td className="amount">{fmtMoney(item.employee_amount)}</td>
                          <td className="amount income">{fmtMoney(item.employer_match)}</td>
                          <td className="amount">
                            {fmtMoney(dec(item.employee_amount).plus(item.employer_match))}
                          </td>
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
