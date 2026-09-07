// Sinking funds - planned irregular costs. Ported from templates/sinking_funds.html.
//
// A sinking fund reserves savings for an annual or irregular expense so the
// month it finally lands does not read as a spending spike.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Button, Card, Field, FormActions, Modal, PageHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { goalProgress, requiredSinkingContribution } from "../lib/finance";
import { createSinkingFund, updateSinkingFund } from "../lib/mutations";
import { fmtMoney, fmtPercent } from "../lib/money";
import { fmtMonthShort, todayISO } from "../lib/dates";
import type { SinkingFund } from "../lib/types";

interface Draft {
  target_amount: string;
  current_amount: string;
  due_date: string;
}

const BLANK_NEW = { name: "", target_amount: "", current_amount: "0", due_date: "" };

function draftOf(fund: SinkingFund): Draft {
  return {
    target_amount: String(fund.target_amount),
    current_amount: String(fund.current_amount),
    due_date: fund.due_date ?? "",
  };
}

export default function SinkingFunds() {
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [newFund, setNewFund] = useState(BLANK_NEW);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  return (
    <PageFrame title="Sinking Funds" message={action.message} error={action.error}>
      {(data) => {
        const funds = [...data.sinkingFunds].sort((a, b) => a.id - b.id);
        const today = todayISO();

        const submitNew = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            const message = await createSinkingFund(current, newFund);
            setAdding(false);
            setNewFund(BLANK_NEW);
            return message;
          });
        };

        return (
          <>
            <PageHead
              eyebrow="Planned irregular costs"
              title="Sinking funds"
              subtitle="Earmark savings for annual and irregular expenses without misclassifying the reserve as monthly spending."
              actions={<Button onClick={() => setAdding(true)}>+ Add fund</Button>}
            />

            <section className="goal-grid">
              {funds.map((fund) => {
                const draft = drafts[fund.id] ?? draftOf(fund);
                const percent = goalProgress(fund);
                const monthly = requiredSinkingContribution(
                  fund.target_amount,
                  fund.current_amount,
                  fund.due_date,
                  today,
                );

                const setDraft = (patch: Partial<Draft>) =>
                  setDrafts((current) => ({ ...current, [fund.id]: { ...draft, ...patch } }));

                return (
                  <Card key={fund.id} pad={false} className="goal-card">
                    <div className="account-head">
                      <div>
                        <div className="account-type">Earmarked savings</div>
                        <h2>{fund.name}</h2>
                      </div>
                      <Tag tone={percent.greaterThanOrEqualTo(100) ? "green" : "gold"}>
                        {fmtPercent(percent)}
                      </Tag>
                    </div>

                    <div className="goal-amount">{fmtMoney(fund.current_amount)}</div>
                    <div className="goal-target">
                      of {fmtMoney(fund.target_amount)} needed
                      {fund.due_date ? ` by ${fmtMonthShort(fund.due_date)}` : ""}
                    </div>
                    <div className="progress-track" style={{ marginTop: 12 }}>
                      <div className="progress-fill" style={{ width: `${percent.toNumber()}%` }} />
                    </div>

                    <div className="target-comparison">
                      <div className="target-box">
                        <small>Required monthly</small>
                        <strong>{fmtMoney(monthly)}</strong>
                      </div>
                      <div className="target-box">
                        <small>Asset status</small>
                        <strong>Stays in savings</strong>
                      </div>
                    </div>

                    <form
                      onSubmit={async (event) => {
                        event.preventDefault();
                        await action.run((current) => updateSinkingFund(current, fund.id, draft));
                      }}
                    >
                      <div className="form-grid">
                        <Field label="Required amount">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={draft.target_amount}
                            onChange={(event) => setDraft({ target_amount: event.target.value })}
                          />
                        </Field>
                        <Field label="Current fund balance">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.current_amount}
                            onChange={(event) => setDraft({ current_amount: event.target.value })}
                          />
                        </Field>
                        <Field label="Due date" full>
                          <input
                            type="date"
                            value={draft.due_date}
                            onChange={(event) => setDraft({ due_date: event.target.value })}
                          />
                        </Field>
                      </div>
                      <FormActions>
                        <Button variant="secondary" small type="submit" disabled={action.busy}>
                          Update fund
                        </Button>
                      </FormActions>
                    </form>
                  </Card>
                );
              })}

              {funds.length === 0 && <p className="empty">No sinking funds yet.</p>}
            </section>

            <Modal
              open={adding}
              onClose={() => setAdding(false)}
              eyebrow="Savings reserve"
              title="Add sinking fund"
            >
              <form onSubmit={submitNew}>
                <div className="form-grid">
                  <Field label="Name" full>
                    <input
                      value={newFund.name}
                      onChange={(event) => setNewFund({ ...newFund, name: event.target.value })}
                      required
                    />
                  </Field>
                  <Field label="Required amount">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newFund.target_amount}
                      onChange={(event) =>
                        setNewFund({ ...newFund, target_amount: event.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field label="Current fund balance">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newFund.current_amount}
                      onChange={(event) =>
                        setNewFund({ ...newFund, current_amount: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Due date (optional)" full>
                    <input
                      type="date"
                      value={newFund.due_date}
                      onChange={(event) => setNewFund({ ...newFund, due_date: event.target.value })}
                    />
                  </Field>
                </div>
                <FormActions>
                  <Button variant="secondary" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={action.busy}>
                    Add fund
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
