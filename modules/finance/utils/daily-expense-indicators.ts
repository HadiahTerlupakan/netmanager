interface DailyExpenseIndicatorInput {
  date: string;
  amount: string;
  category: string;
  siteId: string | null;
  description: string | null;
  invoiceNumber: string | null;
  invoiceFile: string | null;
}

export interface DailyExpenseIndicators {
  suspectedDuplicateCount: number;
  pendingVerificationCount: number;
}

function normalizeText(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toISOString().slice(0, 10);
}

function buildDuplicateKey(item: DailyExpenseIndicatorInput): string {
  const siteScope = item.siteId || "general";
  const invoiceNumber = normalizeText(item.invoiceNumber);

  if (invoiceNumber) {
    return [siteScope, item.category, item.amount, invoiceNumber].join("|");
  }

  return [
    normalizeDate(item.date),
    siteScope,
    item.category,
    item.amount,
    normalizeText(item.description),
  ].join("|");
}

export function buildDailyExpenseIndicators(
  data: DailyExpenseIndicatorInput[],
): DailyExpenseIndicators {
  const duplicateCountMap = new Map<string, number>();
  let pendingVerificationCount = 0;

  for (const item of data) {
    duplicateCountMap.set(
      buildDuplicateKey(item),
      (duplicateCountMap.get(buildDuplicateKey(item)) ?? 0) + 1,
    );
    if (!hasInvoiceEvidence(item)) {
      pendingVerificationCount += 1;
    }
  }

  return {
    suspectedDuplicateCount: countSuspectedDuplicates(duplicateCountMap),
    pendingVerificationCount,
  };
}

function hasInvoiceEvidence(item: DailyExpenseIndicatorInput) {
  return (
    normalizeText(item.invoiceNumber).length > 0 ||
    normalizeText(item.invoiceFile).length > 0
  );
}

function countSuspectedDuplicates(countMap: Map<string, number>) {
  let count = 0;
  for (const occurrences of countMap.values()) {
    if (occurrences > 1) count += occurrences - 1;
  }
  return count;
}
