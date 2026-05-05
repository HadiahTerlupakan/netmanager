/** Payment filter types for service layer - no Prisma dependency */

import type { GatewayPaymentStatus } from "@prisma/client-billing";

export type PaymentWhereInput = {
  receiptUrl?: { not: null };
  createdAt?: { gte: Date; lte: Date };
  gatewayStatus?: GatewayPaymentStatus | { in: GatewayPaymentStatus[] };
  pelangganId?: { in: string[] };
};
