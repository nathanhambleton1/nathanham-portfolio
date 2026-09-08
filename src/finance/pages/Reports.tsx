// Reports — the historical layer.
//
// Everything else in the app is live. This page is where a month gets frozen
// into a snapshot, and where portable copies of the data come from.
//
// The restore control at the bottom used to live on its own Data & Backup page.
// It moved here rather than being deleted with that page: an export you cannot
// restore is not a backup, and the two belong within sight of each other.

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageFrame from "../components/PageFrame";
import { Button, Card, Empty, Field, Metric, PageHead, SectionHead, Tag } from "../components/ui";
import { CashChart, NetWorthChart } from "../components/charts";
import { useAction } from "../lib/actions";
import { snapshotPoints } from "../lib/advice";
import { liquidCash, monthlyTotals, netWorth } from "../lib/finance";
import { netWorthAttribution, saveMonthlySnapshot } from "../lib/reports";
import {
  downloadCsv, downloadJson, fullExportJson, transactionsCsv,
} from "../lib/exports";
import { inspectBackup, restoreFromBackup, type RestorePreview } from "../lib/restore";
import { dec, fmtMoney, fmtPercent } from "../lib/money";
import { fmtMonth, planMonthOf, todayISO } from "../lib/dates";
import { ACCOUNT_TYPE_LABELS } from "../lib/types";

