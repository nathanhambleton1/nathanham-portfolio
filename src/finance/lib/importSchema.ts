// Versioned interchange schema for statement extraction and structured imports.
// A port of nexafi/import_schema.py, with zod standing in for Pydantic.
//
// The shape is deliberately strict: unknown keys are rejected and the
// cross-field rules (a transfer must say so in both places, an uncategorized
// expense must be flagged for review) are enforced here rather than being
// discovered later in the ledger.

import { z } from "zod";

export const SCHEMA_VERSION = "1.0";

export const TOP_LEVEL_CATEGORIES = [
  "Housing & Bills",
  "Food & Dining",
  "Transportation",
  "Shopping & Personal",
  "Travel & Other",
] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a YYYY-MM-DD date");

/** Numerics arrive as JSON numbers or strings; keep them as strings for Decimal. */
const decimalString = z.union([z.number(), z.string()]).transform((value) => String(value));

const documentInfo = z
  .object({
    document_type: z.enum(["bank_statement", "credit_card_statement", "paystub", "other"]),
    source_name: z.string().nullable(),
    institution: z.string().nullable(),
  })
  .strict();

const accountInfo = z
  .object({
    name: z.string().nullable(),
    institution: z.string().nullable(),
    account_type: z
      .enum(["checking", "savings", "credit_card", "retirement", "brokerage", "other"])
      .nullable(),
    last_four: z.string().nullable(),
  })
  .strict();

const statementInfo = z
  .object({
    period_start: isoDate.nullable(),
    period_end: isoDate.nullable(),
    statement_date: isoDate.nullable(),
  })
  .strict()
  .refine(
    (value) => !value.period_start || !value.period_end || value.period_end >= value.period_start,
    { message: "statement.period_end cannot be before period_start" },
  );

const balanceInfo = z
  .object({
    opening: decimalString.nullable(),
    closing: decimalString.nullable(),
    available: decimalString.nullable(),
    currency: z.literal("USD"),
  })
  .strict();

export const importedTransactionSchema = z
  .object({
    transaction_id: z.string().max(180).nullable(),
    date: isoDate,
    posting_date: isoDate.nullable(),
    merchant: z.string().min(1).max(180),
    raw_description: z.string().min(1).max(1000),
    amount: decimalString,
    transaction_type: z.enum(["expense", "income", "refund", "transfer", "card_payment"]),
    account: z.string().max(180).nullable(),
    category: z.enum(TOP_LEVEL_CATEGORIES).nullable(),
    subcategory: z.string().max(100).nullable(),
    is_transfer: z.boolean(),
    is_recurring: z.boolean(),
    confidence: decimalString,
    review_required: z.boolean(),
    notes: z.string().max(1000).nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Number(value.amount) === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "transaction amount cannot be zero", path: ["amount"] });
    }
    const confidence = Number(value.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "confidence must be between 0 and 1", path: ["confidence"] });
    }
    const isTransferType = value.transaction_type === "transfer" || value.transaction_type === "card_payment";
    if (isTransferType && !value.is_transfer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "transfer and card_payment rows must set is_transfer=true", path: ["is_transfer"] });
    }
    if (value.is_transfer && !isTransferType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "is_transfer=true requires transaction_type transfer or card_payment", path: ["transaction_type"] });
    }
    if (value.category === null && value.transaction_type === "expense" && !value.review_required) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "uncategorized expenses must set review_required=true", path: ["review_required"] });
    }
  });

const detectedTransfer = z
  .object({
    transaction_ids: z.array(z.string()).min(1).max(2),
    confidence: decimalString,
    reason: z.string(),
  })
  .strict();

const importedRecurringExpense = z
  .object({
    merchant: z.string(),
    amount: decimalString.nullable(),
    frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "annual", "unknown"]),
    transaction_ids: z.array(z.string()),
    confidence: decimalString,
    review_required: z.boolean(),
  })
  .strict();

