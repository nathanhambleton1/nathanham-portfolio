// Staged imports and their review queue - a port of nexafi/services/imports.py.
//
// Nothing an import contains reaches the ledger until it is committed. Staging
// writes one AIReview row per extracted transaction, each already classified as
// ready / needs_review / duplicate, so review is a matter of confirming
// decisions rather than re-doing them.

import { Decimal, ZERO, dec, money, toNumeric } from "./money";
import { addDays, daysInMonth, parts, todayISO, type ISODate } from "./dates";
import { deleteRow, insertRow, T, updateRow } from "./db";
import {
  addTransaction, DuplicateTransactionError, transactionFingerprint,
} from "./transactions";
import { ImportWorkflowError, DuplicateImportError } from "./importSchema";
import type { NexaFiImport } from "./importSchema";
import type { FinanceData } from "./data";
import type {
  Account, AIImport, AIReview, MerchantRule, RecurringExpense, RecurringSuggestion, Transaction,
} from "./types";

export { ImportWorkflowError, DuplicateImportError };

const CARD_PAYMENT_TERMS = [
  "autopay payment",
  "automatic payment",
  "card payment",
  "credit card payment",
  "payment thank you",
  "online payment",
];

/** Produce a stable merchant key while retaining useful brand words. */
export function normalizeMerchant(value: string): string {
  let text = value.toUpperCase().replace(/&/g, " AND ");
  text = text.replace(/\b(?:POS|PURCHASE|DEBIT|CREDIT|ACH|CHECKCARD|VISA)\b/g, " ");
  text = text.replace(/\b(?:INC|LLC|LTD|CORP|CO)\b\.?/g, " ");
  text = text.replace(/\b\d{4,}\b/g, " ");
  text = text.replace(/[#*]\w+/g, " ");
  text = text.replace(/[^A-Z0-9']+/g, " ");
  return text.split(/\s+/).filter(Boolean).join(" ").slice(0, 180) || "UNKNOWN MERCHANT";
}

/** Title Case, matching Python's str.title() closely enough for display. */
function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** The staged payload for one row, as stored in AIReview.suggested_payload. */
export interface StagedPayload {
  transaction_id: string | null;
  date: ISODate;
  posting_date: ISODate | null;
  merchant: string;
  raw_description: string;
  amount: string;
  transaction_type: string;
  account_id: number;
  category: string | null;
  subcategory: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  is_transfer: boolean;
  is_recurring: boolean;
  confidence: string;
  review_required: boolean;
  notes: string | null;
  transfer_match_transaction_id?: number | null;
}

export function parsePayload(review: AIReview): StagedPayload {
  return JSON.parse(review.suggested_payload || "{}") as StagedPayload;
}

export function categoryName(data: FinanceData, categoryId: number | null): string | null {
  if (!categoryId) return null;
  return data.categories.find((row) => row.id === categoryId)?.name ?? null;
}

export function resolveCategoryIds(
  data: FinanceData,
  category: string | null,
  subcategory: string | null,
): [number | null, number | null] {
  if (!category) return [null, null];
  const parent = data.categories.find(
    (row) => row.name === category && row.parent_id === null && row.is_active,
  );
  if (!parent) return [null, null];

  const child = subcategory
    ? data.categories.find(
        (row) => row.name === subcategory && row.parent_id === parent.id && row.is_active,
      )
    : undefined;
  return [parent.id, child?.id ?? null];
}

export function probableCardPayment(payload: StagedPayload): boolean {
  const text = `${payload.merchant ?? ""} ${payload.raw_description ?? ""}`.toLowerCase();
  return payload.transaction_type === "card_payment" || CARD_PAYMENT_TERMS.some((term) => text.includes(term));
}

/** Match the opposite side of a checking-to-card payment within five days. */
export function findTransferMatch(
  data: FinanceData,
  account: Account,
  payload: StagedPayload,
): Transaction | null {
  if (!["checking", "savings", "credit_card"].includes(account.account_type)) return null;

  const amount = dec(payload.amount).abs();
  const from = addDays(payload.date, -5);
  const to = addDays(payload.date, 5);
  const accountsById = new Map(data.accounts.map((row) => [row.id, row]));

  const candidates = data.transactions
    .filter(
      (row) =>
        row.account_id !== account.id &&
        dec(row.amount).equals(amount) &&
        row.transaction_date >= from &&
        row.transaction_date <= to,
    )
    .sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1));

  for (const candidate of candidates) {
    const other = accountsById.get(candidate.account_id);
    if (!other) continue;
    const pair = new Set([account.account_type, other.account_type]);
    // One side must be the card, the other a cash account - that is what makes
    // it a payment rather than an unrelated same-amount coincidence.
    if (pair.has("credit_card") && (pair.has("checking") || pair.has("savings"))) return candidate;
  }
  return null;
}

/**
 * Find an existing ledger row this staged row would duplicate.
 *
 * Returns [certain, possible]: a source-id match or an unambiguous
 * account+date+amount+merchant match is certain; a near match that could
 * legitimately be a second identical purchase is only possible, and goes to
 * review rather than being dropped.
 */
export function duplicateMatches(
  data: FinanceData,
  accountId: number,
  payload: StagedPayload,
): [Transaction | null, Transaction | null] {
  const sourceId = payload.transaction_id;
  if (sourceId) {
    const exact = data.transactions.find(
      (row) => row.account_id === accountId && row.source_transaction_id === sourceId,
    );
    if (exact) return [exact, null];
  }

  const merchant = normalizeMerchant(payload.merchant || payload.raw_description || "");
  const amount = dec(payload.amount).abs();
  const from = addDays(payload.date, -1);
  const to = addDays(payload.date, 1);

  const possible = data.transactions.find(
    (row) =>
      row.account_id === accountId &&
      row.transaction_date >= from &&
      row.transaction_date <= to &&
      dec(row.amount).equals(amount) &&
      normalizeMerchant(row.merchant || row.description) === merchant,
  );

  if (possible && !sourceId && !possible.source_transaction_id) return [possible, null];
  return [null, possible ?? null];
}

/**
 * Fingerprint a staged row exactly as it will be hashed on commit.
 *
 * Lets staging catch rows that would collide with each other on the ledger's
 * uniqueness constraint, before they ever reach the commit step.
 */
export async function pendingTransactionFingerprint(payload: StagedPayload): Promise<string> {
  const sourceId = payload.transaction_id;
  return transactionFingerprint(
    payload.account_id,
    payload.date,
    payload.merchant || payload.raw_description || "Imported",
    dec(payload.amount).abs(),
    payload.transaction_type,
    sourceId ? `source:${sourceId}` : "",
  );
}

export async function rememberMerchantRule(
  data: FinanceData,
  merchant: string,
  categoryId: number | null,
  subcategoryId: number | null,
  isTransfer: boolean,
): Promise<MerchantRule> {
  const pattern = normalizeMerchant(merchant);
  const existing = data.merchantRules.find((row) => row.merchant_pattern === pattern);
  const values = {
    normalized_merchant: merchant,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    is_transfer: isTransfer,
  };

  if (existing) {
    const row = await updateRow<MerchantRule>(T.merchantRules, existing.id, values);
    Object.assign(existing, row);
    return existing;
  }

  const row = await insertRow<MerchantRule>(T.merchantRules, {
    merchant_pattern: pattern,
    times_applied: 0,
    ...values,
  });
  data.merchantRules.push(row);
  return row;
}

// --- staging ----------------------------------------------------------------

export interface StageResult {
  importRow: AIImport;
  reviews: AIReview[];
}

/** Stage a fully validated import. No ledger transaction is created here. */
export async function stageImport(
  data: FinanceData,
  input: {
    document: NexaFiImport;
    originalContent: string;
    filename: string;
    sourceType: string;
    accountId: number;
    confidenceThreshold?: Decimal;
  },
): Promise<StageResult> {
  const threshold = input.confidenceThreshold ?? new Decimal("0.85");
  const account = data.accounts.find((row) => row.id === input.accountId);
  if (!account || !account.is_active) {
    throw new ImportWorkflowError("Choose an active NexaFi account for this import.");
  }

  const contentHash = await sha256Hex(input.originalContent);
  const existing = data.aiImports.find((row) => row.content_hash === contentHash);
  if (existing) {
    throw new DuplicateImportError(
      `This file was already imported as batch #${existing.id}; it was not staged again.`,
    );
  }

  const importRow = await insertRow<AIImport>(T.aiImports, {
    source_name: input.filename.slice(0, 180),
    source_type: input.sourceType,
    document_type: input.document.document.document_type,
    schema_version: input.document.schema_version,
    account_id: account.id,
    content_hash: contentHash,
    raw_payload: JSON.stringify(input.document),
    status: "staged",
    transaction_count: input.document.transactions.length,
  });
  data.aiImports.push(importRow);

  let duplicates = 0;
  let reviews = 0;
  const seenFingerprints = new Set<string>();
  const created: AIReview[] = [];

  for (const imported of input.document.transactions) {
    const payload: StagedPayload = {
      transaction_id: imported.transaction_id,
      date: imported.date,
      posting_date: imported.posting_date,
      merchant: titleCase(normalizeMerchant(imported.merchant)),
      raw_description: imported.raw_description,
      amount: imported.amount,
      transaction_type: imported.transaction_type,
      account_id: account.id,
      category: imported.category,
      subcategory: imported.subcategory,
      category_id: null,
      subcategory_id: null,
      is_transfer: imported.is_transfer,
      is_recurring: imported.is_recurring,
      confidence: imported.confidence,
      review_required: imported.review_required,
      notes: imported.notes,
    };
    const reasons: string[] = [];

    // A remembered rule wins over the source's own guess: it encodes a decision
    // this person already made about this merchant.
    const rule = data.merchantRules.find(
      (row) => row.merchant_pattern === normalizeMerchant(imported.merchant),
    );
    if (rule) {
      payload.merchant = rule.normalized_merchant;
      payload.category_id = rule.category_id;
      payload.subcategory_id = rule.subcategory_id;
      payload.category = categoryName(data, rule.category_id);
      payload.subcategory = categoryName(data, rule.subcategory_id);
      payload.is_transfer = rule.is_transfer;
      if (rule.is_transfer) payload.transaction_type = "transfer";
      const updated = await updateRow<MerchantRule>(T.merchantRules, rule.id, {
        times_applied: rule.times_applied + 1,
      });
      Object.assign(rule, updated);
    } else {
      const [categoryId, subcategoryId] = resolveCategoryIds(
        data,
        imported.category,
        imported.subcategory,
      );
      payload.category_id = categoryId;
      payload.subcategory_id = subcategoryId;
    }

    const transferMatch = findTransferMatch(data, account, payload);
    if (probableCardPayment(payload) || transferMatch) {
      payload.is_transfer = true;
      payload.transaction_type = "card_payment";
      payload.transfer_match_transaction_id = transferMatch?.id ?? null;
    }

    const [duplicate, possible] = duplicateMatches(data, account.id, payload);
    const rowFingerprint = await pendingTransactionFingerprint(payload);
    const duplicateInBatch = seenFingerprints.has(rowFingerprint);

    let status: string;
    if (duplicate || duplicateInBatch) {
      status = "duplicate";
      duplicates += 1;
      reasons.push(
        duplicateInBatch
          ? "Another row earlier in this same file is identical."
          : "Exact source transaction or existing ledger fingerprint matched.",
      );
    } else {
      status = "ready";
      seenFingerprints.add(rowFingerprint);

      if (possible) {
        status = "needs_review";
        reasons.push("A ledger row with the same account, date, amount, and merchant exists.");
      }
      if (imported.review_required || dec(imported.confidence).lessThan(threshold)) {
        status = "needs_review";
        reasons.push("The source marked this classification as uncertain.");
      }
      if (imported.transaction_type === "expense" && !payload.category_id) {
        status = "needs_review";
        reasons.push("Expense category must be confirmed.");
      }
      if (transferMatch || probableCardPayment(payload)) {
        status = "needs_review";
        if (transferMatch) {
          const otherAccount = data.accounts.find((row) => row.id === transferMatch.account_id);
          reasons.push(
            `Probable credit-card payment matching transaction #${transferMatch.id} in ` +
              `${otherAccount?.name ?? "another account"}; confirm it is a transfer.`,
          );
        } else {
          reasons.push("Probable credit-card payment; confirm it is a transfer.");
        }
      }
      if (status === "needs_review") reviews += 1;
    }

    const row = await insertRow<AIReview>(T.aiReviews, {
      ai_import_id: importRow.id,
      status,
      suggested_payload: JSON.stringify(payload),
      confidence: toNumeric(dec(imported.confidence), 4),
      // Dedupe reasons while preserving order.
      reason: [...new Set(reasons)].join(" ") || null,
      duplicate_transaction_id: duplicate?.id ?? possible?.id ?? null,
    });
    created.push(row);
    data.aiReviews.push(row);
  }

  const updated = await updateRow<AIImport>(T.aiImports, importRow.id, {
    duplicate_count: duplicates,
    review_count: reviews,
  });
  Object.assign(importRow, updated);

  return { importRow, reviews: created };
}

// --- review -----------------------------------------------------------------

export interface ReviewUpdate {
  action: "accept" | "reject";
  merchant?: string | null;
  categoryId?: number | null;
  subcategoryId?: number | null;
  isTransfer?: boolean;
  isRecurring?: boolean;
}

export async function updateReview(
  data: FinanceData,
  review: AIReview,
  update: ReviewUpdate,
): Promise<void> {
  if (review.status === "imported" || review.status === "duplicate") {
    throw new ImportWorkflowError("That row can no longer be edited.");
  }

  if (update.action === "reject") {
    const row = await updateRow<AIReview>(T.aiReviews, review.id, { status: "rejected" });
    Object.assign(review, row);
    return;
  }
  if (update.action !== "accept") throw new ImportWorkflowError("Choose accept or reject.");

  const categoryId = update.categoryId ?? null;
  const subcategoryId = update.subcategoryId ?? null;
  const isTransfer = update.isTransfer ?? false;
  const isRecurring = update.isRecurring ?? false;

  if (categoryId) {
    const row = data.categories.find((item) => item.id === categoryId);
    if (!row || row.parent_id !== null) {
      throw new ImportWorkflowError("Choose a valid top-level category.");
    }
  }
  if (subcategoryId) {
    const row = data.categories.find((item) => item.id === subcategoryId);
    if (!row || row.parent_id !== categoryId) {
      throw new ImportWorkflowError("Choose a subcategory that belongs to the selected category.");
    }
  }

  const payload = parsePayload(review);
  const oldCategory = payload.category_id;
  const oldSubcategory = payload.subcategory_id;

  if (update.merchant) payload.merchant = titleCase(normalizeMerchant(update.merchant));
  payload.category_id = categoryId;
  payload.subcategory_id = subcategoryId;
  payload.category = categoryName(data, categoryId);
  payload.subcategory = categoryName(data, subcategoryId);
  payload.is_transfer = isTransfer;
  payload.is_recurring = isRecurring;

  if (isTransfer) {
    payload.transaction_type =
      payload.transaction_type === "card_payment" ? "card_payment" : "transfer";
  } else if (payload.transaction_type === "transfer" || payload.transaction_type === "card_payment") {
    payload.transaction_type = "expense";
  }
  if (payload.transaction_type === "expense" && !categoryId) {
    throw new ImportWorkflowError("Choose a category before accepting an expense.");
  }

  const row = await updateRow<AIReview>(T.aiReviews, review.id, {
    suggested_payload: JSON.stringify(payload),
    status: "accepted",
    reason: null,
  });
  Object.assign(review, row);

  // Only remember a rule when a decision actually changed something - otherwise
  // every accepted row would rewrite the same rule with the same values.
  if (categoryId !== oldCategory || subcategoryId !== oldSubcategory || update.merchant) {
    await rememberMerchantRule(data, payload.merchant, categoryId, subcategoryId, isTransfer);
  }
}

// --- commit -----------------------------------------------------------------

export interface CommitResult {
  created: number;
  skipped: number;
  autoAccepted: number;
}

/**
 * Commit an approved batch.
 *
 * Rows still marked needs_review are auto-accepted with their best-guess
 * payload instead of blocking the commit - they are flagged via review_required
 * on the resulting transaction so they are easy to find and fix later.
 */
export async function commitImport(data: FinanceData, importRow: AIImport): Promise<CommitResult> {
  if (importRow.status === "committed") {
    throw new ImportWorkflowError("This import has already been committed.");
  }

  const reviews = data.aiReviews.filter((row) => row.ai_import_id === importRow.id);
  let created = 0;
  let skipped = 0;
  let autoAccepted = 0;

  for (const review of reviews) {
    if (!["ready", "accepted", "needs_review"].includes(review.status)) continue;
    const wasUncertain = review.status === "needs_review";
    const payload = parsePayload(review);
    const description = payload.merchant || payload.raw_description || "Imported";

    try {
      const transaction = await addTransaction({
        transaction_date: payload.date,
        posting_date: payload.posting_date ?? null,
        account_id: payload.account_id,
        description,
        merchant: payload.merchant ?? null,
        raw_description: payload.raw_description ?? null,
        source_transaction_id: payload.transaction_id ?? null,
        amount: dec(payload.amount).abs(),
        transaction_type: payload.transaction_type as never,
        category_id: payload.category_id,
        subcategory_id: payload.subcategory_id,
        notes: payload.notes ?? null,
        is_transfer: Boolean(payload.is_transfer),
        is_recurring: Boolean(payload.is_recurring),
        source: `import:${importRow.source_type}`,
        confidence: review.confidence ? dec(review.confidence) : null,
        review_required: wasUncertain,
        ai_import_id: importRow.id,
      });
      data.transactions.push(transaction);

      const updated = await updateRow<AIReview>(T.aiReviews, review.id, {
        transaction_id: transaction.id,
        status: "imported",
      });
      Object.assign(review, updated);
      created += 1;
      if (wasUncertain) autoAccepted += 1;
    } catch (error) {
      if (!(error instanceof DuplicateTransactionError)) throw error;
      const updated = await updateRow<AIReview>(T.aiReviews, review.id, {
        status: "duplicate",
        reason: "That transaction already exists.",
      });
      Object.assign(review, updated);
      skipped += 1;
    }
  }

  const updatedImport = await updateRow<AIImport>(T.aiImports, importRow.id, {
    status: "committed",
    duplicate_count: importRow.duplicate_count + skipped,
  });
  Object.assign(importRow, updatedImport);

  await detectRecurringChanges(data);
  return { created, skipped, autoAccepted };
}

/**
 * Delete a batch, including any ledger transactions it committed.
 *
 * A staged batch has no ledger effect, so this only removes its review rows. A
 * committed batch's transactions exist solely because of it, so those go too -
 * this is the only way to undo a bad import.
 */
export async function deleteImport(data: FinanceData, importRow: AIImport): Promise<number> {
  const transactions = data.transactions.filter((row) => row.ai_import_id === importRow.id);
  const transactionIds = new Set(transactions.map((row) => row.id));

  if (transactionIds.size > 0) {
    for (const suggestion of data.recurringSuggestions) {
      if (suggestion.transaction_id && transactionIds.has(suggestion.transaction_id)) {
        await updateRow<RecurringSuggestion>(T.recurringSuggestions, suggestion.id, {
          transaction_id: null,
        });
        suggestion.transaction_id = null;
      }
    }
    // Other batches may point at these rows as their duplicate evidence; clear
    // those references before the rows disappear underneath them.
    for (const review of data.aiReviews) {
      if (review.ai_import_id === importRow.id) continue;
      const patch: Record<string, unknown> = {};
      if (review.transaction_id && transactionIds.has(review.transaction_id)) patch.transaction_id = null;
      if (review.duplicate_transaction_id && transactionIds.has(review.duplicate_transaction_id)) {
        patch.duplicate_transaction_id = null;
      }
      if (Object.keys(patch).length > 0) {
        const row = await updateRow<AIReview>(T.aiReviews, review.id, patch);
        Object.assign(review, row);
      }
    }
  }

  for (const review of data.aiReviews.filter((row) => row.ai_import_id === importRow.id)) {
    await deleteRow(T.aiReviews, review.id);
  }
  data.aiReviews = data.aiReviews.filter((row) => row.ai_import_id !== importRow.id);

  for (const transaction of transactions) {
    await deleteRow(T.transactions, transaction.id);
  }
  data.transactions = data.transactions.filter((row) => !transactionIds.has(row.id));

  await deleteRow(T.aiImports, importRow.id);
  data.aiImports = data.aiImports.filter((row) => row.id !== importRow.id);

  return transactionIds.size;
}

// --- recurring detection ----------------------------------------------------

/** Create confirmation-only recurring suggestions from deterministic history. */
export async function detectRecurringChanges(data: FinanceData): Promise<RecurringSuggestion[]> {
  const rows = data.transactions
    .filter((row) => !row.is_transfer && row.transaction_type === "expense")
    .sort((a, b) => (a.transaction_date < b.transaction_date ? -1 : 1));

  const byMerchant = new Map<string, Transaction[]>();
  for (const row of rows) {
    const key = normalizeMerchant(row.merchant || row.description);
    byMerchant.set(key, [...(byMerchant.get(key) ?? []), row]);
  }

  const created: RecurringSuggestion[] = [];
  const existingKeys = new Set(
    data.recurringSuggestions
      .filter((item) => item.status === "needs_review")
      .map((item) => `${item.merchant}|${item.suggestion_type}`),
  );
  const known = new Map<string, RecurringExpense>(
    data.recurringExpenses
      .filter((item) => item.is_active)
      .map((item) => [normalizeMerchant(item.name), item]),
  );

  const addSuggestion = async (
    merchant: string,
    suggestionType: string,
    values: {
      amount: Decimal | null;
      previousAmount: Decimal | null;
      evidence: string;
      transactionId?: number | null;
    },
  ) => {
    const label = titleCase(merchant);
    const key = `${label}|${suggestionType}`;
    if (existingKeys.has(key)) return;

    const row = await insertRow<RecurringSuggestion>(T.recurringSuggestions, {
      merchant: label,
      suggestion_type: suggestionType,
      status: "needs_review",
      amount: values.amount ? toNumeric(values.amount) : null,
      previous_amount: values.previousAmount ? toNumeric(values.previousAmount) : null,
      transaction_id: values.transactionId ?? null,
      evidence: values.evidence,
    });
    created.push(row);
    data.recurringSuggestions.push(row);
    existingKeys.add(key);
  };

  for (const [merchant, history] of byMerchant) {
    const months = new Set(history.map((item) => item.transaction_date.slice(0, 7)));
    const recent = history[history.length - 1];
    const latestMonth = recent.transaction_date.slice(0, 7);
    const latestRows = history.filter((item) => item.transaction_date.slice(0, 7) === latestMonth);

    // Two identical charges within ten days is the classic double-billing shape.
    if (latestRows.length >= 2) {
      let doubled = false;
      for (let i = 0; i < latestRows.length && !doubled; i += 1) {
        for (let j = i + 1; j < latestRows.length; j += 1) {
          const left = latestRows[i];
          const right = latestRows[j];
          if (dec(left.amount).equals(right.amount) && daysBetween(left.transaction_date, right.transaction_date) <= 10) {
            doubled = true;
            break;
          }
        }
      }
      if (doubled) {
        await addSuggestion(merchant, "duplicate_subscription", {
          amount: money(latestRows[latestRows.length - 1].amount),
          previousAmount: money(latestRows[latestRows.length - 2].amount),
          transactionId: latestRows[latestRows.length - 1].id,
          evidence: "Two matching charges appeared within ten days in the same month.",
        });
      }
    }

    if (months.size < 2) continue;

    const previous = history[history.length - 2];
    const amounts = history.slice(-4).map((item) => dec(item.amount));
    const minAmount = amounts.reduce((low, value) => (value.lessThan(low) ? value : low), amounts[0]);
    const maxAmount = amounts.reduce((high, value) => (value.greaterThan(high) ? value : high), amounts[0]);
    const stableAmount = minAmount.greaterThanOrEqualTo(maxAmount.times("0.95"));
    const explicitlyRecurring = history.some((item) => item.is_recurring);

    // Without a stable amount, an explicit flag, or a known bill, this is just
    // a merchant seen twice - not evidence of a subscription.
    if (!stableAmount && !explicitlyRecurring && !known.has(merchant)) continue;

    if (dec(recent.amount).greaterThan(dec(previous.amount).times("1.03"))) {
      await addSuggestion(merchant, "price_increase", {
        amount: money(recent.amount),
        previousAmount: money(previous.amount),
        transactionId: recent.id,
        evidence: `Latest charge increased from ${money(previous.amount).toFixed(2)} to ${money(recent.amount).toFixed(2)}.`,
      });
    } else if (!known.has(merchant)) {
      await addSuggestion(merchant, "new_subscription", {
        amount: money(recent.amount),
        previousAmount: money(previous.amount),
        transactionId: recent.id,
        evidence: `Seen at a similar amount in ${months.size} distinct months; latest charge ${recent.transaction_date}.`,
      });
    }
  }

  // A known bill with no charge this month, past its due day, is missing.
  if (rows.length > 0) {
    const asOf = rows.reduce(
      (latest, row) => (row.transaction_date > latest ? row.transaction_date : latest),
      rows[0].transaction_date,
    );
    const { year, month, day } = parts(asOf);
    const start = `${asOf.slice(0, 7)}-01`;
    const end = `${asOf.slice(0, 7)}-${String(daysInMonth(year, month)).padStart(2, "0")}`;

    for (const [merchant, recurring] of known) {
      const dueHasPassed = recurring.due_day === null || recurring.due_day <= day;
      const currentRows = (byMerchant.get(merchant) ?? []).filter(
        (item) => item.transaction_date >= start && item.transaction_date <= end,
      );
      if (dueHasPassed && currentRows.length === 0) {
        await addSuggestion(merchant, "missing_expected", {
          amount: null,
          previousAmount: money(recurring.amount),
          evidence: `No matching charge was found through ${asOf} for this active recurring expense.`,
        });
      }
    }
  }

  return created;
}

function daysBetween(left: ISODate, right: ISODate): number {
  const a = parts(left);
  const b = parts(right);
  const first = Date.UTC(a.year, a.month - 1, a.day);
  const second = Date.UTC(b.year, b.month - 1, b.day);
  return Math.abs(Math.round((first - second) / 86_400_000));
}

export async function resolveRecurringSuggestion(
  data: FinanceData,
  suggestion: RecurringSuggestion,
  accept: boolean,
): Promise<void> {
  const updated = await updateRow<RecurringSuggestion>(T.recurringSuggestions, suggestion.id, {
    status: accept ? "accepted" : "rejected",
  });
  Object.assign(suggestion, updated);
  if (!accept) return;

  const existing = data.recurringExpenses.find(
    (row) => row.name.toLowerCase() === suggestion.merchant.toLowerCase(),
  );

  if (existing) {
    if (suggestion.amount) {
      const row = await updateRow<RecurringExpense>(T.recurringExpenses, existing.id, {
        amount: toNumeric(dec(suggestion.amount)),
      });
      Object.assign(existing, row);
    }
    return;
  }

  const row = await insertRow<RecurringExpense>(T.recurringExpenses, {
    name: suggestion.merchant,
    amount: toNumeric(suggestion.amount ? dec(suggestion.amount) : ZERO),
    frequency: "monthly",
    is_active: true,
  });
  data.recurringExpenses.push(row);
}

export { todayISO };
