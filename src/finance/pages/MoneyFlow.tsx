// Money Flow - the home screen. Ported from templates/flow.html.
//
// Shows one month reconciled: what came in, what was reserved, what was moved
// out, and what is genuinely left. Everything here is recorded rather than
// suggested - the envelopes were credited and the transfers are real.

import { useSearchParams } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import {
  Advisory, Button, Card, EquationPart, Field, FormActions, PageHead, SectionHead, Tag,
} from "../components/ui";
import { useAction, useAutoSync } from "../lib/actions";
import {
  closeMonth, monthFlow, monthlyObligations, planMonthOf, reopenMonth, replanMonth,
  type FlowNode,
} from "../lib/allocation";
import { liquidCash } from "../lib/finance";
import { fmtMonth, shiftMonths, todayISO, type ISODate } from "../lib/dates";
import { fmtMoney, sum as sumMoney } from "../lib/money";
import type { FinanceData } from "../lib/data";
import { useState } from "react";

/** Read ?month=YYYY-MM, falling back to the current month. */
function resolveFlowMonth(raw: string | null): ISODate {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  return planMonthOf(todayISO());
}

const monthParam = (month: ISODate) => month.slice(0, 7);
const monthShort = (month: ISODate) => fmtMonth(month).split(" ")[0].slice(0, 3);
const monthName = (month: ISODate) => fmtMonth(month).split(" ")[0];

export default function MoneyFlow() {
  const [params, setParams] = useSearchParams();
  const month = resolveFlowMonth(params.get("month"));
  const { syncError } = useAutoSync();
  const action = useAction();

  const previousMonth = shiftMonths(month, 1);
  const nextMonth = shiftMonths(month, -1);
  const isCurrentMonth = month === planMonthOf(todayISO());

  const goToMonth = (target: ISODate) => {
    action.clear();
    setParams(target === planMonthOf(todayISO()) ? {} : { month: monthParam(target) });
  };

  return (
    <PageFrame title="Money Flow" message={action.message} error={action.error ?? syncError}>
      {(data) => (
        <FlowBody
          data={data}
          month={month}
          isCurrentMonth={isCurrentMonth}
          previousMonth={previousMonth}
          nextMonth={nextMonth}
          goToMonth={goToMonth}
          action={action}
        />
      )}
    </PageFrame>
  );
}

