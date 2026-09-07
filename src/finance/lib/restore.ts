// Restoring a full JSON export.
//
// This is the counterpart to fullExportJson, and it is what replaces the
// original's "restore a .db file" flow now that there is no local database file.
// The shape it reads is exactly what the export writes, so a backup taken from
// this app - or from the Python one, whose export used the same table names -
// can be loaded back.
//
// Order matters throughout: rows are deleted children-first and inserted
// parents-first, because the foreign keys between these tables are real. Ids
// are preserved rather than regenerated, since every reference between tables
// is by id; the identity sequences are resynced afterwards so the next natural
// insert does not collide with a restored row.

import { supabase } from "@/lib/supabase";
import { insertRows, T } from "./db";
import { EXPORT_VERSION } from "./exports";

export class RestoreError extends Error {}

/**
 * Tables in dependency order: a table only references ones above it.
 * Deletion walks this list backwards.
 */
const LOAD_ORDER: { table: string; key: string }[] = [
  { table: T.accounts, key: "accounts" },
  { table: T.categories, key: "transaction_categories" },
  { table: T.accountBalances, key: "account_balances" },
  { table: T.aiImports, key: "ai_imports" },
  { table: T.transactions, key: "transactions" },
  { table: T.transfers, key: "transfers" },
  { table: T.paychecks, key: "paychecks" },
  { table: T.paycheckDeductions, key: "paycheck_deductions" },
  { table: T.subscriptions, key: "subscriptions" },
  { table: T.recurringExpenses, key: "recurring_expenses" },
  { table: T.sinkingFunds, key: "sinking_funds" },
  { table: T.goals, key: "financial_goals" },
  { table: T.retirementContributions, key: "retirement_contributions" },
  { table: T.monthlySnapshots, key: "monthly_snapshots" },
  { table: T.investmentAccounts, key: "investment_accounts" },
  { table: T.securities, key: "securities" },
  { table: T.securityPrices, key: "security_prices" },
  { table: T.holdings, key: "investment_holdings" },
  { table: T.investmentSnapshots, key: "investment_snapshots" },
  { table: T.investmentTransactions, key: "investment_transactions" },
  { table: T.aiReviews, key: "ai_reviews" },
  { table: T.merchantRules, key: "merchant_rules" },
  { table: T.recurringSuggestions, key: "recurring_suggestions" },
  { table: T.aiInsights, key: "monthly_ai_insights" },
  { table: T.settings, key: "settings" },
  { table: T.setupProgress, key: "setup_progress" },
  { table: T.monthPlans, key: "month_plans" },
  { table: T.allocations, key: "paycheck_allocations" },
];

/** Columns the database owns; a restore must not carry them over. */
const STRIPPED = new Set(["owner"]);

function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (STRIPPED.has(key)) continue;
    result[key] = value;
  }
  return result;
}

export interface RestorePreview {
  version: string;
  createdAt: string | null;
  counts: { label: string; rows: number }[];
  total: number;
}

/** Validate an export and describe what restoring it would load. */
export function inspectBackup(content: string): { payload: Record<string, unknown[]>; preview: RestorePreview } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^﻿/, ""));
  } catch (error) {
    throw new RestoreError(
      `That file is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new RestoreError("That file is not a NexaFi backup.");
  }
  const root = parsed as Record<string, unknown>;
  const version = String(root.nexafi_export_version ?? "");
  if (!version) {
    throw new RestoreError("That file is not a NexaFi backup: no export version present.");
  }
  if (version !== EXPORT_VERSION) {
    throw new RestoreError(
      `This backup is export version ${version}; this app writes and reads version ${EXPORT_VERSION}.`,
    );
  }

  const tables = root.tables;
  if (!tables || typeof tables !== "object") {
    throw new RestoreError("That backup has no tables section.");
  }

  const payload: Record<string, unknown[]> = {};
  const counts: { label: string; rows: number }[] = [];
  let total = 0;

  for (const { key } of LOAD_ORDER) {
    const rows = (tables as Record<string, unknown>)[key];
    if (rows === undefined) {
      payload[key] = [];
      continue;
    }
    if (!Array.isArray(rows)) {
      throw new RestoreError(`Table "${key}" in the backup is not a list of rows.`);
    }
    payload[key] = rows;
    total += rows.length;
    if (rows.length > 0) counts.push({ label: key, rows: rows.length });
  }

  if (total === 0) {
    throw new RestoreError("That backup contains no rows.");
  }

  return {
    payload,
    preview: {
      version,
      createdAt: typeof root.created_at === "string" ? root.created_at : null,
      counts,
      total,
    },
  };
}

export interface RestoreResult {
  inserted: number;
  tables: number;
}

/**
 * Replace everything with the contents of a backup.
 *
 * This is destructive by design - it is a restore, not a merge - so callers must
 * confirm first. There is no client-side transaction available, so the delete
 * pass runs children-first and the insert pass parents-first; a failure partway
 * leaves the database loadable by the same backup again.
 */
export async function restoreFromBackup(content: string): Promise<RestoreResult> {
  const { payload } = inspectBackup(content);

  // Delete children before parents.
  for (const { table } of [...LOAD_ORDER].reverse()) {
    const result = await supabase.from(table).delete().gte("id", 0);
    if (result.error) {
      throw new RestoreError(`Could not clear ${table}: ${result.error.message}`);
    }
  }

  let inserted = 0;
  let tables = 0;
  for (const { table, key } of LOAD_ORDER) {
    const rows = (payload[key] ?? []).map((row) => cleanRow(row as Record<string, unknown>));
    if (rows.length === 0) continue;

    // Chunked so a large ledger does not exceed the request size limit.
    for (let index = 0; index < rows.length; index += 500) {
      await insertRows(table, rows.slice(index, index + 500));
    }
    inserted += rows.length;
    tables += 1;
  }

  // Identity sequences are still at their pre-restore position; move them past
  // the restored ids so the next insert does not collide.
  const resync = await supabase.rpc("fin_resync_sequences");
  if (resync.error) {
    throw new RestoreError(
      `Data restored, but the id sequences could not be resynced: ${resync.error.message}. ` +
        "Run select public.fin_resync_sequences(); in the Supabase SQL editor before adding new rows.",
    );
  }

  return { inserted, tables };
}

/** Wipe every finance table without loading anything in its place. */
export async function eraseAllData(): Promise<void> {
  // Children first, same as the restore's delete pass.
  for (const { table } of [...LOAD_ORDER].reverse()) {
    const result = await supabase.from(table).delete().gte("id", 0);
    if (result.error) {
      throw new RestoreError(`Could not clear ${table}: ${result.error.message}`);
    }
  }
}
