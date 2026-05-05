/** Payment method value object */
export const PaymentMethod = {
  BANK_TRANSFER: "BANK_TRANSFER",
  VIRTUAL_ACCOUNT: "VIRTUAL_ACCOUNT",
  EWALLET: "EWALLET",
  CREDIT_CARD: "CREDIT_CARD",
  QRIS: "QRIS",
  RETAIL: "RETAIL",
  MANUAL_TRANSFER: "MANUAL_TRANSFER",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Normalize payment method dari berbagai provider */
export function normalizePaymentMethod(
  method?: string | null,
): PaymentMethod | null {
  if (!method) return null;

  const normalized = method.toUpperCase().replace(/[-_\s]/g, "_");

  if (normalized.includes("BANK") || normalized.includes("TRANSFER")) {
    return PaymentMethod.BANK_TRANSFER;
  }
  if (normalized.includes("VA") || normalized.includes("VIRTUAL")) {
    return PaymentMethod.VIRTUAL_ACCOUNT;
  }
  if (
    normalized.includes("WALLET") ||
    normalized.includes("OVO") ||
    normalized.includes("GOPAY") ||
    normalized.includes("DANA")
  ) {
    return PaymentMethod.EWALLET;
  }
  if (normalized.includes("CARD") || normalized.includes("CREDIT")) {
    return PaymentMethod.CREDIT_CARD;
  }
  if (normalized.includes("QRIS")) {
    return PaymentMethod.QRIS;
  }
  if (
    normalized.includes("RETAIL") ||
    normalized.includes("ALFAMART") ||
    normalized.includes("INDOMARET")
  ) {
    return PaymentMethod.RETAIL;
  }

  return null;
}
