// Needs Review - the human approval queue. Ported from templates/needs_review.html.
//
// Nothing waiting here affects any total. That is the point of the queue: the
// uncertain rows are quarantined until a person decides.

import { Link } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import { Button, Card, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { parsePayload, resolveRecurringSuggestion } from "../lib/imports";
import { dec, fmtMoney } from "../lib/money";

export default function NeedsReview() {
  const action = useAction();

  return (
    <PageFrame title="Needs Review" message={action.message} error={action.error}>
      {(data) => {
        const rows = data.aiReviews
          .filter((row) => row.status === "needs_review")
          .sort((a, b) => a.id - b.id);
        const recurring = data.recurringSuggestions
          .filter((row) => row.status === "needs_review")
          .sort((a, b) => a.id - b.id);

        const resolve = (id: number, accept: boolean) =>
          action.run(async (current) => {
            const suggestion = current.recurringSuggestions.find((row) => row.id === id);
            if (!suggestion) throw new Error("Recurring suggestion not found.");
            await resolveRecurringSuggestion(current, suggestion, accept);
            return "Recurring-expense decision saved.";
          });

        return (
          <>
            <PageHead
              eyebrow="Human approval queue"
              title="Needs Review"
              subtitle="Uncertain financial data waits here until you make a decision. Nothing in this queue affects your totals."
              actions={
                <Link className="button" to="/finance/imports">
                  Import files
                </Link>
              }
            />

            <div className="grid two-even">
              <Card>
                <SectionHead
                  title="Transaction classifications"
                  caption={`${rows.length} unresolved row(s)`}
                />
                <div className="queue-list">
                  {rows.length === 0 ? (
                    <div className="empty">No transaction classifications need review.</div>
                  ) : (
                    rows.map((review) => {
                      const payload = parsePayload(review);
                      const confidence = Math.round(
                        dec(review.confidence ?? 0).times(100).toNumber(),
                      );
                      return (
                        <Link
                          className="queue-row"
                          key={review.id}
                          to={`/finance/imports/${review.ai_import_id}`}
                        >
                          <div>
                            <strong>{payload.merchant}</strong>
                            <span>
                              {payload.date} · Batch #{review.ai_import_id}
                            </span>
                          </div>
                          <div>
                            <strong>{fmtMoney(payload.amount)}</strong>
                            <span>{confidence}% confidence →</span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </Card>

              <Card>
                <SectionHead
                  title="Recurring-expense changes"
                  caption="Suggestions never modify settings without confirmation."
                />
                <div className="queue-list">
                  {recurring.length === 0 ? (
                    <div className="empty">No recurring-expense changes need confirmation.</div>
                  ) : (
                    recurring.map((item) => (
                      <div className="subscription-review" key={item.id}>
                        <div>
                          <Tag tone="gold">{item.suggestion_type.replace(/_/g, " ")}</Tag>
                          <h3>{item.merchant}</h3>
                          <p>{item.evidence}</p>
                          {item.previous_amount !== null && (
                            <span className="small-text muted">
                              {fmtMoney(item.previous_amount)} →{" "}
                              {item.amount === null ? "no charge" : fmtMoney(item.amount)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 7 }}>
                          <Button
                            variant="secondary"
                            small
                            disabled={action.busy}
                            onClick={() => void resolve(item.id, false)}
                          >
                            Dismiss
                          </Button>
                          <Button small disabled={action.busy} onClick={() => void resolve(item.id, true)}>
                            Confirm
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </>
        );
      }}
    </PageFrame>
  );
}
