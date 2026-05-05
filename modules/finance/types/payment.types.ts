/** Payment filter types for service layer - no Prisma dependency */

export type GatewayPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED";

export type PaymentWhereInput = {
  receiptUrl?: { not: null };
  createdAt?: { gte: Date; lte: Date };
  gatewayStatus?: GatewayPaymentStatus | { in: GatewayPaymentStatus[] };
  pelangganId?: { in: string[] };
};
