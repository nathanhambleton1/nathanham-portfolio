// Portfolio tracking - a port of nexafi/services/investments.py.
//
// Import-first by design: manual entries and CSV statements are authoritative,
// and no live market feed is consulted. A "holding" is therefore always paired
// with a dated price and a dated snapshot, so the portfolio can be reconstructed
// as of any statement you have loaded.

import { Decimal, ZERO, dec, money, quantize, sum as sumMoney, toNumeric } from "./money";
import { todayISO, type ISODate } from "./dates";
import { insertRow, T, updateRow } from "./db";
import type { FinanceData } from "./data";
import type {
  Account, AccountBalance, InvestmentAccount, InvestmentHolding, InvestmentSnapshot,
  InvestmentTransaction, Security, SecurityPrice,
} from "./types";

/** Accounts that can hold securities. */
const INVESTMENT_TYPES = new Set([
  "brokerage", "retirement", "roth_401k", "traditional_401k",
  "roth_ira", "traditional_ira", "taxable_brokerage",
]);

/** Activity types that represent money entering or leaving from outside. */
const CONTRIBUTION_TYPES = ["contribution", "deposit"];

export interface HoldingView {
  holding: InvestmentHolding;
  account: Account;
  security: Security;
  price: Decimal;
  marketValue: Decimal;
  unrealizedGain: Decimal;
  returnPercent: Decimal;
  allocationPercent: Decimal;
}

export interface InvestmentSummary {
  marketValue: Decimal;
  costBasis: Decimal;
  unrealizedGain: Decimal;
  netContributions: Decimal;
  performanceGain: Decimal;
  performancePercent: Decimal;
  holdings: HoldingView[];
}

export interface InvestmentHistoryPoint {
  date: ISODate;
  marketValue: number;
  costBasis: number;
}

/** The most recent recorded price at or before `asOf`. */
export function latestPrice(
  data: FinanceData,
  securityId: number,
  asOf?: ISODate | null,
): Decimal {
  const candidates = data.securityPrices
    .filter((row) => row.security_id === securityId && (!asOf || row.price_date <= asOf))
    .sort((a, b) => (a.price_date === b.price_date ? b.id - a.id : a.price_date < b.price_date ? 1 : -1));
  return candidates.length > 0 ? dec(candidates[0].price) : ZERO;
}

export function investmentSummary(data: FinanceData, asOf?: ISODate | null): InvestmentSummary {
  const accountsById = new Map(data.accounts.map((account) => [account.id, account]));
  const investmentAccountsById = new Map(data.investmentAccounts.map((row) => [row.id, row]));
  const securitiesById = new Map(data.securities.map((row) => [row.id, row]));

  interface Interim extends Omit<HoldingView, "allocationPercent"> {}
  const interim: Interim[] = [];
  let totalValue = ZERO;
  let totalBasis = ZERO;

  for (const holding of data.holdings) {
    const investmentAccount = investmentAccountsById.get(holding.investment_account_id);
    const security = securitiesById.get(holding.security_id);
    if (!investmentAccount || !security) continue;
    const account = accountsById.get(investmentAccount.account_id);
    if (!account || !account.is_active) continue;

    const price = latestPrice(data, security.id, asOf);
    const value = money(dec(holding.quantity).times(price));
    const basis = money(holding.cost_basis);
    const gain = money(value.minus(basis));

    totalValue = totalValue.plus(value);
    totalBasis = totalBasis.plus(basis);

    interim.push({
      holding,
      account,
      security,
      price,
      marketValue: value,
      unrealizedGain: gain,
      returnPercent: basis.isZero() ? ZERO : money(gain.div(basis).times(100)),
    });
  }

  interim.sort((a, b) => {
    const byAccount = a.account.name.localeCompare(b.account.name);
    return byAccount !== 0 ? byAccount : a.security.symbol.localeCompare(b.security.symbol);
  });

  totalValue = money(totalValue);
  totalBasis = money(totalBasis);

  const holdings: HoldingView[] = interim.map((item) => ({
    ...item,
    allocationPercent: totalValue.isZero()
      ? ZERO
      : money(item.marketValue.div(totalValue).times(100)),
  }));

  const contributions = sumMoney(
    data.investmentTransactions
      .filter((row) => CONTRIBUTION_TYPES.includes(row.transaction_type))
      .map((row) => row.amount),
  );
  const withdrawals = sumMoney(
    data.investmentTransactions
      .filter((row) => row.transaction_type === "withdrawal")
      .map((row) => row.amount),
  );
  const netContributions = money(contributions.minus(withdrawals));

  // With no recorded external cash flow, cost basis is the best stand-in for
  // "what you put in" - otherwise every gain would be measured against zero.
  const capital = netContributions.isZero() ? totalBasis : netContributions;
  const performanceGain = money(totalValue.minus(capital));

  return {
    marketValue: totalValue,
    costBasis: totalBasis,
    unrealizedGain: money(totalValue.minus(totalBasis)),
    netContributions,
    performanceGain,
    performancePercent: capital.isZero() ? ZERO : money(performanceGain.div(capital).times(100)),
    holdings,
  };
}

