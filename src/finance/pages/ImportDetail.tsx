// One staged batch and its review queue. Ported from templates/import_detail.html.

import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import { Button, Field, Metric, PageHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { commitImport, deleteImport, parsePayload, updateReview } from "../lib/imports";
import type { StagedPayload } from "../lib/imports";
import { dec, fmtMoney } from "../lib/money";
import type { AIReview } from "../lib/types";

/** Statuses whose row is settled and no longer editable. */
const SETTLED = ["duplicate", "imported", "rejected"];

interface Draft {
  merchant: string;
  category_id: string;
  subcategory_id: string;
  is_transfer: boolean;
  is_recurring: boolean;
}

function draftOf(payload: StagedPayload): Draft {
  return {
    merchant: payload.merchant ?? "",
    category_id: payload.category_id ? String(payload.category_id) : "",
    subcategory_id: payload.subcategory_id ? String(payload.subcategory_id) : "",
    is_transfer: Boolean(payload.is_transfer),
    is_recurring: Boolean(payload.is_recurring),
  };
}

export default function ImportDetail() {
  const { importId } = useParams();
  const action = useAction();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  return (
    <PageFrame title="Import Center" message={action.message} error={action.error}>
      {(data) => {
        const batch = data.aiImports.find((row) => String(row.id) === importId);
        if (!batch) {
          return (
            <>
              <PageHead eyebrow="Import" title="Batch not found" />
              <div className="alert error">That import batch no longer exists.</div>
              <Link className="button secondary" to="/finance/imports">
                Back to Import Center
              </Link>
            </>
          );
        }

        const reviews = data.aiReviews
          .filter((row) => row.ai_import_id === batch.id)
          .sort((a, b) => a.id - b.id);
        const parents = data.categories.filter((row) => row.parent_id === null && row.is_active);
        const children = data.categories.filter((row) => row.parent_id !== null && row.is_active);

        const importable = reviews.filter((row) => ["ready", "accepted"].includes(row.status)).length;
        const unresolved = reviews.filter((row) => row.status === "needs_review").length;

        const saveReview = (review: AIReview, draft: Draft, act: "accept" | "reject") =>
          action.run(async (current) => {
            const live = current.aiReviews.find((row) => row.id === review.id);
            if (!live) throw new Error("Review row not found.");
            await updateReview(current, live, {
              action: act,
              merchant: draft.merchant.trim() || null,
              categoryId: /^\d+$/.test(draft.category_id) ? Number(draft.category_id) : null,
              subcategoryId: /^\d+$/.test(draft.subcategory_id) ? Number(draft.subcategory_id) : null,
              isTransfer: draft.is_transfer,
              isRecurring: draft.is_recurring,
            });
            return "Review decision saved.";
          });

        const approve = () =>
          action.run(async (current) => {
            const live = current.aiImports.find((row) => row.id === batch.id);
            if (!live) throw new Error("Import not found.");
            const { created, skipped, autoAccepted } = await commitImport(current, live);

            let message = `Import approved: ${created} transaction(s) added.`;
            if (autoAccepted > 0) {
              message += ` ${autoAccepted} of those were uncertain and imported using their best guess.`;
            }
            if (skipped > 0) {
              message += ` ${skipped} row(s) were skipped as duplicates already in the ledger.`;
            }
            navigate("/finance/transactions");
            return message;
          });

        const removeBatch = () => {
          const confirmed = window.confirm(
            batch.status === "committed"
              ? "Delete this batch and remove the transactions it added to your ledger? This cannot be undone."
              : "Delete this import batch? This cannot be undone.",
          );
          if (!confirmed) return;
          void action.run(async (current) => {
            const live = current.aiImports.find((row) => row.id === batch.id);
            if (!live) throw new Error("Import not found.");
            const removed = await deleteImport(current, live);
            navigate("/finance/imports");
            return removed > 0
              ? `Import batch deleted. ${removed} transaction(s) it added were removed from the ledger.`
              : "Import batch deleted.";
          });
        };

        return (
          <>
            <PageHead
              eyebrow={`Batch #${batch.id} · ${batch.source_type}`}
              title={batch.source_name}
              subtitle="Review the staged proposal if you want to. Duplicate and rejected rows will not be committed; uncertain rows import with their best guess unless you fix them here."
              actions={
                <>
                  <Link className="button secondary" to="/finance/imports">
                    Back to Import Center
                  </Link>
                  <Button variant="secondary" onClick={removeBatch} disabled={action.busy}>
                    Delete batch
                  </Button>
                </>
              }
            />

            <div className="grid metrics import-metrics">
              <Metric label="Staged rows" value={batch.transaction_count} note="Validated schema" />
              <Metric
                label="Ready to import"
                value={importable}
                note="Pending final approval"
                notePositive
              />
              <Metric
                label="Unsure"
                value={unresolved}
                note={unresolved > 0 ? "Will import with best guess" : "All clear"}
                notePositive={unresolved === 0}
              />
              <Metric
                label="Duplicates blocked"
                value={batch.duplicate_count}
                note="Will not reach ledger"
              />
            </div>

            <div className="review-list">
              {reviews.length === 0 ? (
                <article className="card empty">This batch has no staged transactions.</article>
              ) : (
                reviews.map((review) => {
                  const payload = parsePayload(review);
                  const draft = drafts[review.id] ?? draftOf(payload);
                  const setDraft = (patch: Partial<Draft>) =>
                    setDrafts((current) => ({ ...current, [review.id]: { ...draft, ...patch } }));

                  const confidence = Math.round(dec(review.confidence ?? 0).times(100).toNumber());
                  const editable = !SETTLED.includes(review.status);

                  return (
                    <details
                      key={review.id}
                      className="card review-card"
                      open={review.status === "needs_review"}
                    >
                      <summary>
                        <div className="review-date">
                          <span>
                            {payload.date ? `${payload.date.slice(5, 7)}/${payload.date.slice(8, 10)}` : "—"}
                          </span>
                          <small>{payload.date ? payload.date.slice(0, 4) : ""}</small>
                        </div>
                        <div className="review-main">
                          <strong>{payload.merchant || payload.raw_description}</strong>
                          <span>{payload.raw_description}</span>
                        </div>
                        <div className="review-category">
                          {payload.category || "Uncategorized"}
                          <small>{payload.subcategory || "No subcategory"}</small>
                        </div>
                        <div className="review-confidence">
                          <strong>{confidence}%</strong>
                          <small>confidence</small>
                        </div>
                        <div className="amount">{fmtMoney(payload.amount)}</div>
                        <Tag
                          tone={
                            review.status === "needs_review"
                              ? "gold"
                              : ["ready", "accepted", "imported"].includes(review.status)
                                ? "green"
                                : undefined
                          }
                        >
                          {review.status.replace(/_/g, " ")}
                        </Tag>
                      </summary>

                      <div className="review-body">
                        {review.reason && <div className="alert review-reason">{review.reason}</div>}

                        {editable ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void saveReview(review, draft, "accept");
                            }}
                          >
                            <div className="form-grid three">
                              <Field label="Merchant">
                                <input
                                  maxLength={180}
                                  value={draft.merchant}
                                  onChange={(event) => setDraft({ merchant: event.target.value })}
                                  required
                                />
                              </Field>
                              <Field label="Top-level category">
                                <select
                                  value={draft.category_id}
                                  onChange={(event) =>
                                    // Changing the parent invalidates any child
                                    // chosen under the previous one.
                                    setDraft({ category_id: event.target.value, subcategory_id: "" })
                                  }
                                >
                                  <option value="">Uncategorized</option>
                                  {parents.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </Field>
                              <Field label="Subcategory">
                                <select
                                  value={draft.subcategory_id}
                                  onChange={(event) => setDraft({ subcategory_id: event.target.value })}
                                >
                                  <option value="">None</option>
                                  {children
                                    .filter(
                                      (category) =>
                                        !draft.category_id ||
                                        String(category.parent_id) === draft.category_id,
                                    )
                                    .map((category) => (
                                      <option key={category.id} value={category.id}>
                                        {category.name}
                                      </option>
                                    ))}
                                </select>
                              </Field>
                            </div>

                            <div className="review-options">
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  checked={draft.is_transfer}
                                  onChange={(event) => setDraft({ is_transfer: event.target.checked })}
                                />
                                Mark as transfer / card payment
                              </label>
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  checked={draft.is_recurring}
                                  onChange={(event) => setDraft({ is_recurring: event.target.checked })}
                                />
                                Mark recurring
                              </label>
                              <span className="muted small-text">
                                Source ID: {payload.transaction_id || "not provided"}
                              </span>
                            </div>

                            <div className="form-actions">
                              <Button
                                variant="secondary"
                                disabled={action.busy}
                                onClick={() => void saveReview(review, draft, "reject")}
                              >
                                Reject transaction
                              </Button>
                              <Button type="submit" disabled={action.busy}>
                                Accept changes
                              </Button>
                            </div>
                          </form>
                        ) : review.status === "duplicate" ? (
                          <p className="muted">
                            Matched existing transaction #{review.duplicate_transaction_id}. This row
                            is safely excluded.
                          </p>
                        ) : review.status === "rejected" ? (
                          <p className="muted">You rejected this row. It will not be imported.</p>
                        ) : (
                          <p className="muted">This row is already in your ledger.</p>
                        )}
                      </div>
                    </details>
                  );
                })
              )}
            </div>

            <div className="commit-bar">
              <div>
                <strong>Final ledger approval</strong>
                <span>
                  {importable} row(s) ready
                  {unresolved > 0
                    ? `, plus ${unresolved} unsure row(s) that will import with their best guess`
                    : ""}
                  .
                </span>
              </div>
              <Button
                variant="gold"
                onClick={approve}
                disabled={action.busy || batch.status === "committed"}
              >
                {batch.status === "committed" ? "Already committed" : "Approve & commit import"}
              </Button>
            </div>
          </>
        );
      }}
    </PageFrame>
  );
}
