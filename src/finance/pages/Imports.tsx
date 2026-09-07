// Import Center. Ported from templates/imports.html.
//
// The principle the page states is the one the code enforces: extraction is a
// proposal, and nothing reaches the ledger without an explicit commit.

import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import { Button, Card, Empty, Field, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import { stageImport } from "../lib/imports";
import { deleteImport } from "../lib/imports";
import { extractionPrompt, parseImportJson, schemaJson } from "../lib/importSchema";
import { downloadText } from "../lib/exports";
import { Decimal } from "../lib/money";
import type { AIImport } from "../lib/types";

/** Rows below this confidence are sent to review rather than trusted. */
const CONFIDENCE_THRESHOLD = new Decimal("0.85");

const WORKFLOW_STEPS = [
  ["Validate", "Schema, types, exact dates, and amounts"],
  ["Enrich", "Merchant rules, duplicates, transfers, recurrence"],
  ["Review", "Uncertain rows import with a best guess; fix them here if you want"],
  ["Approve", "One explicit final commit to the ledger"],
];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Imports() {
  const action = useAction();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [fileAccountId, setFileAccountId] = useState("");
  const [textAccountId, setTextAccountId] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = extractionPrompt();

  return (
    <PageFrame title="Import Center" message={action.message} error={action.error}>
      {(data) => {
        const accounts = data.accounts.filter((account) => account.is_active);
        const imports = [...data.aiImports].sort((a, b) => b.id - a.id);

        const stage = async (
          accountId: string,
          content: string,
          filename: string,
        ) => {
          await action.run(async (current) => {
            if (!/^\d+$/.test(accountId)) {
              throw new Error("Choose a destination account.");
            }
            const document = parseImportJson(content);
            const { importRow } = await stageImport(current, {
              document,
              originalContent: content,
              filename,
              sourceType: "json",
              accountId: Number(accountId),
              confidenceThreshold: CONFIDENCE_THRESHOLD,
            });
            navigate(`/finance/imports/${importRow.id}`);
            return "JSON passed the NexaFi schema and was staged.";
          });
        };

        const submitFile = async (event: React.FormEvent) => {
          event.preventDefault();
          const file = fileRef.current?.files?.[0];
          if (!file) return;
          const content = await file.text();
          await stage(fileAccountId, content, file.name);
          if (fileRef.current) fileRef.current.value = "";
        };

        const submitText = async (event: React.FormEvent) => {
          event.preventDefault();
          const text = jsonText.trim();
          if (!text) {
            await action.run(async () => {
              throw new Error("Paste NexaFi JSON before staging it.");
            });
            return;
          }
          await stage(textAccountId, text, "Pasted JSON");
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

        const copyPrompt = async () => {
          try {
            await navigator.clipboard.writeText(prompt);
          } catch {
            // Clipboard access can be refused; selecting the text is the fallback
            // that always works.
            promptRef.current?.select();
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
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
          <>
            <PageHead
              eyebrow="Financial documents"
              title="Import Center"
              subtitle="Bring in transactions without giving AI authority over your totals. Every file is validated, staged, reviewed, and explicitly approved."
              actions={
                <Link className="button secondary" to="/finance/imports/review">
                  Open Needs Review
                </Link>
              }
            />

            <div className="principle-banner">
              <div className="principle-icon">N</div>
              <div>
                <strong>AI interprets. This app calculates.</strong>
                <span>
                  Extracted amounts remain proposals until you approve them. Spending, income, and
                  goal metrics are computed from the committed ledger.
                </span>
              </div>
              <Tag tone="green">Your data only</Tag>
            </div>

            <div className="grid two-even import-grid">
              <article className="card card-pad import-method featured">
                <div className="method-head">
                  <span className="method-number">01</span>
                  <Tag>Schema v1.0</Tag>
                </div>
                <h2>NexaFi JSON</h2>
                <p>
                  Upload JSON produced by the external prompt or another trusted converter. Invalid
                  fields are rejected before the database is touched.
                </p>

                <form onSubmit={submitFile}>
                  <Field label="Destination account">
                    {accountSelect(fileAccountId, setFileAccountId)}
                  </Field>
                  <Field label="NexaFi JSON file">
                    <input ref={fileRef} type="file" accept=".json,application/json" required />
                  </Field>
                  <Button type="submit" disabled={action.busy}>
                    Validate &amp; stage JSON
                  </Button>
                </form>

                <div className="method-divider">
                  <span>or paste JSON text</span>
                </div>

                <form onSubmit={submitText}>
                  <Field label="Destination account">
                    {accountSelect(textAccountId, setTextAccountId)}
                  </Field>
                  <Field label="NexaFi JSON">
                    <textarea
                      className="code-area compact"
                      rows={8}
                      placeholder="Paste NexaFi JSON here"
                      value={jsonText}
                      onChange={(event) => setJsonText(event.target.value)}
                      required
                    />
                  </Field>
                  <Button type="submit" disabled={action.busy}>
                    Validate &amp; stage pasted JSON
                  </Button>
                </form>
              </article>

              <article className="card card-pad workflow-card">
                <p className="eyebrow">Approval path</p>
                <h2>Nothing lands silently</h2>
                <ol className="workflow-steps">
                  {WORKFLOW_STEPS.map(([title, detail], index) => (
                    <li key={title}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            </div>

            <article className="card card-pad prompt-card">
              <SectionHead
                title="External extraction prompt"
                caption="Copy this prompt, attach your statement in Claude or another capable model, then paste back only the returned JSON."
                aside={
                  <div className="button-row">
                    <Button
                      variant="secondary"
                      small
                      onClick={() =>
                        downloadText(
                          "nexafi-import-schema-v1.0.json",
                          schemaJson(),
                          "application/json",
                        )
                      }
                    >
                      Download schema
                    </Button>
                    <Button small onClick={copyPrompt}>
                      {copied ? "Copied" : "Copy prompt"}
                    </Button>
                  </div>
                }
              />
              <textarea ref={promptRef} className="code-area" readOnly value={prompt} />
            </article>

            <article className="card" style={{ marginTop: 18 }}>
              <div className="card-pad">
                <SectionHead
                  title="Recent imports"
                  caption="A complete audit trail of staged and committed files."
                />
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Transactions</th>
                      <th>Duplicates</th>
                      <th>Needs review</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {imports.length === 0 ? (
                      <Empty colSpan={7}>No import batches yet.</Empty>
                    ) : (
                      imports.map((item) => (
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
                          <td>{item.review_count}</td>
                          <td className="button-row">
                            <Link className="button secondary small" to={`/finance/imports/${item.id}`}>
                              Review
                            </Link>
                            <Button
                              variant="secondary"
                              small
                              disabled={action.busy}
                              onClick={() => removeBatch(item)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        );
      }}
    </PageFrame>
  );
}