export function investmentHistory(data: FinanceData): InvestmentHistoryPoint[] {
  const byDate = new Map<ISODate, { value: Decimal; basis: Decimal }>();
  for (const snapshot of data.investmentSnapshots) {
    const bucket = byDate.get(snapshot.snapshot_date) ?? { value: ZERO, basis: ZERO };
    bucket.value = bucket.value.plus(snapshot.market_value);
    bucket.basis = bucket.basis.plus(snapshot.cost_basis);
    byDate.set(snapshot.snapshot_date, bucket);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, totals]) => ({
      date,
      marketValue: money(totals.value).toNumber(),
      costBasis: money(totals.basis).toNumber(),
    }));
}

// --- writes -----------------------------------------------------------------

export interface HoldingInput {
  accountId: number;
  taxTreatment: string;
  symbol: string;
  name: string;
  securityType: string;
  quantity: Decimal;
  costBasis: Decimal;
  price: Decimal;
  asOfDate: ISODate;
  source?: string;
}

/**
 * Record a position as of a date, creating whatever scaffolding it needs.
 *
 * The account, symbol, and date together identify one portfolio snapshot, so
 * re-importing the same statement updates in place rather than duplicating.
 */
export async function upsertHolding(
  data: FinanceData,
  input: HoldingInput,
): Promise<InvestmentHolding> {
  const source = input.source ?? "manual";
  const account = data.accounts.find((row) => row.id === input.accountId);
  if (!account || !INVESTMENT_TYPES.has(account.account_type)) {
    throw new Error("Choose a brokerage or retirement account.");
  }

  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol || symbol.length > 20) {
    throw new Error("Enter a valid symbol of 20 characters or fewer.");
  }
  if (
    input.quantity.lessThan(0) ||
    input.costBasis.lessThan(0) ||
    input.price.lessThan(0)
  ) {
    throw new Error("Quantity, cost basis, and price cannot be negative.");
  }

  // 1. the investment account wrapper
  let investmentAccount = data.investmentAccounts.find((row) => row.account_id === input.accountId);
  if (!investmentAccount) {
    investmentAccount = await insertRow<InvestmentAccount>(T.investmentAccounts, {
      account_id: input.accountId,
      tax_treatment: input.taxTreatment.trim() || "taxable",
    });
    data.investmentAccounts.push(investmentAccount);
  } else if (input.taxTreatment.trim()) {
    const updated = await updateRow<InvestmentAccount>(T.investmentAccounts, investmentAccount.id, {
      tax_treatment: input.taxTreatment.trim(),
    });
    Object.assign(investmentAccount, updated);
  }

  // 2. the security
  let security = data.securities.find((row) => row.symbol === symbol);
  if (!security) {
    security = await insertRow<Security>(T.securities, {
      symbol,
      name: input.name.trim() || symbol,
      security_type: input.securityType.trim() || "other",
    });
    data.securities.push(security);
  } else {
    const updated = await updateRow<Security>(T.securities, security.id, {
      name: input.name.trim() || security.name,
      security_type: input.securityType.trim() || security.security_type,
    });
    Object.assign(security, updated);
  }

  // 3. the current position
  let holding = data.holdings.find(
    (row) =>
      row.investment_account_id === investmentAccount!.id && row.security_id === security!.id,
  );
  const positionValues = {
    quantity: toNumeric(input.quantity, 8),
    cost_basis: toNumeric(input.costBasis),
    as_of_date: input.asOfDate,
  };

  if (!holding) {
    holding = await insertRow<InvestmentHolding>(T.holdings, {
      investment_account_id: investmentAccount.id,
      security_id: security.id,
      ...positionValues,
    });
    data.holdings.push(holding);
  } else if (holding.as_of_date === null || input.asOfDate >= holding.as_of_date) {
    // Historical statements enrich history without rolling the current position
    // backward when they are imported out of order.
    const updated = await updateRow<InvestmentHolding>(T.holdings, holding.id, positionValues);
    Object.assign(holding, updated);
  }

  // 4. the dated price
  const existingPrice = data.securityPrices.find(
    (row) => row.security_id === security!.id && row.price_date === input.asOfDate,
  );
  if (existingPrice) {
    const updated = await updateRow<SecurityPrice>(T.securityPrices, existingPrice.id, {
      price: toNumeric(input.price, 8),
      source,
    });
    Object.assign(existingPrice, updated);
  } else {
    const created = await insertRow<SecurityPrice>(T.securityPrices, {
      security_id: security.id,
      price_date: input.asOfDate,
      price: toNumeric(input.price, 8),
      source,
    });
    data.securityPrices.push(created);
  }

  // 5. the dated snapshot for this position
  const marketValue = money(input.quantity.times(input.price));
  const snapshotValues = {
    quantity: toNumeric(input.quantity, 8),
    price: toNumeric(input.price, 8),
    market_value: toNumeric(marketValue),
    cost_basis: toNumeric(input.costBasis),
    source,
  };
  const existingSnapshot = data.investmentSnapshots.find(
    (row) =>
      row.investment_account_id === investmentAccount!.id &&
      row.security_id === security!.id &&
      row.snapshot_date === input.asOfDate,
  );
  if (existingSnapshot) {
    const updated = await updateRow<InvestmentSnapshot>(
      T.investmentSnapshots,
      existingSnapshot.id,
      snapshotValues,
    );
    Object.assign(existingSnapshot, updated);
  } else {
    const created = await insertRow<InvestmentSnapshot>(T.investmentSnapshots, {
      investment_account_id: investmentAccount.id,
      security_id: security.id,
      snapshot_date: input.asOfDate,
      ...snapshotValues,
    });
    data.investmentSnapshots.push(created);
  }

  await carryForwardPortfolio(data, investmentAccount, input.asOfDate, source);
  await syncAccountBalance(data, investmentAccount, input.asOfDate, source);
  return holding;
}