const reviewFlag = z
  .object({
    transaction_id: z.string().nullable(),
    code: z.enum([
      "low_confidence", "uncertain_category", "uncertain_amount", "uncertain_date",
      "probable_transfer", "possible_duplicate", "other",
    ]),
    message: z.string(),
  })
  .strict();

const aiAnalysis = z
  .object({
    extraction_notes: z.array(z.string()),
    warnings: z.array(z.string()),
  })
  .strict();

export const nexaFiImportSchema = z
  .object({
    schema_version: z.literal("1.0"),
    document: documentInfo,
    account: accountInfo,
    statement: statementInfo,
    balances: balanceInfo,
    transactions: z.array(importedTransactionSchema),
    detected_transfers: z.array(detectedTransfer),
    recurring_expenses: z.array(importedRecurringExpense),
    review_flags: z.array(reviewFlag),
    ai_analysis: aiAnalysis,
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = value.transactions
      .map((row) => row.transaction_id)
      .filter((id): id is string => Boolean(id));
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "transaction_id values must be unique within an import",
        path: ["transactions"],
      });
    }
  });

export type NexaFiImport = z.infer<typeof nexaFiImportSchema>;
export type ImportedTransaction = z.infer<typeof importedTransactionSchema>;

export const insightCommentarySchema = z
  .object({
    overall_assessment: z.string(),
    wins: z.array(z.string()),
    watch_items: z.array(z.string()),
    opportunities: z.array(z.string()),
    unusual_activity: z.array(z.string()),
    recommended_actions: z.array(z.string()),
  })
  .strict();

export type InsightCommentary = z.infer<typeof insightCommentarySchema>;

/**
 * The public JSON Schema handed to an external model.
 *
 * Written out rather than generated: it is prompt text, it has to stay stable
 * across versions of any generator, and a person reading it should be able to
 * see exactly what the model is being asked for.
 */
