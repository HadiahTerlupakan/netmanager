import type { TransactionStatus, WebhookResult } from "../provider-interface";

const SUCCESS_STATUSES = ["SUCCESS", "PAID", "COMPLETED"];
const PENDING_STATUSES = ["PENDING", "PROCESSING"];
const EXPIRED_STATUSES = ["EXPIRED", "TIMEOUT"];
const CANCELLED_STATUSES = ["CANCELLED", "CANCELED"];
const FAILED_STATUSES = ["FAILED", "ERROR"];

/** Normalize status DANA menjadi status gateway internal. */
export function normalizeDanaStatus(status: string | undefined) {
  if (SUCCESS_STATUSES.includes(status ?? "")) {
    return "PAID";
  }

  if (PENDING_STATUSES.includes(status ?? "")) {
    return "PENDING";
  }

  if (EXPIRED_STATUSES.includes(status ?? "")) {
    return "EXPIRED";
  }

  if (CANCELLED_STATUSES.includes(status ?? "")) {
    return "CANCELLED";
  }

  if (FAILED_STATUSES.includes(status ?? "")) {
    return "FAILED";
  }

  return "PENDING";
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
