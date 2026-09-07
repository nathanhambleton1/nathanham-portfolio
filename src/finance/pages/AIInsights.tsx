// AI Insights - verified monthly commentary. Ported from templates/ai_insights.html.
//
// The order matters and is the whole point: metrics are frozen first, then
// commentary is written about them. Nothing a model returns can change a number.

import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import { Advisory, Button, Card, Field, FormActions, Metric, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import {
  insightMetrics, insightPayload, monthlyReviewPrompt, saveManualCommentary, saveMetricsSnapshot,
} from "../lib/ai";
import { fmtMonth, planMonthOf, todayISO } from "../lib/dates";
import { fmtMoney } from "../lib/money";

const COMMENTARY_SECTIONS: [key: keyof CommentaryShape, title: string][] = [
  ["wins", "Wins"],
  ["watch_items", "Watch items"],
  ["opportunities", "Opportunities"],
  ["unusual_activity", "Unusual activity"],
  ["recommended_actions", "Recommended actions"],
];

interface CommentaryShape {
  overall_assessment: string;
  wins: string[];
  watch_items: string[];
  opportunities: string[];
  unusual_activity: string[];
  recommended_actions: string[];
}

const PLACEHOLDER =
  '{"overall_assessment":"...","wins":[],"watch_items":[],"opportunities":[],"unusual_activity":[],"recommended_actions":[]}';

export default function AIInsights() {
  const action = useAction();
  const [params, setParams] = useSearchParams();
  const [monthInput, setMonthInput] = useState(todayISO().slice(0, 7));
  const [commentaryText, setCommentaryText] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const metricsRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const copy = async (label: string, text: string, fallback: HTMLTextAreaElement | null) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      fallback?.select();
    }
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <PageFrame title="AI Insights" message={action.message} error={action.error}>
      {(data) => {
        const insights = [...data.aiInsights].sort((a, b) =>
          a.snapshot_month < b.snapshot_month ? 1 : -1,
        );

        const requested = params.get("month");
        const selected =
          (requested ? insights.find((row) => row.snapshot_month.startsWith(requested)) : null) ??
          insights[0] ??
          null;

        const metrics = insightMetrics(selected);
        const commentary = insightPayload(selected) as CommentaryShape | null;

        // The month immediately before the selected one, for a side-by-side.
        const selectedIndex = selected ? insights.findIndex((row) => row.id === selected.id) : -1;
        const previous = selectedIndex >= 0 ? insights[selectedIndex + 1] ?? null : null;
        const previousCommentary = insightPayload(previous) as CommentaryShape | null;

        const prepare = async (event: React.FormEvent) => {
          event.preventDefault();
          await action.run(async (current) => {
            const month = planMonthOf(`${monthInput}-01`);
            await saveMetricsSnapshot(current, month);
            setParams({ month: monthInput });
            return `Verified metrics prepared for ${fmtMonth(month)}.`;
          });
        };

        const saveCommentary = async (event: React.FormEvent) => {
          event.preventDefault();
          if (!selected) return;
          await action.run(async (current) => {
            const live = current.aiInsights.find((row) => row.id === selected.id);
            if (!live) throw new Error("Review month not found.");
            await saveManualCommentary(current, live, commentaryText);
            setCommentaryText("");
            return "Commentary validated and saved to history.";
          });
        };

        const header = (
          <PageHead
            eyebrow="Verified monthly commentary"
            title="AI Insights"
            subtitle="The facts are calculated here first. A model may explain them, but it never replaces the deterministic engine."
            actions={
              <form className="inline-form" onSubmit={prepare}>
                <Field label="Review month">
                  <input
                    type="month"
                    value={monthInput}
                    onChange={(event) => setMonthInput(event.target.value)}
                    required
                  />
                </Field>
                <Button type="submit" disabled={action.busy}>
                  Prepare verified metrics
                </Button>
              </form>
            }
          />
        );

        if (!selected || !metrics) {
          return (
            <>
              {header}
              <article className="card coming-panel">
                <div>
                  <div className="coming-mark">✦</div>
                  <h2>Prepare your first monthly review</h2>
                  <p>
                    Select a month above. The verified metrics package is calculated and frozen
                    before any commentary is written about it.
                  </p>
                </div>
              </article>
            </>
          );
        }

        const metricsPretty = JSON.stringify(metrics, null, 2);
        const reviewPrompt = monthlyReviewPrompt(metrics);

        return (
          <>
            {header}

            <div className="insight-layout">
              <aside className="card card-pad insight-history">
                <h2>Review history</h2>
                <div className="history-list">
                  {insights.map((item) => (
                    <a
                      key={item.id}
                      href={`?month=${item.snapshot_month.slice(0, 7)}`}
                      className={item.id === selected.id ? "active" : ""}
                      onClick={(event) => {
                        event.preventDefault();
                        setParams({ month: item.snapshot_month.slice(0, 7) });
                      }}
                    >
                      <div>
                        <strong>{fmtMonth(item.snapshot_month)}</strong>
                        <span>{item.status.replace(/_/g, " ")}</span>
                      </div>
                      <span>→</span>
                    </a>
                  ))}
                </div>
              </aside>

              <div className="insight-main">
                <div className="grid metrics insight-metrics">
                  <Metric label="Income" value={fmtMoney(metrics.income)} />
                  <Metric label="Spending" value={fmtMoney(metrics.spending)} />
                  <Metric label="Savings rate" value={`${metrics.savings_rate_percent}%`} />
                  <Metric label="Retirement" value={fmtMoney(metrics.retirement_contributions)} />
                </div>

                {commentary && (
                  <Card className="commentary-card">
                    <SectionHead
                      title="Overall assessment"
                      aside={<Tag tone="green">{selected.source} review</Tag>}
                    />
                    <p className="eyebrow">{fmtMonth(selected.snapshot_month)}</p>
                    <p className="assessment">{commentary.overall_assessment}</p>

                    {previousCommentary && previous && (
                      <div className="prior-comparison">
                        <span>Previous · {fmtMonth(previous.snapshot_month)}</span>
                        <p>{previousCommentary.overall_assessment}</p>
                      </div>
                    )}

                    <div className="commentary-grid">
                      {COMMENTARY_SECTIONS.map(([key, title]) => {
                        const items = (commentary[key] as string[]) ?? [];
                        return (
                          <section key={key}>
                            <h3>{title}</h3>
                            <ul>
                              {items.length > 0 ? (
                                items.map((text, index) => <li key={index}>{text}</li>)
                              ) : (
                                <li className="muted">None noted.</li>
                              )}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </Card>
                )}

                <div className="grid two-even">
                  <Card>
                    <SectionHead
                      title="Verified facts"
                      caption="Calculated here, not by a model."
                      aside={
                        <Button
                          variant="secondary"
                          small
                          onClick={() => copy("metrics", metricsPretty, metricsRef.current)}
                        >
                          {copied === "metrics" ? "Copied" : "Copy JSON"}
                        </Button>
                      }
                    />
                    <textarea
                      ref={metricsRef}
                      className="code-area compact"
                      readOnly
                      value={metricsPretty}
                    />
                  </Card>

                  <Card>
                    <SectionHead
                      title="Commentary workflow"
                      caption="Copy the prompt into Claude or any capable model, then paste the JSON back."
                      aside={
                        <Button
                          variant="secondary"
                          small
                          onClick={() => copy("prompt", reviewPrompt, promptRef.current)}
                        >
                          {copied === "prompt" ? "Copied" : "Copy prompt"}
                        </Button>
                      }
                    />
                    <textarea
                      ref={promptRef}
                      className="code-area compact"
                      readOnly
                      value={reviewPrompt}
                    />
                    <Advisory>
                      One-click generation is not available here. This app is served publicly, so an
                      API key stored in it would be readable — and billable — by anyone. The paste-back
                      workflow validates against the same schema.
                    </Advisory>
                  </Card>
                </div>

                <Card className="" as="article">
                  <SectionHead
                    title="Save external commentary"
                    caption="Paste schema-valid JSON returned from the review prompt."
                  />
                  <form onSubmit={saveCommentary}>
                    <textarea
                      className="code-area compact"
                      placeholder={PLACEHOLDER}
                      value={commentaryText}
                      onChange={(event) => setCommentaryText(event.target.value)}
                      required
                    />
                    <FormActions>
                      <Button type="submit" disabled={action.busy}>
                        Validate &amp; save to history
                      </Button>
                    </FormActions>
                  </form>
                </Card>
              </div>
            </div>
          </>
        );
      }}
    </PageFrame>
  );
}
