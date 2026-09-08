// Savings & Goals — the buckets, and what each account is actually made of.
//
// "$11,000 in savings" is not a useful sentence. The useful sentence is "$6,000
// of that is the emergency fund, $3,200 is the car, $1,800 is travel, and $0 is
// unspoken for." That is the question this page exists to answer, and the bar at
// the top of each account is the answer.
//
// Goals and sinking funds were separate pages in the original app. They are the
// same idea — a name, a target, and the cash standing behind it — so they are one
// list here. See lib/buckets.ts for why both tables stay.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Button, Card, Field, FormActions, Modal, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { buckets, percentOfTotal, savingsBreakdown, type Bucket } from "../lib/buckets";
import {
  archiveGoal, archiveSinkingFund, createGoal, updateGoal, updateSinkingFund,
} from "../lib/mutations";
import { ZERO, fmtMoney, fmtPercent, sum as sumMoney } from "../lib/money";
import { fmtMonthShort } from "../lib/dates";
import type { FinanceData } from "../lib/data";
import { CASH_ACCOUNT_TYPES, GOAL_TYPES, GOAL_TYPE_LABELS } from "../lib/types";

/** Five stable slice colours, in the order the palette pairs safely. */
const SLICE_COLORS = ["#b99345", "#4d7c6f", "#8f8e87", "#7a6099", "#a35d4a"];

const BLANK = {
  name: "", goal_type: "other", target_amount: "", current_amount: "0",
  user_monthly_target: "0", target_date: "", linked_account_id: "",
};