export const IMPORT_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "NexaFiImport",
  type: "object",
  additionalProperties: false,
  required: [
    "schema_version", "document", "account", "statement", "balances",
    "transactions", "detected_transfers", "recurring_expenses", "review_flags", "ai_analysis",
  ],
  properties: {
    schema_version: { const: SCHEMA_VERSION },
    document: {
      type: "object",
      additionalProperties: false,
      required: ["document_type", "source_name", "institution"],
      properties: {
        document_type: { enum: ["bank_statement", "credit_card_statement", "paystub", "other"] },
        source_name: { type: ["string", "null"] },
        institution: { type: ["string", "null"] },
      },
    },
    account: {
      type: "object",
      additionalProperties: false,
      required: ["name", "institution", "account_type", "last_four"],
      properties: {
        name: { type: ["string", "null"] },
        institution: { type: ["string", "null"] },
        account_type: {
          anyOf: [
            { enum: ["checking", "savings", "credit_card", "retirement", "brokerage", "other"] },
            { type: "null" },
          ],
        },
        last_four: { type: ["string", "null"] },
      },
    },
    statement: {
      type: "object",
      additionalProperties: false,
      required: ["period_start", "period_end", "statement_date"],
      properties: {
        period_start: { type: ["string", "null"], format: "date" },
        period_end: { type: ["string", "null"], format: "date" },
        statement_date: { type: ["string", "null"], format: "date" },
      },
    },
    balances: {
      type: "object",
      additionalProperties: false,
      required: ["opening", "closing", "available", "currency"],
      properties: {
        opening: { type: ["number", "string", "null"] },
        closing: { type: ["number", "string", "null"] },
        available: { type: ["number", "string", "null"] },
        currency: { const: "USD" },
      },
    },
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "transaction_id", "date", "posting_date", "merchant", "raw_description", "amount",
          "transaction_type", "account", "category", "subcategory", "is_transfer",
          "is_recurring", "confidence", "review_required", "notes",
        ],
        properties: {
          transaction_id: { type: ["string", "null"], maxLength: 180 },
          date: { type: "string", format: "date" },
          posting_date: { type: ["string", "null"], format: "date" },
          merchant: { type: "string", minLength: 1, maxLength: 180 },
          raw_description: { type: "string", minLength: 1, maxLength: 1000 },
          amount: { type: ["number", "string"] },
          transaction_type: { enum: ["expense", "income", "refund", "transfer", "card_payment"] },
          account: { type: ["string", "null"], maxLength: 180 },
          category: { anyOf: [{ enum: [...TOP_LEVEL_CATEGORIES] }, { type: "null" }] },
          subcategory: { type: ["string", "null"], maxLength: 100 },
          is_transfer: { type: "boolean" },
          is_recurring: { type: "boolean" },
          confidence: { type: ["number", "string"], minimum: 0, maximum: 1 },
          review_required: { type: "boolean" },
          notes: { type: ["string", "null"], maxLength: 1000 },
        },
      },
    },
    detected_transfers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["transaction_ids", "confidence", "reason"],
        properties: {
          transaction_ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
          confidence: { type: ["number", "string"], minimum: 0, maximum: 1 },
          reason: { type: "string" },
        },
      },
    },
    recurring_expenses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["merchant", "amount", "frequency", "transaction_ids", "confidence", "review_required"],
        properties: {
          merchant: { type: "string" },
          amount: { type: ["number", "string", "null"] },
          frequency: { enum: ["weekly", "biweekly", "monthly", "quarterly", "annual", "unknown"] },
          transaction_ids: { type: "array", items: { type: "string" } },
          confidence: { type: ["number", "string"], minimum: 0, maximum: 1 },
          review_required: { type: "boolean" },
        },
      },
    },
    review_flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["transaction_id", "code", "message"],
        properties: {
          transaction_id: { type: ["string", "null"] },
          code: {
            enum: [
              "low_confidence", "uncertain_category", "uncertain_amount", "uncertain_date",
              "probable_transfer", "possible_duplicate", "other",
            ],
          },
          message: { type: "string" },
        },
      },
    },
    ai_analysis: {
      type: "object",
      additionalProperties: false,
      required: ["extraction_notes", "warnings"],
      properties: {
        extraction_notes: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

export function schemaJson(indent = 2): string {
  return JSON.stringify(IMPORT_JSON_SCHEMA, null, indent);
}

/** Reusable prompt for statement extraction by an external capable model. */
export function extractionPrompt(): string {
  return `You are extracting a financial document for NexaFi.

Return ONLY one JSON object that validates against the JSON Schema below. Do not use Markdown.

Rules:
1. Extract every visible transaction. Never omit a transaction for convenience.
2. Preserve exact amounts and dates. Never round, recalculate, or silently change them.
3. Preserve the original text in raw_description and provide a cleaned merchant name.
4. Use only these top-level categories: ${TOP_LEVEL_CATEGORIES.join(", ")}.
5. Detect probable transfers and credit-card payments. A card purchase is an expense; its later checking-to-card payment is a transfer, never a second expense.
6. Identify likely recurring expenses, but require review when uncertain.
7. Set confidence from 0 to 1 for every transaction and set review_required=true for uncertain amounts, dates, merchants, categories, or transfer classifications.
8. Never invent missing transactions or fill illegible values by guessing. Flag uncertainty instead.
9. Do not provide authoritative totals. NexaFi will calculate all totals from validated transactions in TypeScript.
10. Use schema_version '${SCHEMA_VERSION}' and return ONLY schema-valid JSON.

JSON Schema:
${schemaJson()}
`;
}

export class ImportWorkflowError extends Error {}
export class DuplicateImportError extends ImportWorkflowError {}

/** Parse and fully validate an import before any database operation occurs. */
export function parseImportJson(content: string): NexaFiImport {
  // Strip a UTF-8 BOM, which some editors prepend and JSON.parse rejects.
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^﻿/, ""));
  } catch (error) {
    throw new ImportWorkflowError(
      `That is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = nexaFiImportSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const location = first.path.join(".") || "document";
    throw new ImportWorkflowError(`Invalid NexaFi JSON at ${location}: ${first.message}`);
  }
  return result.data;
}
