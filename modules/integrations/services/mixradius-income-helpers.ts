import {
  DUITKU_DEFAULT_FEES,
  normalizePaymentMethod,
} from "@/modules/integrations/constants/DuitkuDefaults";

import type {
  MixRadiusIncomePeriodRecord,
  MixRadiusIncomeSummary,
} from "./mixradius-types";

const MONTH_COUNT = 12;
const DEFAULT_NUMBER = 0;

export function isMixRadiusConfigErrorMessage(message: string) {
  return (
    message.includes("konfigurasi") ||
    message.includes("valid") ||
    message.includes("Missing credentials")
  );
}

export function parseIncomeValue(value: string | number | undefined): number {
  if (!value) return DEFAULT_NUMBER;
  if (typeof value === "number") return value;

  return (
    parseFloat(
      String(value)
        .trim()
        .replace(/Rp\.?\s?/i, "")
        .replace(/,/g, ""),
    ) || DEFAULT_NUMBER
  );
}

export function parseLocalizedValue(
  value: string | number | undefined,
): number {
  if (!value) return DEFAULT_NUMBER;

  let normalizedValue = String(value)
    .trim()
    .replace(/Rp\.?\s?/i, "");
  if (normalizedValue.includes(",")) {
    normalizedValue = normalizedValue.replace(/\./g, "").replace(",", ".");
  } else if ((normalizedValue.match(/\./g) || []).length > 1) {
    normalizedValue = normalizedValue.replace(/\./g, "");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalizedValue)) {
    normalizedValue = normalizedValue.replace(/\./g, "");
  }

  return parseFloat(normalizedValue.replace(/[^0-9.-]/g, "")) || DEFAULT_NUMBER;
}

export function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function calculateInlineSummary(
  data: MixRadiusIncomePeriodRecord[],
): MixRadiusIncomeSummary {
  let totalProfit = DEFAULT_NUMBER;
  let totalFee = DEFAULT_NUMBER;
  let totalPlusPpn = DEFAULT_NUMBER;

  data.forEach((item) => {
    const total = parseIncomeValue(item.total);
    const fee = parseIncomeValue(item.seller_fee);
    const price = parseIncomeValue(item.price);
    const tax = parseIncomeValue(item.tax);

    totalPlusPpn += total;
    totalFee += fee;
    totalProfit += price > 0 ? price : total - tax - fee;
  });

  return buildIncomeSummary(totalProfit, totalFee, totalPlusPpn, data.length);
}

export function calculateEstimatedSummary(
  data: MixRadiusIncomePeriodRecord[],
  recordsFiltered: number,
): MixRadiusIncomeSummary {
  let totalProfit = DEFAULT_NUMBER;
  let totalFee = DEFAULT_NUMBER;
  let totalPlusPpn = DEFAULT_NUMBER;

  data.forEach((item) => {
    const total = parseLocalizedValue(item.total);
    const price = parseLocalizedValue(item.price);
    const tax = parseLocalizedValue(item.tax);
    const estimatedFee = calculateEstimatedFee(
      item.payment_method || "",
      total,
    );

    totalPlusPpn += total;
    totalFee += estimatedFee;
    totalProfit +=
      price > 0 ? price - estimatedFee : total - tax - estimatedFee;
  });

  return buildIncomeSummary(
    totalProfit,
    totalFee,
    totalPlusPpn,
    recordsFiltered,
  );
}

export function parseProfitArray(html: string, regex: RegExp): number[] {
  const match = html.match(regex);
  if (!match || !match[1]) {
    return Array(MONTH_COUNT).fill(DEFAULT_NUMBER);
  }

  return match[1]
    .split(",")
    .map(
      (value: string) =>
        parseFloat(value.replace(/['"]/g, "")) || DEFAULT_NUMBER,
    );
}

function calculateEstimatedFee(paymentMethod: string, total: number) {
  const methodCode = normalizePaymentMethod(paymentMethod);
  const feeConfig = methodCode ? DUITKU_DEFAULT_FEES[methodCode] : undefined;
  if (!feeConfig) {
    return DEFAULT_NUMBER;
  }

  return feeConfig.type === "FIXED"
    ? feeConfig.value
    : Math.ceil(total * (feeConfig.value / 100));
}

function buildIncomeSummary(
  totalProfit: number,
  totalFee: number,
  totalPlusPpn: number,
  transactionCount: number,
): MixRadiusIncomeSummary {
  return {
    profit: formatIdr(totalProfit),
    feeSeller: formatIdr(totalFee),
    totalPlusPpn: formatIdr(totalPlusPpn),
    totalTransactions: transactionCount.toString(),
  };
}