export default function Savings() {
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [editing, setEditing] = useState<Bucket | null>(null);

  return (
    <PageFrame title="Savings & Goals" message={action.message} error={action.error}>
      {(data) => {
        const settings = data.settings;
        const all = buckets(data, settings);
        const breakdown = savingsBreakdown(data, settings);
        const totalBucketed = sumMoney(all.map((bucket) => bucket.current));
        const homeless = all.filter((bucket) => bucket.accountId === null);

        const add = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            const message = await createGoal(current, draft);
            setAdding(false);
            setDraft(BLANK);
            return message;
          });
        };

        const archive = (bucket: Bucket) =>
          action.run((current) =>
            bucket.source === "goal"
              ? archiveGoal(current, bucket.id)
              : archiveSinkingFund(current, bucket.id),
          );

        return (
          <>
            <PageHead
              eyebrow="Where your money is going"
              title="Savings & goals"
              subtitle="Every dollar you set aside belongs to something. This is what each account is holding, and for what."
              actions={<Button onClick={() => setAdding(true)}>+ Add bucket</Button>}
            />

            <section className="grid three-col">
              <Card>
                <span className="metric-label">Set aside</span>
                <div className="metric-value">{fmtMoney(totalBucketed)}</div>
                <div className="metric-note">Across {all.length} buckets</div>
              </Card>
              <Card>
                <span className="metric-label">Still to save</span>
                <div className="metric-value">
                  {fmtMoney(sumMoney(all.map((bucket) => bucket.remaining)))}
                </div>
                <div className="metric-note">To hit every target you have set</div>
              </Card>
              <Card>
                <span className="metric-label">Suggested each month</span>
                <div className="metric-value">
                  {fmtMoney(sumMoney(all.map((bucket) => bucket.suggestedMonthly)))}
                </div>
                <div className="metric-note">What Money Flow pre-fills, before you change it</div>
              </Card>
            </section>

            <Card>
              <SectionHead
                title="What each account is made of"
                caption="A balance is only meaningful once you know what it is holding"
              />
              {breakdown.length === 0 ? (
                <p className="empty">No cash accounts yet — add one on Accounts.</p>
              ) : (
                breakdown.map((entry) => (
                  <div className="account-breakdown" key={entry.account.id}>
                    <div className="plan-row-label">
                      <strong>{entry.account.name}</strong>
                      <span className="flow-note">
                        {fmtMoney(entry.assigned)} spoken for
                        {entry.overAssigned
                          ? ` · ${fmtMoney(entry.assigned.minus(entry.balance))} more than the account holds`
                          : ` · ${fmtMoney(entry.unassigned)} free`}
                      </span>
                    </div>
                    <span className="flow-amount breakdown-total">{fmtMoney(entry.balance)}</span>

                    <div className="breakdown-bar">
                      {entry.buckets.map((bucket, index) => (
                        <span
                          key={`${bucket.source}-${bucket.id}`}
                          className="breakdown-slice"
                          style={{
                            width: `${percentOfTotal(bucket.current, entry.balance)}%`,
                            background: SLICE_COLORS[index % SLICE_COLORS.length],
                          }}
                          title={`${bucket.name}: ${fmtMoney(bucket.current)}`}
                        />
                      ))}
                    </div>

                    <div className="breakdown-legend">
                      {entry.buckets.map((bucket, index) => (
                        <span className="breakdown-key" key={`${bucket.source}-${bucket.id}`}>
                          <i style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }} />
                          {bucket.name} · {fmtMoney(bucket.current)}
                        </span>
                      ))}
                      {entry.unassigned.greaterThan(ZERO) && (
                        <span className="breakdown-key">
                          <i className="breakdown-free" />
                          Unassigned · {fmtMoney(entry.unassigned)}
                        </span>
                      )}
                      {entry.buckets.length === 0 && entry.unassigned.lessThanOrEqualTo(ZERO) && (
                        <span className="muted small-text">Nothing here yet.</span>
                      )}
                    </div>

                    {entry.overAssigned && (
                      <div className="plan-shortfall">
                        <strong>Buckets over-claim this account</strong>
                        <span>
                          They add up to more than the balance. Either the balance is out of date, or a
                          bucket's amount is.
                        </span>
                      </div>
                    )}
                  </div>
                ))
              )}

              {homeless.length > 0 && (
                <div className="plan-shortfall">
                  <strong>{homeless.length} bucket(s) have no account</strong>
                  <span>
                    {homeless.map((bucket) => bucket.name).join(", ")} — set one below so they show up in a
                    breakdown.
                  </span>
                </div>
              )}
            </Card>

            <Card>
              <SectionHead
                title="Your buckets"
                caption="Money Flow suggests these amounts each month; you decide what they actually get"
                aside={<Tag tone="gold">{all.length}</Tag>}
              />
              {all.length === 0 ? (
                <p className="empty">No buckets yet.</p>
              ) : (
                <div className="plan-rows">
                  {all.map((bucket) => (
                    <div className="plan-row bucket-row" key={`${bucket.source}-${bucket.id}`}>
                      <div className="plan-row-label">
                        <strong>{bucket.name}</strong>
                        <span className="flow-note">
                          {bucket.kindLabel}
                          {bucket.targetDate ? ` · by ${fmtMonthShort(bucket.targetDate)}` : ""}
                          {bucket.suggestedMonthly.greaterThan(ZERO)
                            ? ` · suggests ${fmtMoney(bucket.suggestedMonthly)}/mo`
                            : " · funded"}
                        </span>
                        <div className="progress-track" style={{ marginTop: 8 }}>
                          <div
                            className="progress-fill"
                            style={{ width: `${Math.min(100, bucket.percent.toNumber())}%` }}
                          />
                        </div>
                      </div>
                      <div className="bill-amounts">
                        <span className="flow-amount">{fmtMoney(bucket.current)}</span>
                        <small className="muted">
                          of {fmtMoney(bucket.target)} · {fmtPercent(bucket.percent)}
                        </small>
                      </div>
                      <div className="button-row">
                        <Button variant="secondary" small onClick={() => setEditing(bucket)} disabled={action.busy}>
                          Edit
                        </Button>
                        <Button variant="secondary" small onClick={() => archive(bucket)} disabled={action.busy}>
                          Archive
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Modal open={adding} onClose={() => setAdding(false)} eyebrow="Savings bucket" title="Add a bucket">
              <form onSubmit={add}>
                <div className="form-grid">
                  <Field label="Name" full>
                    <input
                      value={draft.name}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="What kind">
                    <select
                      value={draft.goal_type}
                      onChange={(event) => setDraft({ ...draft, goal_type: event.target.value })}
                    >
                      {GOAL_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {GOAL_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Target amount">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={draft.target_amount}
                      onChange={(event) => setDraft({ ...draft, target_amount: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Already in it">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.current_amount}
                      onChange={(event) => setDraft({ ...draft, current_amount: event.target.value })}
                    />
                  </Field>
                  <Field label="Aim for per month" hint="Left at 0, Money Flow works one out from the date.">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.user_monthly_target}
                      onChange={(event) => setDraft({ ...draft, user_monthly_target: event.target.value })}
                    />
                  </Field>
                  <Field label="Target date (optional)">
                    <input
                      type="date"
                      value={draft.target_date}
                      onChange={(event) => setDraft({ ...draft, target_date: event.target.value })}
                    />
                  </Field>
                  <AccountField
                    data={data}
                    value={draft.linked_account_id}
                    onChange={(value) => setDraft({ ...draft, linked_account_id: value })}
                  />
                </div>
                <FormActions>
                  <Button variant="secondary" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={action.busy}>
                    Add bucket
                  </Button>
                </FormActions>
              </form>
            </Modal>

            {editing && (
              <EditBucket
                key={`${editing.source}-${editing.id}`}
                bucket={editing}
                data={data}
                action={action}
                onClose={() => setEditing(null)}
              />
            )}
          </>
        );
      }}
    </PageFrame>
  );
}

function AccountField({
  data, value, onChange,
}: {
  data: FinanceData;
  value: string;
  onChange: (value: string) => void;
}) {
  const accounts = data.accounts.filter(
    (account) =>
      account.is_active &&
      !account.is_liability &&
      (CASH_ACCOUNT_TYPES.includes(account.account_type) ||
        account.account_type === "taxable_brokerage" ||
        account.account_type === "brokerage"),
  );
  return (
    <Field label="Money lives in" full hint="This is what the breakdown above is built from.">
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Default savings account</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function EditBucket({
  bucket, data, action, onClose,
}: {
  bucket: Bucket;
  data: FinanceData;
  action: ReturnType<typeof useAction>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: bucket.name,
    target_amount: bucket.target.toFixed(2),
    current_amount: bucket.current.toFixed(2),
    user_monthly_target: bucket.monthlyTarget.toFixed(2),
    target_date: bucket.targetDate ?? "",
    linked_account_id: bucket.accountId ? String(bucket.accountId) : "",
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await action.run(async (current) => {
      const message =
        bucket.source === "goal"
          ? await updateGoal(current, bucket.id, {
              name: form.name,
              target_amount: form.target_amount,
              current_amount: form.current_amount,
              user_monthly_target: form.user_monthly_target,
              target_date: form.target_date,
              linked_account_id: form.linked_account_id,
            })
          : await updateSinkingFund(current, bucket.id, {
              name: form.name,
              target_amount: form.target_amount,
              current_amount: form.current_amount,
              due_date: form.target_date,
              linked_account_id: form.linked_account_id,
            });
      onClose();
      return message;
    });
  };

  return (
    <Modal open onClose={onClose} eyebrow={bucket.kindLabel} title={`Edit ${bucket.name}`}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name" full>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Target amount">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.target_amount}
              onChange={(event) => setForm({ ...form, target_amount: event.target.value })}
              required
            />
          </Field>
          <Field label="Currently in it">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.current_amount}
              onChange={(event) => setForm({ ...form, current_amount: event.target.value })}
            />
          </Field>
          {bucket.source === "goal" && (
            <Field label="Aim for per month" hint="Left at 0, the date decides the pace.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.user_monthly_target}
                onChange={(event) => setForm({ ...form, user_monthly_target: event.target.value })}
              />
            </Field>
          )}
          <Field label={bucket.source === "goal" ? "Target date" : "Due date"}>
            <input
              type="date"
              value={form.target_date}
              onChange={(event) => setForm({ ...form, target_date: event.target.value })}
            />
          </Field>
          <AccountField
            data={data}
            value={form.linked_account_id}
            onChange={(value) => setForm({ ...form, linked_account_id: value })}
          />
        </div>
        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={action.busy}>
            Save
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
