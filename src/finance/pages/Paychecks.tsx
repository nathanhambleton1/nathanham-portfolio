// Paychecks - income, taxes, and the withholding audit.
// Ported from templates/paychecks.html.
//
// The audit annualizes each check's gross to work out what withholding "should"
// have been, then flags the gap. Roth contributions are deliberately not
// deducted from taxable pay: they are after-tax.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Button, Card, Empty, Field, FormActions, Metric, Modal, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { createPaycheck, editPaycheck } from "../lib/mutations";
import { ptoState, SCHEDULED_PAYCHECK_NOTE } from "../lib/paychecks";
import { estimatedPaycheckTaxes, percentOf, withholdingStatus } from "../lib/planning";
import { getTaxRules, UnsupportedTaxYearError } from "../lib/taxRules";
import { Decimal, dec, fmtMoney, money, sum as sumMoney, toNumeric } from "../lib/money";
import { fmtDate, todayISO, yearOf } from "../lib/dates";
import type { FinanceData } from "../lib/data";
import type { Paycheck } from "../lib/types";

interface Form {
  pay_date: string;
  employer: string;
  pay_period_start: string;
  pay_period_end: string;
  regular_hours: string;
  gross_amount: string;
  federal_withholding: string;
  virginia_withholding: string;
  social_security: string;
  medicare: string;
  roth_401k: string;
  employer_401k_match: string;
  other_deductions: string;
  pto_earned: string;
  pto_used: string;
  destination_account_id: string;
  notes: string;
}

const DEDUCTION_FIELDS: (keyof Form)[] = [
  "federal_withholding", "virginia_withholding", "social_security",
  "medicare", "roth_401k", "other_deductions",
];

/** Net pay is always derived, never typed — see paycheckValues in mutations.ts. */
function derivedNet(form: Form): Decimal {
  const gross = dec(form.gross_amount || "0");
  const deductions = DEDUCTION_FIELDS.reduce(
    (total, field) => total.plus(dec((form[field] as string) || "0")),
    new Decimal(0),
  );
  return Decimal.max(0, money(gross.minus(deductions)));
}

function blankForm(data: FinanceData, ptoAccrualHours: string): Form {
  const settings = data.settings;
  return {
    pay_date: todayISO(),
    employer: settings.employer_name ?? "",
    pay_period_start: "",
    pay_period_end: "",
    regular_hours: settings.regular_hours_per_period ?? "80",
    gross_amount: settings.gross_pay_per_period ?? "",
    federal_withholding: "0",
    virginia_withholding: "0",
    social_security: "0",
    medicare: "0",
    roth_401k: "0",
    employer_401k_match: "0",
    other_deductions: "0",
    pto_earned: ptoAccrualHours,
    pto_used: "0",
    destination_account_id: "",
    notes: "",
  };
}

function fromPaycheck(paycheck: Paycheck): Form {
  return {
    pay_date: paycheck.pay_date,
    employer: paycheck.employer,
    pay_period_start: paycheck.pay_period_start ?? "",
    pay_period_end: paycheck.pay_period_end ?? "",
    regular_hours: String(paycheck.regular_hours),
    gross_amount: String(paycheck.gross_amount),
    federal_withholding: String(paycheck.federal_withholding),
    virginia_withholding: String(paycheck.virginia_withholding),
    social_security: String(paycheck.social_security),
    medicare: String(paycheck.medicare),
    roth_401k: String(paycheck.roth_401k),
    employer_401k_match: String(paycheck.employer_401k_match),
    other_deductions: String(paycheck.other_deductions),
    pto_earned: String(paycheck.pto_earned),
    pto_used: String(paycheck.pto_used),
    destination_account_id: paycheck.destination_account_id
      ? String(paycheck.destination_account_id)
      : "",
    notes: paycheck.notes ?? "",
  };
}

interface AuditRow {
  expectedFederal: Decimal;
  expectedVirginia: Decimal;
  expectedSocialSecurity: Decimal;
  expectedMedicare: Decimal;
  federalDifference: Decimal;
  virginiaDifference: Decimal;
  status: string;
}

/**
 * The withholding audit, one row per paycheck in the configured tax year.
 *
 * Plain function rather than a hook: PageFrame calls its children conditionally
 * (only once data has loaded), so a hook here would change hook order between
 * the loading and loaded renders. The dataset is one person's paychecks, so
 * recomputing per render costs nothing worth memoizing.
 */