export default function Reports() {
  const action = useAction();
  const [params] = useSearchParams();
  const printMode = params.get("print") === "1";

  // The original opened the print dialog automatically for ?print=1 so the
  // "Print report" button was one click, not two.
  useEffect(() => {
    if (!printMode) return;
    const timer = setTimeout(() => window.print(), 500);
    return () => clearTimeout(timer);
  }, [printMode]);

  return (
    <PageFrame title="Reports" message={action.message} error={action.error}>
      {(data) => {
        const totals = monthlyTotals(data);
        const points = snapshotPoints(data);
        const attribution = netWorthAttribution(data);
        const currentMonth = planMonthOf(todayISO());

        const snapshots = [...data.monthlySnapshots].sort((a, b) =>
          a.snapshot_month < b.snapshot_month ? 1 : -1,
        );

        const closeMonthSnapshot = () =>
          action.run(async (current) => {
            await saveMonthlySnapshot(current);
            return "Current month snapshot saved to reporting history.";
          });

        return (
          <>
            <PageHead
              eyebrow="Historical view"
              title="Reports"
              subtitle="Close the month into a stable reporting layer, understand what changed net worth, and keep portable copies of your data."
              actions={
                <span className="no-print button-row">
                  <Button variant="gold" onClick={closeMonthSnapshot} disabled={action.busy}>
                    Close current month
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()}>
                    Print report
                  </Button>
                </span>
              }
            />

            <section className="month-end-action no-print">
              <div>
                <p className="eyebrow">Month-end action</p>
                <h2>Review, snapshot, then back up</h2>
                <p>
                  Confirm balances and reviewed imports before saving. Re-closing the current month
                  safely updates its snapshot.
                </p>
              </div>
              <Button variant="gold" onClick={closeMonthSnapshot} disabled={action.busy}>
                Save {fmtMonth(currentMonth).split(" ")[0]} snapshot
              </Button>
            </section>

            <section className="grid metrics report-summary">
              <Metric label="Net worth" value={fmtMoney(netWorth(data))} note="Assets minus liabilities" />
              <Metric label="Liquid cash" value={fmtMoney(liquidCash(data))} note="Checking and savings" />
              <Metric
                label="Monthly surplus"
                value={
                  <span className={totals.surplus.greaterThanOrEqualTo(0) ? "income" : "danger"}>
                    {fmtMoney(totals.surplus)}
                  </span>
                }
                note="Income less spending"
              />
              <Metric
                label="Savings rate"
                value={fmtPercent(totals.savingsRate)}
                note="Current calendar month"
              />
            </section>

            <section className="grid two-even">
              <Card pad={false} className="chart-card">
                <SectionHead title="Net worth over time" caption="Assets minus liabilities" />
                <NetWorthChart points={points} />
              </Card>
              <Card pad={false} className="chart-card">
                <SectionHead title="Cash balances" caption="Checking and savings" />
                <CashChart points={points} />
              </Card>
            </section>

            <section className="grid two-even" style={{ marginTop: 18 }}>
              <article className="card">
                <div className="card-pad" style={{ paddingBottom: 5 }}>
                  <h2>Net-worth attribution</h2>
                  <div className="section-caption">
                    Change between each account&rsquo;s two latest balance snapshots
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Previous</th>
                        <th>Current</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attribution.length === 0 ? (
                        <Empty colSpan={4}>Add a second account balance to see attribution.</Empty>
                      ) : (
                        attribution.map((item) => (
                          <tr key={item.account.id}>
                            <td>
                              <strong>{item.account.name}</strong>
                              <div className="small-text muted">
                                {ACCOUNT_TYPE_LABELS[item.account.account_type]}
                              </div>
                            </td>
                            <td className="amount">{fmtMoney(item.previousBalance)}</td>
                            <td className="amount">{fmtMoney(item.currentBalance)}</td>
                            <td
                              className={`amount ${item.change.greaterThanOrEqualTo(0) ? "income" : "danger"}`}
                            >
                              {fmtMoney(item.change)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <Card className="no-print">
                <SectionHead
                  title="Export & backup"
                  caption="Portable copies you hold yourself"
                  aside={<Tag tone="green">Downloads</Tag>}
                />
                <div className="export-list">
                  <button type="button" onClick={() => downloadCsv("transactions", transactionsCsv(data))}>
                    <div>
                      <strong>Transaction CSV</strong>
                      <span>Ledger rows for spreadsheets and independent analysis</span>
                    </div>
                    <span className="button secondary small">Download</span>
                  </button>
                  <button type="button" onClick={() => downloadJson("full-export", fullExportJson(data))}>
                    <div>
                      <strong>Full JSON export</strong>
                      <span>
                        Every table — accounts, settings, goals, history, holdings, transactions.
                        This is the restorable copy; it replaces the old SQLite backup now that the
                        data lives in Postgres.
                      </span>
                    </div>
                    <span className="button secondary small">Back up</span>
                  </button>
                </div>
                <p className="advisory">
                  Store at least one backup somewhere other than this computer. Exports contain
                  sensitive financial data and are not encrypted.
                </p>

                <Restore action={action} />
              </Card>
            </section>

            <article className="card report-history" style={{ marginTop: 18 }}>
              <div className="card-pad" style={{ paddingBottom: 5 }}>
                <h2>Monthly history</h2>
                <div className="section-caption">Saved reporting snapshots</div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Net worth</th>
                      <th>Liquid cash</th>
                      <th>Income</th>
                      <th>Spending</th>
                      <th>Surplus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.length === 0 ? (
                      <Empty colSpan={6}>
                        No monthly snapshots yet. Close the current month to begin history.
                      </Empty>
                    ) : (
                      snapshots.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{fmtMonth(item.snapshot_month)}</strong>
                          </td>
                          <td className="amount">{fmtMoney(item.net_worth)}</td>
                          <td className="amount">{fmtMoney(item.liquid_cash)}</td>
                          <td className="amount income">{fmtMoney(item.income)}</td>
                          <td className="amount">{fmtMoney(item.spending)}</td>
                          <td className="amount">
                            {fmtMoney(dec(item.income).minus(item.spending))}
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


/**
 * Read a NexaFi JSON backup, show what is in it, and put it back.
 *
 * Deliberately two steps. Restoring wipes the database first, so the file is
 * validated and its contents counted before anything is offered — a mistyped
 * file name should fail on this side of the delete, not the other.
 */
function Restore({ action }: { action: ReturnType<typeof useAction> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ content: string; preview: RestorePreview } | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

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

  const clear = () => {
    setPending(null);
    if (fileRef.current) fileRef.current.value = "";
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
      clear();
      return `Restored ${result.inserted} row(s) across ${result.tables} table(s).`;
    });
  };

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #ecece8" }}>
      <SectionHead title="Restore from a backup" caption="Replaces everything currently stored" />
      <Field label="NexaFi backup (.json)">
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={chooseFile} />
      </Field>

      {inspectError && <div className="alert error">{inspectError}</div>}

      {pending && (
        <>
          <div className="alert" style={{ marginTop: 14 }}>
            <strong>
              Backup v{pending.preview.version}
              {pending.preview.createdAt ? ` · created ${pending.preview.createdAt.slice(0, 10)}` : ""}
            </strong>
            <div className="small-text" style={{ marginTop: 6 }}>
              {pending.preview.total} row(s) across {pending.preview.counts.length} table(s):{" "}
              {pending.preview.counts.map((entry) => `${entry.label} (${entry.rows})`).join(", ")}
            </div>
          </div>
          <p className="advisory">
            Restoring deletes everything currently in your finance database first. Download a backup
            of the current state above if there is any doubt.
          </p>
          <div className="form-actions">
            <Button variant="secondary" onClick={clear}>
              Cancel
            </Button>
            <Button onClick={runRestore} loading={action.busy}>
              Validate &amp; restore
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
