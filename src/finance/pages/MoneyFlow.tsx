// Money Flow — the one page this app is really for.
//
// A month here is done once, in order, after it is over. There is nothing to
// decide about a month still in progress — the last paycheck has not landed,
// the card statement has not closed — so the page will not let you touch one
// until the calendar has actually turned the page. Once it has, the month is
// walked through as a fixed sequence: import what happened, confirm the bills
// (rent, utilities, subscriptions, the card statement) that came out on their
// own, decide where the leftover goes, then say where the leftover itself
// lands. Every step updates the numbers the next step reasons about; nothing
// is skippable and nothing is asked twice.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import ImportPanel from "../components/ImportPanel";
import { Advisory, Button, Card, EquationPart, Field, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { closeMonth, monthFlow, planMonthOf, reopenMonth } from "../lib/allocation";
import { monthPlanView, saveMonthPlan, type MonthPlanView, type PlanEntry, type PlanRow } from "../lib/monthplan";
import { liquidCash } from "../lib/finance";
import { addMonths, fmtDate, fmtMonth, monthBounds, shiftMonths, todayISO, type ISODate } from "../lib/dates";
import { Decimal, ZERO, fmtMoney, maxDec, minDec, money, sum as sumMoney } from "../lib/money";
import type { FinanceData } from "../lib/data";

/** Read ?month=YYYY-MM, falling back to the current month. */
function resolveFlowMonth(raw: string | null): ISODate {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  return planMonthOf(todayISO());
}

const monthParam = (month: ISODate) => month.slice(0, 7);
const monthShort = (month: ISODate) => fmtMonth(month).split(" ")[0].slice(0, 3);
const monthName = (month: ISODate) => fmtMonth(month).split(" ")[0];

/** A month can only be walked through once the calendar has moved past it. */
const monthHasEnded = (month: ISODate) => planMonthOf(todayISO()) > planMonthOf(month);

/** A draft is held as strings so a half-typed "12." does not become NaN. */
type Draft = Record<string, string>;

const amountOf = (draft: Draft, key: string): Decimal => {
  const raw = (draft[key] ?? "").trim();
  if (raw === "") return ZERO;
  try {
    const parsed = new Decimal(raw);
    return parsed.isFinite() ? maxDec(ZERO, money(parsed)) : ZERO;
  } catch {
    return ZERO;
  }
};

/**
 * Seed the editor.
 *
 * A month that has already been planned opens showing exactly what is recorded.
 * One that has never been touched opens pre-filled with what the app would have
 * done, so the common case is read it, then press Continue.
 */
const draftFromRows = (rows: PlanRow[], planned: boolean): Draft =>
  Object.fromEntries(
    rows.map((row) => [row.key, (planned ? row.amount : row.suggested).toFixed(2)]),
  );

export default function MoneyFlow() {
  const [params, setParams] = useSearchParams();
  const month = resolveFlowMonth(params.get("month"));
  const action = useAction();

  const goToMonth = (target: ISODate) => {
    action.clear();
    setParams(target === planMonthOf(todayISO()) ? {} : { month: monthParam(target) });
  };

  return (
    <PageFrame title="Money Flow" message={action.message} error={action.error}>
      {(data) => <FlowBody data={data} month={month} goToMonth={goToMonth} action={action} />}
    </PageFrame>
  );
}

/**
 * Every ended, still-open month that still has money sitting undecided —
 * oldest first. A month still in progress is never "behind"; it simply is not
 * actionable yet.
 */
function undecidedMonths(data: FinanceData, settings: Record<string, string>): MonthPlanView[] {
  const current = planMonthOf(todayISO());
  const first = data.paychecks.reduce<ISODate | null>(
    (earliest, paycheck) =>
      earliest === null || paycheck.pay_date < earliest ? paycheck.pay_date : earliest,
    null,
  );
  if (!first) return [];

  const views: MonthPlanView[] = [];
  for (let cursor = planMonthOf(first); cursor < current; cursor = addMonths(cursor, 1)) {
    const view = monthPlanView(data, cursor, settings);
    if (view.paychecks.length > 0 && !view.isClosed && view.unallocated.greaterThan(ZERO)) {
      views.push(view);
    }
  }
  return views;
}

type StepKey = "import" | "bills" | "buckets" | "leftover";
const STEPS: { key: StepKey; label: string }[] = [
  { key: "import", label: "Import what happened" },
  { key: "bills", label: "Confirm bills" },
  { key: "buckets", label: "Where the rest goes" },
  { key: "leftover", label: "Send the leftover" },
];

function FlowBody({
  data, month, goToMonth, action,
}: {
  data: FinanceData;
  month: ISODate;
  goToMonth: (month: ISODate) => void;
  action: ReturnType<typeof useAction>;
}) {
  const settings = data.settings;
  const view = monthPlanView(data, month, settings);
  const monthLabel = view.label;
  const ended = monthHasEnded(month);

  const pending = useMemo(() => undecidedMonths(data, settings), [data, settings]);
  const otherPending = pending.filter((item) => item.month !== month);

  return (
    <>
      <PageHead
        eyebrow="Money flow"
        title={monthLabel}
        subtitle={
          ended
            ? "Bills come out on their own. What is left is yours to place."
            : "This month is still running — nothing to decide until it ends."
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => goToMonth(shiftMonths(month, 1))}>
              &larr; {monthShort(shiftMonths(month, 1))}
            </Button>
            {month !== planMonthOf(todayISO()) && (
              <Button variant="secondary" onClick={() => goToMonth(planMonthOf(todayISO()))}>
                This month
              </Button>
            )}
            <Button variant="secondary" onClick={() => goToMonth(shiftMonths(month, -1))}>
              {monthShort(shiftMonths(month, -1))} &rarr;
            </Button>
          </>
        }
      />

      {otherPending.length > 0 && (
        <div className="principle-banner">
          <div className="principle-icon">!</div>
          <div>
            <strong>
              {otherPending.length} other month{otherPending.length === 1 ? "" : "s"} still undecided
            </strong>
            <span>
              Money came in and has not been placed yet. Pick one up where you left off.
            </span>
          </div>
          <div className="button-row">
            {otherPending.slice(0, 4).map((item) => (
              <Button key={item.month} variant="secondary" small onClick={() => goToMonth(item.month)}>
                {monthShort(item.month)} &middot; {fmtMoney(item.unallocated)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!ended ? (
        <LockedMonth data={data} view={view} month={month} />
      ) : view.isClosed ? (
        <ClosedMonth data={data} view={view} month={month} action={action} />
      ) : (
        <Wizard data={data} view={view} month={month} action={action} />
      )}
    </>
  );
}

/** A month still in progress: nothing editable, just the shape of what is coming. */
function LockedMonth({ data, view, month }: { data: FinanceData; view: MonthPlanView; month: ISODate }) {
  const unlocksOn = fmtDate(addMonths(planMonthOf(month), 1));
  return (
    <>
      <div className="principle-banner">
        <div className="principle-icon">!</div>
        <div>
          <strong>{view.label} is not over yet</strong>
          <span>
            The walkthrough for a month unlocks once the month ends, on {unlocksOn} — once the last
            paycheck and the card statement are both real, not still coming.
          </span>
        </div>
      </div>

      <section className="grid two-col">
        <Card>
          <SectionHead title="Pay so far" caption="What has landed in this month" />
          {view.paychecks.length === 0 ? (
            <p className="empty">Nothing recorded yet.</p>
          ) : (
            <div className="plan-rows">
              {view.paychecks.map((paycheck) => (
                <div className="plan-row" key={paycheck.id}>
                  <div className="plan-row-label">
                    <strong>{fmtDate(paycheck.pay_date)}</strong>
                    <span className="flow-note">{paycheck.employer}</span>
                  </div>
                  <span className="flow-amount">{fmtMoney(paycheck.net_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHead title="Right now" caption="Real cash, not the plan" />
          <EquationPart label="Liquid cash right now" value={fmtMoney(liquidCash(data))} />
        </Card>
      </section>
    </>
  );
}

/** An already-closed month: the final record, with the option to reopen it. */
function ClosedMonth({
  data, view, month, action,
}: {
  data: FinanceData;
  view: MonthPlanView;
  month: ISODate;
  action: ReturnType<typeof useAction>;
}) {
  const flow = monthFlow(data, month, data.settings);
  const monthLabel = fmtMonth(month);

  const reopen = () =>
    action.run(async (current) => {
      await reopenMonth(current, month);
      return `Reopened ${monthLabel}.`;
    });

  return (
    <>
      <section className="flow-strip card card-pad">
        <EquationPart label={`Came in (${view.paychecks.length} paycheck${view.paychecks.length === 1 ? "" : "s"})`} value={fmtMoney(view.netIncome)} />
        <span className="flow-op">&minus;</span>
        <EquationPart label="Bills" value={fmtMoney(view.billsAllocated)} />
        <span className="flow-op">&minus;</span>
        <EquationPart label="Into savings" value={fmtMoney(view.bucketsAllocated)} />
        <span className="flow-op">=</span>
        <EquationPart label="Left to spend" value={fmtMoney(view.unallocated)} result />
      </section>

      <Advisory style={{ marginTop: 14 }}>
        {monthLabel} is closed and nothing will change it. {fmtMoney(flow.remaining)} was left when it
        closed. Reopen it to walk through it again.
      </Advisory>
      <div className="button-row" style={{ marginTop: 12 }}>
        <Button variant="secondary" onClick={reopen} disabled={action.busy}>
          Reopen {monthName(month)}
        </Button>
      </div>
    </>
  );
}

function Wizard({
  data, view, month, action,
}: {
  data: FinanceData;
  view: MonthPlanView;
  month: ISODate;
  action: ReturnType<typeof useAction>;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...draftFromRows(view.bills, view.hasPlan),
    ...draftFromRows(view.buckets, true),
  }));
  const [sweepTo, setSweepTo] = useState("");
  const [skipImport, setSkipImport] = useState(false);

  useEffect(() => {
    setStep(0);
    setSkipImport(false);
    setSweepTo("");
    setDraft({
      ...draftFromRows(view.bills, view.hasPlan),
      ...draftFromRows(view.buckets, true),
    });
    // Reseed only when the month itself changes — an in-progress edit should
    // survive a background refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const billTotal = sumMoney(view.bills.map((row) => amountOf(draft, row.key)));
  const bucketTotal = sumMoney(view.buckets.map((row) => amountOf(draft, row.key)));
  const afterBills = money(view.netIncome.minus(billTotal));
  const undecided = money(afterBills.minus(bucketTotal));
  const overCommitted = undecided.isNegative();

  const [monthStart, monthEnd] = monthBounds(month);
  const monthTransactionCount = data.transactions.filter(
    (t) => t.transaction_date >= monthStart && t.transaction_date <= monthEnd,
  ).length;

  const fillSuggestions = () => {
    let budget = maxDec(ZERO, afterBills);
    const next: Draft = { ...draft };
    for (const row of view.buckets) {
      const give = minDec(budget, row.target);
      budget = money(budget.minus(give));
      next[row.key] = give.toFixed(2);
    }
    setDraft(next);
  };

  const allInto = (row: PlanRow) => {
    const next: Draft = { ...draft };
    for (const bucket of view.buckets) next[bucket.key] = "0.00";
    next[row.key] = maxDec(ZERO, afterBills).toFixed(2);
    setDraft(next);
  };

  const clearBuckets = () => {
    const next: Draft = { ...draft };
    for (const bucket of view.buckets) next[bucket.key] = "0.00";
    setDraft(next);
  };

  const sweepAccounts = data.accounts
    .filter((a) => a.is_active && !a.is_liability && a.account_type !== "checking")
    .sort((a, b) => a.name.localeCompare(b.name));

  const finish = () =>
    action.run(async (current) => {
      const rows = [...view.bills, ...view.buckets];
      const entries: PlanEntry[] = rows.map((row) => ({
        kind: row.kind,
        targetId: row.targetId,
        label: row.label,
        note: row.note,
        destinationAccountId: row.destinationAccountId,
        amount: amountOf(draft, row.key),
      }));
      const left = await saveMonthPlan(current, month, entries, current.settings);
      const destination = /^\d+$/.test(sweepTo) ? Number(sweepTo) : null;
      const swept = await closeMonth(current, month, {
        sweepToAccountId: destination,
        settings: current.settings,
      });
      const detail = swept.greaterThan(ZERO) ? ` Swept ${fmtMoney(swept)}.` : "";
      return `${view.label} closed. ${fmtMoney(left)} left to spend.${detail}`;
    });

  const canLeaveImport = monthTransactionCount > 0 || skipImport;

  return (
    <>
      <div className="button-row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        {STEPS.map((item, index) => (
          <Tag key={item.key} tone={index === step ? "gold" : index < step ? "green" : undefined}>
            {index + 1}. {item.label}
          </Tag>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <SectionHead
            title="Import what happened"
            caption="Bring in this month's transactions before anything gets confirmed"
          />
          <p className={monthTransactionCount > 0 ? "small-text" : "empty"}>
            {monthTransactionCount > 0
              ? `${monthTransactionCount} transaction${monthTransactionCount === 1 ? "" : "s"} found in ${view.label}.`
              : `Nothing imported for ${view.label} yet.`}
          </p>
          <div style={{ marginTop: 14 }}>
            <ImportPanel data={data} action={action} />
          </div>
          {monthTransactionCount === 0 && (
            <div style={{ marginTop: 10 }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={skipImport}
                  onChange={(event) => setSkipImport(event.target.checked)}
                />
                Nothing to import this month
              </label>
              <span className="small-text muted">
                Only check this if there is genuinely nothing to import for this month.
              </span>
            </div>
          )}
          <div className="button-row" style={{ marginTop: 14 }}>
            <Button variant="gold" onClick={() => setStep(1)} disabled={!canLeaveImport}>
              Continue
            </Button>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <SectionHead
            title="Confirm bills"
            caption="Taken out automatically, in this order, until the money runs out"
            aside={<Tag tone={view.billsShortfall.greaterThan(ZERO) ? "gold" : "green"}>{fmtMoney(billTotal)}</Tag>}
          />
          {view.bills.length === 0 ? (
            <p className="empty">No bills yet — add them on the Bills page.</p>
          ) : (
            <div className="plan-rows">
              {view.bills.map((row) => (
                <PlanLine
                  key={row.key}
                  row={row}
                  value={draft[row.key] ?? "0.00"}
                  onChange={(value) => set(row.key, value)}
                  disabled={action.busy}
                />
              ))}
            </div>
          )}
          {view.billsShortfall.greaterThan(ZERO) && (
            <div className="plan-shortfall">
              <strong>{fmtMoney(view.billsShortfall)} short</strong>
              <span>
                {view.label} did not bring in enough to cover every bill. Trim one above, or cover it
                from savings and record the transfer on Accounts.
              </span>
            </div>
          )}
          <div className="button-row" style={{ marginTop: 14 }}>
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button variant="gold" onClick={() => setStep(2)}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <SectionHead
            title="Where the rest goes"
            caption={`${fmtMoney(maxDec(ZERO, afterBills))} available — you choose the split`}
            aside={<Tag tone={overCommitted ? "gold" : "green"}>{fmtMoney(bucketTotal)}</Tag>}
          />
          {view.buckets.length === 0 ? (
            <p className="empty">No savings buckets yet — add one on Savings &amp; Goals.</p>
          ) : (
            <>
              <div className="button-row plan-quick">
                <Button variant="secondary" small onClick={fillSuggestions} disabled={action.busy}>
                  Use suggestions
                </Button>
                <Button variant="secondary" small onClick={clearBuckets} disabled={action.busy}>
                  Clear
                </Button>
              </div>
              <div className="plan-rows">
                {view.buckets.map((row) => (
                  <PlanLine
                    key={row.key}
                    row={row}
                    value={draft[row.key] ?? "0.00"}
                    onChange={(value) => set(row.key, value)}
                    disabled={action.busy}
                    onAllIn={() => allInto(row)}
                    allInDisabled={action.busy || afterBills.lessThanOrEqualTo(ZERO)}
                  />
                ))}
              </div>
            </>
          )}
          {overCommitted && (
            <div className="plan-shortfall">
              <strong>{fmtMoney(undecided.negated())} over</strong>
              <span>You have placed more than came in this month. Take some back before continuing.</span>
            </div>
          )}
          <div className="button-row" style={{ marginTop: 14 }}>
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button variant="gold" onClick={() => setStep(3)} disabled={overCommitted}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <SectionHead title="Send the leftover" caption="What is left after bills and savings" />

          <section className="flow-strip">
            <EquationPart label={`Came in (${view.paychecks.length} paycheck${view.paychecks.length === 1 ? "" : "s"})`} value={fmtMoney(view.netIncome)} />
            <span className="flow-op">&minus;</span>
            <EquationPart label="Bills" value={fmtMoney(billTotal)} />
            <span className="flow-op">&minus;</span>
            <EquationPart label="Into savings" value={fmtMoney(bucketTotal)} />
            <span className="flow-op">=</span>
            <EquationPart label="Left to spend" value={fmtMoney(undecided)} result />
          </section>

          <Field label={`Send the ${fmtMoney(maxDec(ZERO, undecided))} leftover to`}>
            <select value={sweepTo} onChange={(event) => setSweepTo(event.target.value)}>
              <option value="">Leave it in checking</option>
              {sweepAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="button-row" style={{ marginTop: 14 }}>
            <Button variant="secondary" onClick={() => setStep(2)} disabled={action.busy}>Back</Button>
            <Button
              variant="gold"
              onClick={finish}
              loading={action.busy}
              disabled={overCommitted || view.paychecks.length === 0}
            >
              Save &amp; close {monthName(month)}
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}

function PlanLine({
  row, value, onChange, disabled, onAllIn, allInDisabled,
}: {
  row: PlanRow;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onAllIn?: () => void;
  allInDisabled?: boolean;
}) {
  const short = row.automatic && row.target.greaterThan(amountFromString(value));
  return (
    <div className={`plan-row${short ? " plan-row-short" : ""}`}>
      <div className="plan-row-label">
        <strong>{row.label}</strong>
        <span className="flow-note">
          {row.destinationName ? `→ ${row.destinationName}` : row.note}
          {row.target.greaterThan(ZERO) && ` · wants ${fmtMoney(row.target)}`}
        </span>
      </div>
      {onAllIn && (
        <button className="plan-all" type="button" onClick={onAllIn} disabled={allInDisabled}>
          All in
        </button>
      )}
      <input
        className="plan-input"
        type="number"
        min="0"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`Amount for ${row.label}`}
      />
    </div>
  );
}

function amountFromString(value: string): Decimal {
  try {
    const parsed = new Decimal(value.trim() || "0");
    return parsed.isFinite() ? parsed : ZERO;
  } catch {
    return ZERO;
  }
}