function buildAudits(
  ytd: Paycheck[],
  settings: Record<string, string>,
  year: number,
  periods: number,
): Map<number, AuditRow> {
  const byId = new Map<number, AuditRow>();

  let rules;
  try {
    rules = getTaxRules(year, settings.filing_status ?? "single");
  } catch (error) {
    // An unconfigured tax year means no audit column, not a crash.
    if (error instanceof UnsupportedTaxYearError) return byId;
    throw error;
  }

  const tolerance = dec(settings.withholding_tolerance ?? "0");
  let priorWages = dec(settings.prior_social_security_wages ?? "0");

  // Ascending, because each check's Social Security cap depends on the wages
  // that came before it in the year.
  const ascending = [...ytd].sort((a, b) =>
    a.pay_date === b.pay_date ? a.id - b.id : a.pay_date < b.pay_date ? -1 : 1,
  );

  for (const item of ascending) {
    const gross = dec(item.gross_amount);
    const expected = estimatedPaycheckTaxes(gross, periods, rules, priorWages);
    priorWages = priorWages.plus(gross);
    byId.set(item.id, {
      expectedFederal: expected.federal,
      expectedVirginia: expected.virginia,
      expectedSocialSecurity: expected.socialSecurity,
      expectedMedicare: expected.medicare,
      federalDifference: money(dec(item.federal_withholding).minus(expected.federal)),
      virginiaDifference: money(dec(item.virginia_withholding).minus(expected.virginia)),
      status: withholdingStatus(
        dec(item.federal_withholding).plus(item.virginia_withholding),
        expected.federal.plus(expected.virginia),
        tolerance,
      ),
    });
  }
  return byId;
}

