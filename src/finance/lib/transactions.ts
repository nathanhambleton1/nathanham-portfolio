// Transaction and transfer creation — a port of nexafi/services/transactions.py.
//
// The fingerprint is what stops the same transaction being imported twice. It
// must stay byte-identical to the Python's, otherwise rows migrated from the
// old SQLite database would not de-duplicate against newly imported ones.
// SHA-256 over the same "|"-joined normalized fields, same order, same casing.

import { Decimal, money, toNumeric } from "./money";
import type { ISODate } from "./dates";
import { insertRow, T } from "./db";
import type { Transaction, Transfer, TransactionType } from "./types";

export class DuplicateTransactionError extends Error {
  constructor(message = "That transaction already exists.") {
    super(message);
    this.name = "DuplicateTransactionError";
  }
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Stable identity for a transaction.
 *
 * `amount` is formatted to exactly two decimals to match Python's
 * `amount.quantize(Decimal("0.01"))`, including the leading "-" on outflows.
 */
export async function transactionFingerprint(
  accountId: number,
  transactionDate: ISODate,
  description: string,
  amount: Decimal,
  transactionType: string,
  salt = "",
): Promise<string> {
  const normalized = [
    String(accountId),
    transactionDate,
    description.toLowerCase().split(/\s+/).filter(Boolean).join(" "),
    money(amount).toFixed(2),
    transactionType,
    salt,
  ].join("|");
  return sha256Hex(normalized);
}

export interface NewTransaction {
  transaction_date: ISODate;
  account_id: number;
  description: string;
  amount: Decimal;
  transaction_type: TransactionType;
  posting_date?: ISODate | null;
  merchant?: string | null;
  raw_description?: string | null;
  source_transaction_id?: string | null;
  category_id?: number | null;
  subcategory_id?: number | null;
  notes?: string | null;
  is_transfer?: boolean;
  is_recurring?: boolean;
  source?: string;
  confidence?: Decimal | null;
  review_required?: boolean;
  ai_import_id?: number | null;
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key|unique constraint|23505/i.test(message);
}

/**
 * Insert a transaction, refusing an exact repeat.
 *
 * The unique index on (owner, fingerprint) is the real guard — the catch below
 * turns the database's rejection into the app's own error rather than relying
 * on a check-then-insert, which would race.
 */
export async function addTransaction(values: NewTransaction): Promise<Transaction> {
  const salt = values.source_transaction_id ? `source:${values.source_transaction_id}` : "";
  const fingerprint = await transactionFingerprint(
    values.account_id,
    values.transaction_date,
    values.description,
    values.amount,
    values.transaction_type,
    salt,
  );

  const row: Record<string, unknown> = {
    transaction_date: values.transaction_date,
    posting_date: values.posting_date ?? null,
    account_id: values.account_id,
    description: values.description,
    merchant: values.merchant ?? null,
    raw_description: values.raw_description ?? null,
    source_transaction_id: values.source_transaction_id ?? null,
    amount: toNumeric(values.amount),
    transaction_type: values.transaction_type,
    category_id: values.category_id ?? null,
    subcategory_id: values.subcategory_id ?? null,
    notes: values.notes ?? null,
    is_transfer: values.is_transfer ?? false,
    is_recurring: values.is_recurring ?? false,
    source: values.source ?? "manual",
    confidence: values.confidence ? toNumeric(values.confidence, 4) : null,
    review_required: values.review_required ?? false,
    ai_import_id: values.ai_import_id ?? null,
    fingerprint,
  };

  try {
    return await insertRow<Transaction>(T.transactions, row);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateTransactionError();
    throw error;
  }
}

/**
 * Create a transfer as two mirrored transactions plus the linking row.
 *
 * Both legs share a short token in their fingerprint salt so that two genuinely
 * separate transfers of the same amount, on the same day, between the same
 * accounts do not collide — while a replay of the same one still does.
 */
export async function createTransfer(input: {
  transferDate: ISODate;
  sourceAccountId: number;
  destinationAccountId: number;
  amount: Decimal;
  description?: string;
  transferKind?: string;
}): Promise<Transfer> {
  const { transferDate, sourceAccountId, destinationAccountId } = input;
  const amount = money(input.amount);
  const description = input.description ?? "Account transfer";
  const transferKind = input.transferKind ?? "account_transfer";

  if (sourceAccountId === destinationAccountId) {
    throw new Error("Source and destination accounts must be different.");
  }
  if (amount.lessThanOrEqualTo(0)) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  const token = (
    await sha256Hex(`${sourceAccountId}:${destinationAccountId}:${transferDate}:${amount.toFixed(2)}`)
  ).slice(0, 12);

  const sourceTx = await insertRow<Transaction>(T.transactions, {
    transaction_date: transferDate,
    account_id: sourceAccountId,
    description,
    amount: toNumeric(amount.negated()),
    transaction_type: transferKind,
    is_transfer: true,
    source: "manual",
    fingerprint: await transactionFingerprint(
      sourceAccountId, transferDate, description, amount.negated(), transferKind, `source:${token}`,
    ),
  });

  const destinationTx = await insertRow<Transaction>(T.transactions, {
    transaction_date: transferDate,
    account_id: destinationAccountId,
    description,
    amount: toNumeric(amount),
    transaction_type: transferKind,
    is_transfer: true,
    source: "manual",
    fingerprint: await transactionFingerprint(
      destinationAccountId, transferDate, description, amount, transferKind, `destination:${token}`,
    ),
  });

  return insertRow<Transfer>(T.transfers, {
    transfer_date: transferDate,
    source_account_id: sourceAccountId,
    destination_account_id: destinationAccountId,
    amount: toNumeric(amount),
    source_transaction_id: sourceTx.id,
    destination_transaction_id: destinationTx.id,
    transfer_kind: transferKind,
  });
}
