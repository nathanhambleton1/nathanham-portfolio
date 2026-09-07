// Data & Backup. Ported from templates/data_backup.html.
//
// THIS PAGE CHANGED THE MOST, because it was the most tied to there being a
// local SQLite file. What is gone, and why:
//
//   * Data-folder path and "Open Data Folder" — there is no file to point at,
//     and a browser cannot open a folder.
//   * Timestamped local .db backups and the automatic-backup schedule — there
//     is no local file to copy and no background process to copy it on a
//     schedule. Supabase takes its own managed backups of the database.
//   * The portable .zip export / .db restore — replaced by the full JSON export
//     and the JSON restore below, which serve the same purpose: one file you
//     hold that can rebuild everything.
//
// What that flow was FOR is intact: take a complete copy you control, and load
// it back. Every readable export is unchanged.

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import { Advisory, Button, Card, Field, PageHead, SectionHead, Tag } from "../components/ui";
import { useAction } from "../lib/actions";
import {
  accountsCsv, accountsJson, downloadCsv, downloadJson, financialSummaryJson,
  fullExportJson, goalsJson, paychecksCsv, paychecksJson, transactionsCsv,
} from "../lib/exports";
import { inspectBackup, restoreFromBackup, type RestorePreview } from "../lib/restore";
import { liquidCash, monthlyTotals, netWorth } from "../lib/finance";
import { fmtMoney } from "../lib/money";
import { OWNER_EMAIL } from "@/lib/ownerAuth";
import type { FinanceData } from "../lib/data";

interface ExportEntry {
  title: string;
  detail: string;
  badge: string;
  run: (data: FinanceData) => void;
}

const EXPORTS: ExportEntry[] = [
  {
    title: "Transactions",
    detail: "CSV ledger export",
    badge: "CSV",
    run: (data) => downloadCsv("transactions", transactionsCsv(data)),
  },
  {
    title: "Accounts",
    detail: "CSV; JSON is also available",
    badge: "CSV",
    run: (data) => downloadCsv("accounts", accountsCsv(data)),
  },
  {
    title: "Accounts",
    detail: "Names and masked identifiers",
    badge: "JSON",
    run: (data) => downloadJson("accounts", accountsJson(data)),
  },
  {
    title: "Goals",
    detail: "Targets, progress, and status",
    badge: "JSON",
    run: (data) => downloadJson("goals", goalsJson(data)),
  },
  {
    title: "Paychecks",
    detail: "CSV; JSON is also available",
    badge: "CSV",
    run: (data) => downloadCsv("paychecks", paychecksCsv(data)),
  },
  {
    title: "Paychecks",
    detail: "Gross, net, tax, and retirement",
    badge: "JSON",
    run: (data) => downloadJson("paychecks", paychecksJson(data)),
  },
  {
    title: "Financial summary",
    detail: "Current position and goal status",
    badge: "JSON",
    run: (data) => {
      const totals = monthlyTotals(data);
      downloadJson(
        "financial-summary",
        financialSummaryJson(data, {
          net_worth: fmtMoney(netWorth(data)),
          liquid_cash: fmtMoney(liquidCash(data)),
          monthly_income: fmtMoney(totals.income),
          monthly_spending: fmtMoney(totals.spending),
          monthly_surplus: fmtMoney(totals.surplus),
          savings_rate_percent: totals.savingsRate.toFixed(2),
        }),
      );
    },
  },
];

