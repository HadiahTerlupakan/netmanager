import { parseProfitArray } from "./mixradius-income-helpers";
import type { MixRadiusOwner } from "./mixradius-types";

const EMPTY_OWNER_ID = "0";
const EMPTY_STATE_ARRAY = Array(12).fill(0);

export type MixRadiusProfitReport = {
  income: number[];
  transactions: number[];
  sellerFees: number[];
  taxes: number[];
};

export function parseOwnerOptions(html: string): MixRadiusOwner[] {
  const optionsHtml =
    html.match(/<select[^>]*name="owner_id"[^>]*>([\s\S]*?)<\/select>/i)?.[1] ||
    "";

  return Array.from(
    optionsHtml.matchAll(
      /<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/gi,
    ),
  )
    .map((match) => ({
      id: match[1],
      name: match[2]?.trim() || "",
    }))
    .filter((owner) => owner.id && owner.id !== EMPTY_OWNER_ID && owner.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function parseProfitReport(html: string): MixRadiusProfitReport {
  const income = parseProfitArray(html, /var\s+income\s*=\s*\[(.*?)\];/);
  return {
    income,
    transactions: parseTransactionArray(html),
    sellerFees: parseProfitArray(html, /var\s+sellerfee\s*=\s*\[(.*?)\];/),
    taxes: parseProfitArray(html, /var\s+tax\s*=\s*\[(.*?)\];/),
  };
}

function parseTransactionArray(html: string) {
  const transactionPatterns = [
    /var\s+trx\s*=\s*\[(.*?)\];/,
    /var\s+transaction\s*=\s*\[(.*?)\];/,
    /var\s+count\s*=\s*\[(.*?)\];/,
  ];

  for (const pattern of transactionPatterns) {
    const transactionValues = parseProfitArray(html, pattern);
    if (transactionValues.some((value) => value !== 0)) {
      return transactionValues;
    }
  }

  return [...EMPTY_STATE_ARRAY];
}
