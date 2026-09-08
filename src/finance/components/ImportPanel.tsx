// The import step of the Money Flow wizard.
//
// Import only ever happens once a month, right here, on the way through
// closing it out — so there is no separate Import Center to navigate to.
// Staging, reviewing, and committing a batch all happen inline.

import { useState } from "react";
import { Button, Card, Field, SectionHead, Tag } from "./ui";
import { useAction } from "../lib/actions";
import {
  commitImport, deleteImport, parsePayload, stageImport, updateReview,
} from "../lib/imports";
import type { StagedPayload } from "../lib/imports";
import { extractionPrompt, parseImportJson } from "../lib/importSchema";
import { Decimal, dec, fmtMoney } from "../lib/money";
import type { AIImport, AIReview } from "../lib/types";
import type { FinanceData } from "../lib/data";

/** Rows below this confidence are sent to review rather than trusted. */
const CONFIDENCE_THRESHOLD = new Decimal("0.85");

/** Statuses whose row is settled and no longer editable. */
const SETTLED = ["duplicate", "imported", "rejected"];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

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

export default function ImportPanel({
  data, action,
}: {
  data: FinanceData;
  action: ReturnType<typeof useAction>;
}) {
  const accounts = data.accounts.filter((account) => account.is_active);
  const defaultAccount = accounts.find((account) => account.account_type === "credit_card");

  const [textAccountId, setTextAccountId] = useState(defaultAccount ? String(defaultAccount.id) : "");
  const [jsonText, setJsonText] = useState("");
  const [copied, setCopied] = useState(false);
  const [stagingText, setStagingText] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const imports = [...data.aiImports].sort((a, b) => b.id - a.id);
  const staged = imports.filter((row) => row.status !== "committed");
  const committed = imports.filter((row) => row.status === "committed");

  const submitText = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = jsonText.trim();
    if (!text) {
      await action.run(async () => {
        throw new Error("Paste NexaFi JSON before staging it.");
      });
      return;
    }
    setStagingText(true);
    try {
      await action.run(async (current) => {
        if (!/^\d+$/.test(textAccountId)) throw new Error("Choose a destination account.");
        const document = parseImportJson(text);
        await stageImport(current, {
          document,
          originalContent: text,
          filename: "Pasted JSON",
          sourceType: "json",
          accountId: Number(textAccountId),
          confidenceThreshold: CONFIDENCE_THRESHOLD,
        });
        return "Added below for review.";
      });
      setJsonText("");
    } finally {
      setStagingText(false);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(extractionPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; there is nothing else to fall back to
      // without showing the prompt text on screen.
    }
  };

  const removeBatch = (batch: AIImport) => {
    const confirmed = window.confirm(
      batch.status === "committed"
        ? "Delete this batch and remove the transactions it added to your ledger? This cannot be undone."
        : "Delete this import batch? This cannot be undone.",
    );
    if (!confirmed) return;
    void action.run(async (current) => {
      const removed = await deleteImport(current, batch);
      return removed > 0
        ? `Import batch deleted. ${removed} transaction(s) it added were removed from the ledger.`
        : "Import batch deleted.";
    });
  };

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

  const approve = async (batch: AIImport) => {
    setApprovingId(batch.id);
    try {
      await action.run(async (current) => {
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
        return message;
      });
    } finally {
      setApprovingId(null);
    }
  };

  const accountSelect = (value: string, onChange: (value: string) => void) => (
    <select value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="">Choose account</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="import-panel">
      <article className="card card-pad import-method">
        <SectionHead
          title="Paste this month's transactions"
          caption="Copy the prompt, run your statement through Claude, then paste back only the JSON it returns"
          aside={
            <Button variant="secondary" small onClick={copyPrompt}>
              {copied ? "Copied" : "Copy prompt"}
            </Button>
          }
        />

        <form onSubmit={submitText}>
          <Field label="Destination account">{accountSelect(textAccountId, setTextAccountId)}</Field>
          <Field label="NexaFi JSON">
            <textarea
              rows={6}
              placeholder="Paste NexaFi JSON here"
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" disabled={action.busy} loading={stagingText}>
            Add to review queue
          </Button>
        </form>
        <p className="small-text muted" style={{ marginTop: 4 }}>
          This only stages the transactions below for review — press Continue once you're done.
        </p>
      </article>

      {staged.map((batch) => {
        const reviews = data.aiReviews
          .filter((row) => row.ai_import_id === batch.id)
          .sort((a, b) => a.id - b.id);
        const importable = reviews.filter((row) => ["ready", "accepted"].includes(row.status)).length;
        const unresolved = reviews.filter((row) => row.status === "needs_review").length;
        const parents = data.categories.filter((row) => row.parent_id === null && row.is_active);
        const children = data.categories.filter((row) => row.parent_id !== null && row.is_active);

        return (
          <Card key={batch.id} className="import-batch">
            <SectionHead
              title={batch.source_name}
              caption={`Batch #${batch.id} · ${batch.source_type} · ${batch.transaction_count} row(s), ${batch.duplicate_count} duplicate(s)`}
              aside={
                <Button variant="secondary" small disabled={action.busy} onClick={() => removeBatch(batch)}>
                  Delete batch
                </Button>
              }
            />

            <div className="review-list">
              {reviews.length === 0 ? (
                <p className="empty">This batch has no staged transactions.</p>
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
                            Matched existing transaction #{review.duplicate_transaction_id}. This row is
                            safely excluded.
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
                onClick={() => approve(batch)}
                disabled={action.busy}
                loading={approvingId === batch.id}
              >
                Approve &amp; commit import
              </Button>
            </div>
          </Card>
        );
      })}

      {committed.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary className="small-text muted">Previously imported ({committed.length})</summary>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Transactions</th>
                  <th>Duplicates</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {committed.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>#{item.id}</strong>
                      <div className="muted small-text">{item.source_name}</div>
                    </td>
                    <td>
                      <Tag>{item.source_type}</Tag>
                    </td>
                    <td>
                      <span className={`status-dot ${item.status}`} />
                      {statusLabel(item.status)}
                    </td>
                    <td>{item.transaction_count}</td>
                    <td>{item.duplicate_count}</td>
                    <td>
                      <Button variant="secondary" small disabled={action.busy} onClick={() => removeBatch(item)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