/** Keep each dated portfolio snapshot complete when one position is updated. */
async function carryForwardPortfolio(
  data: FinanceData,
  investmentAccount: InvestmentAccount,
  asOfDate: ISODate,
  source: string,
): Promise<void> {
  const holdings = data.holdings.filter(
    (row) => row.investment_account_id === investmentAccount.id,
  );

  for (const holding of holdings) {
    const exists = data.investmentSnapshots.some(
      (row) =>
        row.investment_account_id === investmentAccount.id &&
        row.security_id === holding.security_id &&
        row.snapshot_date === asOfDate,
    );
    if (exists) continue;

    const price = latestPrice(data, holding.security_id, asOfDate);
    const created = await insertRow<InvestmentSnapshot>(T.investmentSnapshots, {
      investment_account_id: investmentAccount.id,
      security_id: holding.security_id,
      snapshot_date: asOfDate,
      quantity: toNumeric(dec(holding.quantity), 8),
      price: toNumeric(price, 8),
      market_value: toNumeric(money(dec(holding.quantity).times(price))),
      cost_basis: toNumeric(money(holding.cost_basis)),
      source,
    });
    data.investmentSnapshots.push(created);
  }
}

/** The account's recorded balance follows the portfolio's value on that date. */
async function syncAccountBalance(
  data: FinanceData,
  investmentAccount: InvestmentAccount,
  asOfDate: ISODate,
  source: string,
): Promise<void> {
  const value = sumMoney(
    data.investmentSnapshots
      .filter(
        (row) =>
          row.investment_account_id === investmentAccount.id && row.snapshot_date === asOfDate,
      )
      .map((row) => row.market_value),
  );

  const existing = data.accountBalances.find(
    (row) => row.account_id === investmentAccount.account_id && row.balance_date === asOfDate,
  );

  if (existing) {
    const updated = await updateRow<AccountBalance>(T.accountBalances, existing.id, {
      balance: toNumeric(value),
      source,
    });
    Object.assign(existing, updated);
  } else {
    const created = await insertRow<AccountBalance>(T.accountBalances, {
      account_id: investmentAccount.account_id,
      balance_date: asOfDate,
      balance: toNumeric(value),
      source,
    });
    data.accountBalances.push(created);
  }
}

