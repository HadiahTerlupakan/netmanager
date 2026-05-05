import type { PaymentGatewayTransaction } from "../entities/PaymentGatewayTransaction";

/** Repository port for payment gateway transaction persistence */
export interface IPaymentGatewayRepository {
  save(tx: PaymentGatewayTransaction): Promise<void>;
  findByOrderId(
    orderId: string,
    tenantId?: string | null,
  ): Promise<PaymentGatewayTransaction | null>;
  findByTransactionId(
    transactionId: string,
    tenantId?: string | null,
  ): Promise<PaymentGatewayTransaction | null>;
  findByOrderIdOrTransactionId(params: {
    orderId: string;
    transactionId?: string | null;
    tenantId?: string | null;
  }): Promise<PaymentGatewayTransaction | null>;
  updateStatus(id: string, status: string, paidAt?: Date): Promise<void>;
  updateTransactionDetails(params: {
    id: string;
    transactionId?: string | null;
    paymentMethod?: string | null;
    paidAt?: Date | null;
  }): Promise<void>;
}
