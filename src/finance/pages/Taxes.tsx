// Tax forecast. Ported from templates/taxes.html.
//
// Projects the year from what has been recorded so far: the average of the
// paychecks already logged, extended across the pay periods that remain. It is
// an estimate, not a return, and the page says so.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Advisory, Button, Card, Field, Metric, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { saveSettings } from "../lib/mutations";
import {
  federalIncomeTax, marginalRate, percentOf, taxForecast, virginiaIncomeTax,
} from "../lib/planning";
import { getTaxRules, UnsupportedTaxYearError } from "../lib/taxRules";
import { ZERO, dec, fmtMoney, money, sum as sumMoney } from "../lib/money";
import { todayISO, yearOf } from "../lib/dates";

const OTHER_INCOME_FIELDS: { key: string; label: string }[] = [
  { key: "prior_income", label: "Other-employer income" },
  { key: "prior_federal_withholding", label: "Federal withholding" },
  { key: "prior_virginia_withholding", label: "Virginia withholding" },
];

export default function Taxes() {
  const action = useAction();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  return (
    <PageFrame title="Taxes" message={action.message} error={action.error}>
      {(data) => {
        const settings = data.settings;
        const year = Number(settings.tax_year) || yearOf(todayISO());

        let rules;
        try {
          rules = getTaxRules(year, settings.filing_status ?? "single");
        } catch (error) {
          if (!(error instanceof UnsupportedTaxYearError)) throw error;
          return (
            <>
              <PageHead
                eyebrow="Tax-year estimate"
                title="Tax forecast"
                subtitle="Projected W-2 income, progressive federal and Virginia liability, and recorded withholding."
              />
              <div className="alert error">
                No tax tables are configured for {year} ({settings.filing_status ?? "single"}). Set a
                supported tax year in Settings, or add the year&rsquo;s rules to the app.
              </div>
            </>
          );
        }

        const values =
          draft ??
          Object.fromEntries(OTHER_INCOME_FIELDS.map(({ key }) => [key, settings[key] ?? "0"]));

        const periods = Number(settings.pay_periods_per_year) || 26;
        const rows = data.paychecks.filter((item) => yearOf(item.pay_date) === year);
        const remainingCount = Math.max(0, periods - rows.length);

        const grossTotal = sumMoney(rows.map((item) => item.gross_amount));
        const federalTotal = sumMoney(rows.map((item) => item.federal_withholding));
        const virginiaTotal = sumMoney(rows.map((item) => item.virginia_withholding));

        const ytdIncome = money(grossTotal.plus(dec(values.prior_income || "0")));

        // With no paychecks yet, fall back to the configured salary spread over
        // the year, so a fresh install still produces a usable estimate.
        const annualSalary = dec(settings.annual_salary ?? "0");
        const averageGross =
          rows.length > 0 ? money(grossTotal.div(rows.length)) : money(annualSalary.div(periods));
        const averageFederal =
          rows.length > 0
            ? money(federalTotal.div(rows.length))
            : money(federalIncomeTax(annualSalary, rules).div(periods));
        const averageVirginia =
          rows.length > 0
            ? money(virginiaTotal.div(rows.length))
            : money(virginiaIncomeTax(annualSalary, rules).div(periods));

        const projectedRemaining = money(averageGross.times(remainingCount));

        const forecast = taxForecast({
          ytdIncome,
          projectedRemainingIncome: projectedRemaining,
          federalWithholdingYtd: money(federalTotal.plus(dec(values.prior_federal_withholding || "0"))),
          virginiaWithholdingYtd: money(virginiaTotal.plus(dec(values.prior_virginia_withholding || "0"))),
          projectedFederalWithholding: money(averageFederal.times(remainingCount)),
          projectedVirginiaWithholding: money(averageVirginia.times(remainingCount)),
          rules,
        });

        const marginalFederal = marginalRate(
          forecast.projectedIncome,
          rules.federalStandardDeduction,
          rules.federalBrackets,
        );
        const marginalVirginia = marginalRate(
          forecast.projectedIncome,
          rules.virginiaStandardDeduction,
          rules.virginiaBrackets,
        );
        const effectiveFederal = percentOf(forecast.federalLiability, forecast.projectedIncome);
        const effectiveVirginia = percentOf(forecast.virginiaLiability, forecast.projectedIncome);

        const resultLabel = (value: typeof ZERO) =>
          value.greaterThanOrEqualTo(0) ? "refund" : "amount owed";

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
              eyebrow={`${rules.year} tax-year estimate`}
              title="Tax forecast"
              subtitle="Projected W-2 income, progressive federal and Virginia liability, and recorded withholding. This is an estimate, not tax advice or a filed return."
              actions={<Tag tone="gold">Single filer</Tag>}
            />

            <section className="grid metrics">
              <Metric
                label="Projected income"
                value={fmtMoney(forecast.projectedIncome)}
                note={`YTD ${fmtMoney(ytdIncome)} + remaining ${fmtMoney(projectedRemaining)}`}
              />
              <Metric
                label={`Federal ${resultLabel(forecast.federalResult)}`}
                value={fmtMoney(forecast.federalResult.abs())}
                note={`Withholding ${fmtMoney(forecast.federalWithholding)} · liability ${fmtMoney(forecast.federalLiability)}`}
              />
              <Metric
                label={`Virginia ${resultLabel(forecast.virginiaResult)}`}
                value={fmtMoney(forecast.virginiaResult.abs())}
                note={`Withholding ${fmtMoney(forecast.virginiaWithholding)} · liability ${fmtMoney(forecast.virginiaLiability)}`}
              />
              <Metric
                label={`Combined ${resultLabel(forecast.combinedResult)}`}
                value={fmtMoney(forecast.combinedResult.abs())}
                note={`Estimated ${rules.year} result`}
              />
            </section>

            <section className="grid two-even">
              <Card>
                <SectionHead
                  title="Federal rates"
                  caption="Only the next layer of income uses the marginal rate"
                />
                <div className="target-comparison">
                  <div className="target-box">
                    <small>Marginal rate</small>
                    <strong>{marginalFederal.toFixed(2)}%</strong>
                  </div>
                  <div className="target-box">
                    <small>Effective rate</small>
                    <strong>{effectiveFederal.toFixed(2)}%</strong>
                  </div>
                </div>
                <Advisory>
                  A 22% bracket does not mean all income is taxed at 22%. The configured{" "}
                  {fmtMoney(rules.federalStandardDeduction)} standard deduction applies before
                  progressive brackets.
                </Advisory>
              </Card>

              <Card>
                <SectionHead title="Virginia rates" caption="Progressive state calculation" />
                <div className="target-comparison">
                  <div className="target-box">
                    <small>Marginal rate</small>
                    <strong>{marginalVirginia.toFixed(2)}%</strong>
                  </div>
                  <div className="target-box">
                    <small>Effective rate</small>
                    <strong>{effectiveVirginia.toFixed(2)}%</strong>
                  </div>
                </div>
                <Advisory>
                  Uses the configured {fmtMoney(rules.virginiaStandardDeduction)} Virginia standard
                  deduction and tiered 2%–5.75% rates.
                </Advisory>
              </Card>
            </section>

            <form className="card card-pad" style={{ marginTop: 18 }} onSubmit={submit}>
              <SectionHead
                title="Income from another employer"
                caption="Add current-year income and withholding that is not in Paychecks"
                aside={
                  <Button small type="submit" disabled={action.busy}>
                    Update forecast
                  </Button>
                }
              />
              <div className="form-grid three">
                {OTHER_INCOME_FIELDS.map(({ key, label }) => (
                  <Field key={key} label={label}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={values[key] ?? ""}
                      onChange={(event) => setDraft({ ...values, [key]: event.target.value })}
                    />
                  </Field>
                ))}
              </div>
            </form>
          </>
        );
      }}
    </PageFrame>
  );
}
