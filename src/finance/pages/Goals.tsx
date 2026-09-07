// Financial goals - virtual buckets. Ported from templates/goals.html.
//
// A goal earmarks money already sitting in a savings account. It never creates
// or moves cash on its own; the money-flow engine is what actually transfers.

import { useState } from "react";
import PageFrame from "../components/PageFrame";
import { Button, Card, Field, FormActions, PageHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { goalProgress } from "../lib/finance";
import { goalForecast } from "../lib/planning";
import { updateGoal } from "../lib/mutations";
import { dec, fmtMoney, fmtPercent } from "../lib/money";
import { fmtMonthShort } from "../lib/dates";
import { GOAL_TYPE_LABELS } from "../lib/types";
import type { FinancialGoal } from "../lib/types";

interface Draft {
  target_amount: string;
  current_amount: string;
  user_monthly_target: string;
  target_date: string;
}

function draftOf(goal: FinancialGoal): Draft {
  return {
    target_amount: String(goal.target_amount),
    current_amount: String(goal.current_amount),
    user_monthly_target: String(goal.user_monthly_target),
    target_date: goal.target_date ?? "",
  };
}

export default function Goals() {
  const action = useAction();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  return (
    <PageFrame title="Goals" message={action.message} error={action.error}>
      {(data) => {
        const goals = [...data.goals].sort((a, b) => a.id - b.id);
        const settings = data.settings;

        return (
          <>
            <PageHead
              eyebrow="Virtual savings buckets"
              title="Financial goals"
              subtitle="Goals earmark money held in a physical savings account. They do not create or move cash."
            />

            <section className="goal-grid">
              {goals.map((goal) => {
                const draft = drafts[goal.id] ?? draftOf(goal);
                const percent = goalProgress(goal);

                // Growth-oriented goals compound at the expected market return;
                // cash goals only earn the savings APY.
                const annualReturn =
                  goal.goal_type === "retirement" || goal.goal_type === "taxable"
                    ? dec(settings.expected_return_percent ?? "0")
                    : dec(settings.savings_apy ?? "0");

                const forecast = goalForecast({
                  currentAmount: dec(goal.current_amount),
                  targetAmount: dec(goal.target_amount),
                  monthlyContribution: dec(goal.user_monthly_target),
                  annualReturnPercent: annualReturn,
                  targetDate: goal.target_date,
                });

                const setDraft = (patch: Partial<Draft>) =>
                  setDrafts((current) => ({
                    ...current,
                    [goal.id]: { ...draft, ...patch },
                  }));

                return (
                  <Card key={goal.id} pad={false} className="goal-card">
                    <div className="account-head">
                      <div>
                        <div className="account-type">
                          {GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type}
                        </div>
                        <h2>{goal.name}</h2>
                      </div>
                      <Tag tone={percent.greaterThanOrEqualTo(100) ? "green" : "gold"}>
                        {fmtPercent(percent)}
                      </Tag>
                    </div>

                    <div className="goal-amount">{fmtMoney(goal.current_amount)}</div>
                    <div className="goal-target">of {fmtMoney(goal.target_amount)} target</div>
                    <div className="progress-track" style={{ marginTop: 12 }}>
                      <div className="progress-fill" style={{ width: `${percent.toNumber()}%` }} />
                    </div>

                    <div className="forecast-strip">
                      <div>
                        <small>Forecast</small>
                        <strong>
                          {forecast.projectedDate
                            ? fmtMonthShort(forecast.projectedDate)
                            : "Needs a contribution"}
                        </strong>
                      </div>
                      <div>
                        <small>Est. growth</small>
                        <strong>{fmtMoney(forecast.growth)}</strong>
                      </div>
                      {forecast.onTrack !== null && (
                        <Tag tone={forecast.onTrack ? "green" : "gold"}>
                          {forecast.onTrack ? "On track" : "Behind date"}
                        </Tag>
                      )}
                    </div>

                    <div className="target-comparison">
                      <div className="target-box">
                        <small>Recommended</small>
                        <strong>{fmtMoney(goal.recommended_monthly)}/mo</strong>
                      </div>
                      <div className="target-box">
                        <small>Your target</small>
                        <strong>{fmtMoney(goal.user_monthly_target)}/mo</strong>
                      </div>
                    </div>

                    <form
                      onSubmit={async (event) => {
                        event.preventDefault();
                        await action.run((current) => updateGoal(current, goal.id, draft));
                      }}
                    >
                      <div className="form-grid">
                        <Field label="Target">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={draft.target_amount}
                            onChange={(event) => setDraft({ target_amount: event.target.value })}
                          />
                        </Field>
                        <Field label="Current bucket">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.current_amount}
                            onChange={(event) => setDraft({ current_amount: event.target.value })}
                          />
                        </Field>
                        <Field label="Your monthly target">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.user_monthly_target}
                            onChange={(event) => setDraft({ user_monthly_target: event.target.value })}
                          />
                        </Field>
                        <Field label="Target date">
                          <input
                            type="date"
                            value={draft.target_date}
                            onChange={(event) => setDraft({ target_date: event.target.value })}
                          />
                        </Field>
                      </div>
                      <FormActions>
                        <Button variant="secondary" small type="submit" disabled={action.busy}>
                          Update goal
                        </Button>
                      </FormActions>
                    </form>
                  </Card>
                );
              })}

              {goals.length === 0 && <p className="empty">No goals configured yet.</p>}
            </section>
          </>
        );
      }}
    </PageFrame>
  );
}