export default function Paychecks() {
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Paycheck | null>(null);
  const [form, setForm] = useState<Form | null>(null);

  return (
    <PageFrame title="Paychecks" message={action.message} error={action.error}>
      {(data) => {
        const settings = data.settings;
        const year = Number(settings.tax_year) || yearOf(todayISO());
        const periods = Number(settings.pay_periods_per_year) || 26;
        const pto = ptoState(data, settings, year);

        const paychecks = [...data.paychecks].sort((a, b) =>
          a.pay_date === b.pay_date ? b.id - a.id : a.pay_date < b.pay_date ? 1 : -1,
        );
        const ytd = paychecks.filter((item) => yearOf(item.pay_date) === year);

        const audits = buildAudits(ytd, settings, year, periods);

        const ytdTotals = {
          gross: sumMoney(ytd.map((item) => item.gross_amount)),
          net: sumMoney(ytd.map((item) => item.net_amount)),
          taxes: sumMoney(
            ytd.map((item) =>
              dec(item.federal_withholding)
                .plus(item.virginia_withholding)
                .plus(item.social_security)
                .plus(item.medicare),
            ),
          ),
          employee: sumMoney(ytd.map((item) => item.roth_401k)),
          employer: sumMoney(ytd.map((item) => item.employer_401k_match)),
        };

        const openAdd = () => {
          setForm(blankForm(data, toNumeric(pto.accrual, 4)));
          setEditing(null);
          setAdding(true);
        };

        const openEdit = (paycheck: Paycheck) => {
          setForm(fromPaycheck(paycheck));
          setAdding(false);
          setEditing(paycheck);
        };

        const close = () => {
          setAdding(false);
          setEditing(null);
        };

        const submit = async (event: React.FormEvent) => {
          event.preventDefault();
          if (!form) return;
          await action.run(async (current) => {
            const payload = { ...form, net_amount: toNumeric(derivedNet(form)) };
            const message = editing
              ? await editPaycheck(current, editing.id, payload)
              : await createPaycheck(current, payload);
            close();
            return message;
          });
        };

        return (
          <>
            <PageHead
              eyebrow="Income & benefits"
              title="Paychecks"
              subtitle="Biweekly pay, taxes, Roth contributions, employer match, and PTO in one auditable record."
              actions={<Button onClick={openAdd}>+ Add paycheck</Button>}
            />

            <section className="grid metrics">
              <Metric
                label={`${year} gross YTD`}
                value={fmtMoney(ytdTotals.gross)}
                note="Recorded paycheck income"
              />
              <Metric
                label="Net pay YTD"
                value={fmtMoney(ytdTotals.net)}
                note={`Taxes ${fmtMoney(ytdTotals.taxes)}`}
              />
              <Metric
                label="Roth 401(k) YTD"
                value={fmtMoney(ytdTotals.employee)}
                note={`Employer match ${fmtMoney(ytdTotals.employer)}`}
              />
              <Metric
                label="PTO balance"
                value={`${pto.current.toFixed(2)} hrs`}
                note={`Projected year-end ${pto.projected.toFixed(2)} hrs`}
              />
            </section>

            <section className="grid two-even" style={{ marginBottom: 18 }}>
              <Card>
                <SectionHead
                  title="PTO tracking"
                  caption="Precision retained internally; display rounded for readability"
                  aside={<Tag tone="gold">{pto.accrual.toFixed(4)} hrs/paycheck</Tag>}
                />
                <div className="target-comparison">
                  <div className="target-box">
                    <small>Beginning balance</small>
                    <strong>{settings.pto_beginning_balance ?? "0"} hrs</strong>
                  </div>
                  <div className="target-box">
                    <small>Annual allowance</small>
                    <strong>{settings.annual_pto_hours ?? "0"} hrs</strong>
                  </div>
                </div>
              </Card>

              <Card>
                <SectionHead title="Pay profile" caption="Editable in Settings" />
                <div className="target-comparison">
                  <div className="target-box">
                    <small>Schedule</small>
                    <strong>{periods}× / year</strong>
                  </div>
                  <div className="target-box">
                    <small>Regular hours</small>
                    <strong>{settings.regular_hours_per_period ?? "80"} / period</strong>
                  </div>
                </div>
              </Card>
            </section>

            <article className="card">
              <div className="card-pad" style={{ paddingBottom: 5 }}>
                <SectionHead
                  title="Paycheck history & withholding audit"
                  caption="Expected income-tax withholding annualizes each check; Roth contributions remain taxable."
                  aside={<Tag>Estimates only</Tag>}
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Pay date</th>
                      <th>Gross / net</th>
                      <th>Actual taxes</th>
                      <th>Expected federal</th>
                      <th>Expected Virginia</th>
                      <th>FICA audit</th>
                      <th>Retirement</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {paychecks.length === 0 ? (
                      <Empty colSpan={9}>No paychecks recorded.</Empty>
                    ) : (
                      paychecks.map((item) => {
                        const audit = audits.get(item.id);
                        const gross = dec(item.gross_amount);
                        const totalTax = dec(item.federal_withholding)
                          .plus(item.virginia_withholding)
                          .plus(item.social_security)
                          .plus(item.medicare);
                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{fmtDate(item.pay_date)}</strong>
                              <div className="small-text muted">{item.regular_hours} hours</div>
                            </td>
                            <td className="amount">
                              {fmtMoney(gross)}
                              <div className="small-text income">Net {fmtMoney(item.net_amount)}</div>
                            </td>
                            <td>
                              <div className="small-text">
                                <strong>
                                  Total {fmtMoney(totalTax)} · {percentOf(totalTax, gross).toFixed(2)}%
                                </strong>
                              </div>
                              <div className="small-text">
                                Fed {fmtMoney(item.federal_withholding)} ·{" "}
                                {percentOf(dec(item.federal_withholding), gross).toFixed(2)}%
                              </div>
                              <div className="small-text">
                                VA {fmtMoney(item.virginia_withholding)} ·{" "}
                                {percentOf(dec(item.virginia_withholding), gross).toFixed(2)}%
                              </div>
                              <div className="small-text muted">
                                SS {fmtMoney(item.social_security)} · Medicare {fmtMoney(item.medicare)}
                              </div>
                            </td>

                            {audit ? (
                              <>
                                <td>
                                  <strong>{fmtMoney(audit.expectedFederal)}</strong>
                                  <div
                                    className={`small-text ${audit.federalDifference.greaterThanOrEqualTo(0) ? "income" : "danger"}`}
                                  >
                                    Actual − expected {fmtMoney(audit.federalDifference)}
                                  </div>
                                </td>
                                <td>
                                  <strong>{fmtMoney(audit.expectedVirginia)}</strong>
                                  <div
                                    className={`small-text ${audit.virginiaDifference.greaterThanOrEqualTo(0) ? "income" : "danger"}`}
                                  >
                                    Actual − expected {fmtMoney(audit.virginiaDifference)}
                                  </div>
                                </td>
                                <td>
                                  <div className="small-text">
                                    SS expected {fmtMoney(audit.expectedSocialSecurity)}
                                  </div>
                                  <div className="small-text">
                                    Medicare expected {fmtMoney(audit.expectedMedicare)}
                                  </div>
                                </td>
                                <td>
                                  <div className="small-text">Employee {fmtMoney(item.roth_401k)}</div>
                                  <div className="small-text income">
                                    Match {fmtMoney(item.employer_401k_match)}
                                  </div>
                                </td>
                                <td>
                                  <Tag tone={audit.status === "On Track" ? "green" : "gold"}>
                                    {audit.status}
                                  </Tag>
                                </td>
                              </>
                            ) : (
                              <td colSpan={5} className="muted">
                                Outside configured tax year
                              </td>
                            )}

                            <td>
                              <Button variant="secondary" small onClick={() => openEdit(item)}>
                                Edit
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <Modal
              open={adding || editing !== null}
              onClose={close}
              eyebrow="Income"
              title={editing ? "Edit paycheck" : "Add paycheck"}
            >
              {form && (
                <PaycheckForm
                  data={data}
                  form={form}
                  setForm={setForm}
                  onSubmit={submit}
                  onCancel={close}
                  busy={action.busy}
                  submitLabel={editing ? "Save changes" : "Save paycheck"}
                  scheduled={editing?.notes === SCHEDULED_PAYCHECK_NOTE}
                />
              )}
            </Modal>
          </>
        );
      }}
    </PageFrame>
  );
}

function PaycheckForm({
  data, form, setForm, onSubmit, onCancel, busy, submitLabel, scheduled,
}: {
  data: FinanceData;
  form: Form;
  setForm: (form: Form) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
  scheduled?: boolean;
}) {
  const set = (key: keyof Form, value: string) => setForm({ ...form, [key]: value });
  const net = derivedNet(form);

  const numberField = (key: keyof Form, label: string, step = "0.01", min = "0") => (
    <Field label={label}>
      <input
        type="number"
        min={min}
        step={step}
        value={form[key] as string}
        onChange={(event) => set(key, event.target.value)}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit}>
      {scheduled && (
        <div className="alert" style={{ marginBottom: 16 }}>
          This is an automatically scheduled estimate. Saving replaces it with your actual payroll
          figures and stops the scheduler overwriting it.
        </div>
      )}

      <div className="form-grid">
        <Field label="Pay date">
          <input
            type="date"
            value={form.pay_date}
            onChange={(event) => set("pay_date", event.target.value)}
            required
          />
        </Field>
        <Field label="Employer">
          <input
            value={form.employer}
            onChange={(event) => set("employer", event.target.value)}
            required
          />
        </Field>
        <Field label="Pay-period start">
          <input
            type="date"
            value={form.pay_period_start}
            onChange={(event) => set("pay_period_start", event.target.value)}
          />
        </Field>
        <Field label="Pay-period end">
          <input
            type="date"
            value={form.pay_period_end}
            onChange={(event) => set("pay_period_end", event.target.value)}
          />
        </Field>
        {numberField("regular_hours", "Regular hours")}
        <Field label="Gross pay">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.gross_amount}
            onChange={(event) => set("gross_amount", event.target.value)}
            required
          />
        </Field>
        {numberField("federal_withholding", "Federal withholding")}
        {numberField("virginia_withholding", "Virginia withholding")}
        {numberField("social_security", "Social Security")}
        {numberField("medicare", "Medicare")}
        {numberField("roth_401k", "Roth 401(k)")}
        {numberField("employer_401k_match", "Employer 401(k) match")}
        {numberField("other_deductions", "Other deductions")}

        {/* Read-only: the deposit follows from the lines above it, so it can
            never be recorded as something the arithmetic disagrees with. */}
        <Field label="Net pay (calculated)">
          <input type="text" value={fmtMoney(net)} readOnly tabIndex={-1} />
        </Field>

        {numberField("pto_earned", "PTO earned", "0.0001")}
        {numberField("pto_used", "PTO used", "0.0001")}

        <Field label="Destination account" full>
          <select
            value={form.destination_account_id}
            onChange={(event) => set("destination_account_id", event.target.value)}
          >
            <option value="">Not linked</option>
            {data.accounts
              .filter((account) => account.is_active)
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Notes" full>
          <textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} />
        </Field>
      </div>

      <FormActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || net.lessThanOrEqualTo(0)}>
          {submitLabel}
        </Button>
      </FormActions>
    </form>
  );
}
