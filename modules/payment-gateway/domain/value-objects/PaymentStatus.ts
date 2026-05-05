/** Payment status value object */
export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export function isValidPaymentStatus(status: string): status is PaymentStatus {
  return Object.values(PaymentStatus).includes(status as PaymentStatus);
}
