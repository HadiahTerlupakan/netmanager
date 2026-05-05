import type { TransactionStatus, WebhookResult } from "../provider-interface";

const SUCCESS_STATUSES = ["SUCCESS", "PAID", "COMPLETED"];
const PENDING_STATUSES = ["PENDING", "PROCESSING"];
const EXPIRED_STATUSES = ["EXPIRED", "TIMEOUT"];
const CANCELLED_STATUSES = ["CANCELLED", "CANCELED"];
const FAILED_STATUSES = ["FAILED", "ERROR"];

const DANA_STATUS_GROUPS: Array<{
  statuses: readonly string[];
  result: TransactionStatus["status"];
}> = [
  { statuses: SUCCESS_STATUSES, result: "PAID" },
  { statuses: PENDING_STATUSES, result: "PENDING" },
  { statuses: EXPIRED_STATUSES, result: "EXPIRED" },
  { statuses: CANCELLED_STATUSES, result: "CANCELLED" },
  { statuses: FAILED_STATUSES, result: "FAILED" },
];

/** Normalize status DANA menjadi status gateway internal. */
export function normalizeDanaStatus(
  status: string | undefined,
): TransactionStatus["status"] {
  const normalized = status ?? "";
  const match = DANA_STATUS_GROUPS.find((group) =>
    group.statuses.includes(normalized),
  );
  return match?.result ?? "PENDING";
}

/** Ambil nilai amount dari response DANA. */
export function parseDanaAmount(
  amount: { value?: string } | string | number | undefined,
) {
  if (typeof amount === "object" && amount !== null) {
    return parseFloat(amount.value ?? "0");
  }

  if (typeof amount === "string" || typeof amount === "number") {
    return parseFloat(String(amount));
  }

  return 0;
}

/** Bangun paidAt dari status dan paidTime DANA. */
export function resolveDanaPaidAt(
  status: TransactionStatus["status"] | WebhookResult["status"],
  paidTime?: string | number,
) {
  if (paidTime) {
    return new Date(paidTime);
  }

  return status === "PAID" ? new Date() : undefined;
}
