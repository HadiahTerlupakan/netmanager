import type { PaymentStatus } from "../value-objects/PaymentStatus";
import type { ProviderType } from "../value-objects/ProviderType";
import type { PaymentMethod } from "../value-objects/PaymentMethod";

/** Pure domain entity for payment gateway transaction */
export interface PaymentGatewayTransaction {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: ProviderType;
  transactionId?: string | null;
  paymentUrl?: string | null;
  paymentMethod?: PaymentMethod | null;
  qrCodeUrl?: string | null;
  vaNumber?: string | null;
  bankCode?: string | null;
  expiresAt?: Date | null;
  paidAt?: Date | null;
  tenantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