export interface InvestmentActivityInput {
  accountId: number;
  transactionDate: ISODate;
  transactionType: string;
  amount: Decimal;
  fees: Decimal;
  notes: string | null;
}

export async function recordInvestmentActivity(
  data: FinanceData,
  input: InvestmentActivityInput,
): Promise<InvestmentTransaction> {
  const investmentAccount = data.investmentAccounts.find(
    (row) => row.account_id === input.accountId,
  );
  if (!investmentAccount) {
    throw new Error("Add a holding for this account before recording activity against it.");
  }

  const row = await insertRow<InvestmentTransaction>(T.investmentTransactions, {
    investment_account_id: investmentAccount.id,
    security_id: null,
    transaction_date: input.transactionDate,
    transaction_type: input.transactionType,
    amount: toNumeric(input.amount),
    quantity: null,
    fees: toNumeric(input.fees),
    notes: input.notes,
  });
  data.investmentTransactions.push(row);
  return row;
}

// --- CSV import -------------------------------------------------------------

const REQUIRED_COLUMNS = ["account", "symbol", "quantity", "cost_basis", "price", "as_of_date"];

/** Minimal RFC 4180 reader: handles quoted fields containing commas and quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      // Absorb CRLF as one break, and skip blank lines.
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

export async function importHoldingsCsv(data: FinanceData, text: string): Promise<number> {
  // Strip a UTF-8 BOM, which Excel writes and which would otherwise corrupt the
  // first header name.
  const rows = parseCsv(text.replace(/^﻿/, ""));
  if (rows.length === 0) throw new Error("The holdings CSV contains no data rows.");

  const header = rows[0].map((name) => name.trim());
  const missing = REQUIRED_COLUMNS.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    throw new Error("CSV requires account, symbol, quantity, cost_basis, price, and as_of_date.");
  }

  const accountsByName = new Map(
    data.accounts.map((account) => [account.name.toLowerCase(), account]),
  );
  let count = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = index + 1;
    const cells = rows[index];
    const value = (name: string) => (cells[header.indexOf(name)] ?? "").trim();

    const account = accountsByName.get(value("account").toLowerCase());
    if (!account) {
      throw new Error(`Row ${rowNumber}: account name does not match a NexaFi account.`);
    }

    try {
      await upsertHolding(data, {
        accountId: account.id,
        taxTreatment: value("tax_treatment") || "taxable",
        symbol: value("symbol"),
        name: value("name") || value("symbol"),
        securityType: value("security_type") || "other",
        quantity: quantize(dec(value("quantity")), 8),
        costBasis: money(value("cost_basis")),
        price: quantize(dec(value("price")), 8),
        asOfDate: value("as_of_date") || todayISO(),
        source: "csv",
      });
    } catch (error) {
      throw new Error(`Row ${rowNumber}: ${error instanceof Error ? error.message : String(error)}`);
    }
    count += 1;
  }

  if (count === 0) throw new Error("The holdings CSV contains no data rows.");
  return count;
}

export { INVESTMENT_TYPES };