function FlowBody({
  data, month, isCurrentMonth, previousMonth, nextMonth, goToMonth, action,
}: {
  data: FinanceData;
  month: ISODate;
  isCurrentMonth: boolean;
  previousMonth: ISODate;
  nextMonth: ISODate;
  goToMonth: (month: ISODate) => void;
  action: ReturnType<typeof useAction>;
}) {
  const settings = data.settings;
  const flow = monthFlow(data, month, settings);
  const obligations = monthlyObligations(data, month, settings);
  const monthLabel = fmtMonth(month);
  const [sweepTo, setSweepTo] = useState("");

  const sweepAccounts = data.accounts
    .filter((a) => a.is_active && !a.is_liability && a.account_type !== "checking")
    .sort((a, b) => a.name.localeCompare(b.name));

  // Envelope rows grouped the way the money actually travels: one heading per
  // destination account, matching the transfers that were created.
  const movedByAccount = new Map<string, FlowNode[]>();
  for (const node of flow.moved) {
    const key = node.accountName ?? "Unassigned";
    movedByAccount.set(key, [...(movedByAccount.get(key) ?? []), node]);
  }

  const replan = () =>
    action.run(async (current) => {
      const sync = await replanMonth(current, month, current.settings);
      return `Replanned ${monthLabel} from ${sync.allocated.length} paycheck(s).`;
    });

  const close = () =>
    action.run(async (current) => {
      const destination = /^\d+$/.test(sweepTo) ? Number(sweepTo) : null;
      const swept = await closeMonth(current, month, {
        sweepToAccountId: destination,
        settings: current.settings,
      });
      const detail = swept.greaterThan(0) ? ` Swept ${fmtMoney(swept)} to the account you chose.` : "";
      return `Closed ${monthLabel}.${detail}`;
    });

  const reopen = () =>
    action.run(async (current) => {
      await reopenMonth(current, month);
      return `Reopened ${monthLabel}.`;
    });

  return (
    <>
      <PageHead
        eyebrow="Money flow"
        title={monthLabel}
        subtitle="Every paycheck is earmarked the moment it lands. What is left is genuinely yours to spend."
        actions={
          <>
            <Button variant="secondary" onClick={() => goToMonth(previousMonth)}>
              &larr; {monthShort(previousMonth)}
            </Button>
            {!isCurrentMonth && (
              <Button variant="secondary" onClick={() => goToMonth(planMonthOf(todayISO()))}>
                This month
              </Button>
            )}
            <Button variant="secondary" onClick={() => goToMonth(nextMonth)}>
              {monthShort(nextMonth)} &rarr;
            </Button>
          </>
        }
      />

      {flow.paychecks.length === 0 ? (
        <div className="principle-banner">
          <div className="principle-icon">!</div>
          <div>
            <strong>No paychecks recorded in {monthLabel}</strong>
            <span>
              Log a paycheck, or set your payroll schedule in Settings, and the plan below builds itself.
            </span>
          </div>
        </div>
      ) : flow.unplannedPaychecks.length > 0 ? (
        <div className="principle-banner">
          <div className="principle-icon">!</div>
          <div>
            <strong>{flow.unplannedPaychecks.length} paycheck(s) not planned yet</strong>
            <span>Automatic allocation is switched off in Settings, or this month is closed.</span>
          </div>
          <Button variant="secondary" small onClick={replan} disabled={action.busy}>
            Plan now
          </Button>
        </div>
      ) : null}

      <section className={`flow-headline card card-pad${flow.overspent ? " flow-over" : ""}`}>
        <div className="flow-headline-main">
          <span className="metric-label">{flow.overspent ? "Overspent by" : "Left to spend"}</span>
          <div className="flow-big">
            {fmtMoney(flow.overspent ? flow.remaining.negated() : flow.remaining)}
          </div>
          <div className="metric-note">
            of {fmtMoney(flow.spendable)} discretionary &middot; {fmtMoney(flow.discretionarySpent)} spent so far
          </div>
          <div className="progress-track flow-bar">
            <div
              className={`progress-fill${flow.overspent ? " danger-fill" : ""}`}
              style={{ width: `${flow.spentPercent.toNumber()}%` }}
            />
          </div>
        </div>
        <div className="flow-headline-side">
          <EquationPart label="Still-unpaid bills held back" value={fmtMoney(flow.billsOutstanding)} />
          <EquationPart label="Card statement held back" value={fmtMoney(flow.cardsOutstanding)} />
          <EquationPart label="Liquid cash right now" value={fmtMoney(liquidCash(data))} />
        </div>
      </section>

      <section className="flow-tree card card-pad">
        <SectionHead
          title={`Where ${monthLabel}'s money went`}
          caption="Recorded, not suggested — envelopes are credited and transfers are real"
          aside={
            <Tag tone={flow.isPlanned ? "green" : "gold"}>
              {flow.paychecks.length} paycheck(s) &middot; {fmtMoney(flow.netIncome)} net
            </Tag>
          }
        />

        <div className="flow-node flow-root">
          <div className="flow-node-head">
            <span className="flow-dot" />
            <strong>Net pay</strong>
          </div>
          <span className="flow-amount">{fmtMoney(flow.netIncome)}</span>
        </div>

        <div className="flow-branch">
          <div className="flow-node flow-group">
            <div className="flow-node-head">
              <span className="flow-dot reserve" />
              <strong>Stays in checking</strong>
              <span className="flow-note">Reserved for bills and the card statement</span>
            </div>
            <span className="flow-amount">{fmtMoney(flow.reservedTotal)}</span>
          </div>

          {flow.reserved.length > 0 ? (
            flow.reserved.map((node) => <Leaf key={`${node.kind}-${node.label}`} node={node} />)
          ) : (
            <div className="flow-leaf muted">Nothing reserved — add recurring expenses in Settings.</div>
          )}

          <div className="flow-node flow-group">
            <div className="flow-node-head">
              <span className="flow-dot move" />
              <strong>Moved out of checking</strong>
              <span className="flow-note">One real transfer per destination account</span>
            </div>
            <span className="flow-amount">{fmtMoney(flow.movedTotal)}</span>
          </div>

          {movedByAccount.size > 0 ? (
            [...movedByAccount].map(([accountName, nodes]) => (
              <div key={accountName}>
                <div className="flow-leaf flow-subhead">
                  <span className="flow-leaf-label">&rarr; {accountName}</span>
                  <span className="flow-amount">{fmtMoney(sumMoney(nodes.map((n) => n.amount)))}</span>
                </div>
                {nodes.map((node) => (
                  <Leaf key={`${node.kind}-${node.label}`} node={node} nested />
                ))}
              </div>
            ))
          ) : (
            <div className="flow-leaf muted">
              Nothing moved — add a sinking fund or goal to start earmarking savings.
            </div>
          )}

          <div className="flow-node flow-group flow-result">
            <div className="flow-node-head">
              <span className="flow-dot spend" />
              <strong>Left to spend</strong>
              <span className="flow-note">Imported transactions draw this down</span>
            </div>
            <span className="flow-amount">{fmtMoney(flow.spendable)}</span>
          </div>

          <div className="flow-leaf">
            <div>
              <span className="flow-leaf-label">Discretionary spending imported</span>
              <span className="flow-note">Bills matched to their reserve are excluded</span>
            </div>
            <span className="flow-amount">&minus;{fmtMoney(flow.discretionarySpent)}</span>
          </div>

          <div className="flow-leaf flow-total">
            <div>
              <span className="flow-leaf-label">{flow.overspent ? "Overspent" : "Remaining"}</span>
            </div>
            <span className={`flow-amount ${flow.overspent ? "danger" : "income"}`}>
              {fmtMoney(flow.remaining)}
            </span>
          </div>
        </div>
      </section>

      <section className="grid two-col">
        <Card>
          <SectionHead
            title={`${monthLabel}'s obligations`}
            caption="What the month needs each month, added up"
            aside={<Tag tone="gold">{fmtMoney(flow.obligationTotal)}</Tag>}
          />
          {obligations.length > 0 ? (
            obligations.map((item) => (
              <div className="obligation" key={`${item.kind}-${item.targetId}-${item.label}`}>
                <div className="obligation-info">
                  <strong>{item.label}</strong>
                  <span>{item.note}</span>
                </div>
                <span className="obligation-amount">{fmtMoney(item.monthlyAmount)}</span>
              </div>
            ))
          ) : (
            <p className="muted">No obligations configured yet.</p>
          )}
        </Card>

        <Card>
          <SectionHead
            title="Close the month"
            caption="Divert whatever is left, then lock the month"
            aside={flow.isClosed ? <Tag tone="green">Closed</Tag> : undefined}
          />

          {flow.isClosed ? (
            <>
              <p className="muted">
                {monthLabel} is closed
                {flow.plan && Number(flow.plan.swept_amount) > 0
                  ? ` and ${fmtMoney(flow.plan.swept_amount)} was swept out of checking`
                  : ""}
                . Reopening lets automatic allocation plan it again.
              </p>
              <FormActions>
                <Button variant="secondary" onClick={reopen} disabled={action.busy}>
                  Reopen {monthName(month)}
                </Button>
              </FormActions>
            </>
          ) : (
            <>
              <Field label={`Send the ${fmtMoney(flow.remaining)} leftover to`}>
                <select value={sweepTo} onChange={(event) => setSweepTo(event.target.value)}>
                  <option value="">Leave it in checking</option>
                  {sweepAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="small-text muted">
                Closing records a real transfer for the leftover and stops automatic allocation from
                touching {monthLabel} again.
              </p>
              <FormActions>
                <Button variant="gold" onClick={close} disabled={action.busy}>
                  Close {monthName(month)}
                </Button>
              </FormActions>
            </>
          )}

          <Advisory style={{ marginTop: 14 }}>
            Changed a bill, fund, or goal? Replan rebuilds {monthLabel} from scratch without
            double-crediting anything.
          </Advisory>
          <FormActions>
            <Button variant="secondary" onClick={replan} disabled={action.busy}>
              Replan {monthName(month)}
            </Button>
          </FormActions>
        </Card>
      </section>
    </>
  );
}

function Leaf({ node, nested = false }: { node: FlowNode; nested?: boolean }) {
  return (
    <div className={`flow-leaf${nested ? " flow-nested" : ""}`}>
      <div>
        <span className="flow-leaf-label">{node.label}</span>
        {node.shortfall.greaterThan(0) && (
          <Tag tone="gold" small>
            {fmtMoney(node.shortfall)} short
          </Tag>
        )}
        <span className="flow-note">{node.note}</span>
      </div>
      <span className="flow-amount">
        {fmtMoney(node.amount)}
        {!node.target.equals(node.amount) && (
          <small className="muted"> / {fmtMoney(node.target)}</small>
        )}
      </span>
    </div>
  );
}