export default function DataBackup() {
  const action = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ content: string; preview: RestorePreview } | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  return (
    <PageFrame
      title="Data & Backup"
      message={action.message}
      error={action.error ?? inspectError}
    >
      {(data) => {
        const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
          setInspectError(null);
          setPending(null);
          const file = event.target.files?.[0];
          if (!file) return;
          const content = await file.text();
          try {
            const { preview } = inspectBackup(content);
            setPending({ content, preview });
          } catch (error) {
            setInspectError(error instanceof Error ? error.message : String(error));
          }
        };

        const runRestore = () => {
          if (!pending) return;
          const confirmed = window.confirm(
            `Restore will DELETE everything currently in your finance database and replace it with ` +
              `${pending.preview.total} row(s) from this backup. This cannot be undone. Continue?`,
          );
          if (!confirmed) return;

          void action.run(async () => {
            const result = await restoreFromBackup(pending.content);
            setPending(null);
            if (fileRef.current) fileRef.current.value = "";
            return `Restored ${result.inserted} row(s) across ${result.tables} table(s).`;
          });
        };

        return (
          <>
            <PageHead
              eyebrow="Your data"
              title="Data & Backup"
              subtitle="Keep recoverable copies of your history and take it with you."
              actions={
                <Button
                  variant="gold"
                  onClick={() => downloadJson("full-export", fullExportJson(data))}
                >
                  Back up now
                </Button>
              }
            />

            <div className="principle-banner">
              <div className="principle-icon">⌂</div>
              <div>
                <strong>Your finance data is private to your account</strong>
                <span>
                  Every row is scoped to {OWNER_EMAIL} and is unreadable without signing in. It
                  syncs across your devices, so there is no longer a file to carry between
                  computers.
                </span>
              </div>
              <Tag tone="gold">Owner-only</Tag>
            </div>

            <div className="grid two-even">
              <Card>
                <SectionHead
                  title="Where your data lives"
                  caption="What changed when this moved off your laptop"
                />
                <div className="path-box">
                  <small>DATABASE</small>
                  <code>Supabase Postgres · table prefix fin_</code>
                </div>
                <div className="path-box">
                  <small>ACCESS</small>
                  <code>Row-level security: owner = your account only</code>
                </div>
                <Advisory>
                  The local data folder, scheduled .db backups, and the portable .zip are gone —
                  there is no local database file any more. Supabase keeps its own managed backups;
                  the JSON export beside this is the copy <em>you</em> hold.
                </Advisory>
              </Card>

              <Card>
                <SectionHead
                  title="Complete backup"
                  caption="One file that can rebuild everything"
                />
                <p className="muted">
                  Every table, versioned, in readable JSON. This is what the restore below reads,
                  and it is the file to keep somewhere other than this machine.
                </p>
                <div className="button-row" style={{ marginTop: 18 }}>
                  <Button
                    variant="gold"
                    onClick={() => downloadJson("full-export", fullExportJson(data))}
                  >
                    Export full backup
                  </Button>
                </div>
                <p className="advisory" style={{ marginTop: 18 }}>
                  Exports contain sensitive financial data and are not encrypted. Store them
                  accordingly.
                </p>
              </Card>
            </div>

            <div className="grid two-even" style={{ marginTop: 18 }}>
              <Card>
                <SectionHead
                  title="Restore from backup"
                  caption="Replaces everything currently stored"
                />
                <Field label="NexaFi backup (.json)">
                  <input ref={fileRef} type="file" accept=".json,application/json" onChange={chooseFile} />
                </Field>

                {pending && (
                  <>
                    <div className="alert" style={{ marginTop: 14 }}>
                      <strong>
                        Backup v{pending.preview.version}
                        {pending.preview.createdAt
                          ? ` · created ${pending.preview.createdAt.slice(0, 10)}`
                          : ""}
                      </strong>
                      <div className="small-text" style={{ marginTop: 6 }}>
                        {pending.preview.total} row(s) across {pending.preview.counts.length}{" "}
                        table(s):{" "}
                        {pending.preview.counts
                          .map((entry) => `${entry.label} (${entry.rows})`)
                          .join(", ")}
                      </div>
                    </div>
                    <p className="advisory">
                      Restoring deletes everything currently in your finance database first. Export a
                      backup of the current state before you do this if there is any doubt.
                    </p>
                    <div className="form-actions">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setPending(null);
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={runRestore} disabled={action.busy}>
                        {action.busy ? "Restoring…" : "Validate & restore"}
                      </Button>
                    </div>
                  </>
                )}
              </Card>

              <Card>
                <SectionHead
                  title="Portable exports"
                  caption="Readable data without vendor lock-in"
                />
                <div className="export-list">
                  {EXPORTS.map((entry) => (
                    <button
                      type="button"
                      key={`${entry.title}-${entry.badge}`}
                      onClick={() => entry.run(data)}
                    >
                      <div>
                        <strong>{entry.title}</strong>
                        <span>{entry.detail}</span>
                      </div>
                      <span className="button secondary small">{entry.badge}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => downloadJson("full-export", fullExportJson(data))}>
                    <div>
                      <strong>Complete dataset</strong>
                      <span>Versioned JSON covering every table</span>
                    </div>
                    <span className="button secondary small">JSON</span>
                  </button>
                </div>
              </Card>
            </div>

            <section className="card card-pad settings-section" style={{ marginTop: 18 }}>
              <SectionHead
                title="Settings"
                caption="Assumptions, targets, and recurring obligations"
                aside={
                  <Link className="button secondary small" to="/finance/settings">
                    Open Settings
                  </Link>
                }
              />
            </section>
          </>
        );
      }}
    </PageFrame>
  );
}
