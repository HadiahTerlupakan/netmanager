import { getAppUrl } from "@/lib/utils/env";
import type {
  PaymentResult,
  TransactionStatus,
  WebhookResult,
} from "../provider-interface";

const DEFAULT_EXPIRY_HOURS = 24;

type StandardPaymentStatus = TransactionStatus["status"];

type BuildPaymentResultInput = {
  transactionId?: string;
  fallbackTransactionId: string;
  vaNumber?: string;
  paymentPath: string;
  expiresAt: Date;
};

type BuildStatusResultInput = {
  orderId: string;
  status: StandardPaymentStatus;
  paidAt?: string;
  paymentMethod: string;
  amount?: string;
  transactionId?: string;
};

type BuildWebhookResultInput = {
  orderId: string;
  status: StandardPaymentStatus;
  paidAt?: string;
  paymentMethod: string;
  amount?: string;
  transactionId?: string;
  raw: Record<string, unknown>;
};

/**
 * Create default expiry date for virtual account providers.
 */
export function createVirtualAccountExpiryDate(expiryHours?: number): Date {
  const resolvedExpiryHours = expiryHours ?? DEFAULT_EXPIRY_HOURS;
  const expiryDate = new Date();

  expiryDate.setHours(expiryDate.getHours() + resolvedExpiryHours);
  return expiryDate;
}

/**
 * Build normalized virtual account payment result.
 */
export function buildVirtualAccountPaymentResult(
  input: BuildPaymentResultInput,
): PaymentResult {
  const appUrl = getAppUrl();

  return {
    success: true,
    transactionId: input.transactionId ?? input.fallbackTransactionId,
    vaNumber: input.vaNumber,
    paymentUrl: `${appUrl}${input.paymentPath}`,
    expiresAt: input.expiresAt,
  };
}

/**
 * Build normalized transaction status response.
 */
export function buildVirtualAccountStatusResult(
  input: BuildStatusResultInput,
): TransactionStatus {
  return {
    orderId: input.orderId,
    status: input.status,
    ...(input.paidAt ? { paidAt: new Date(input.paidAt) } : {}),
    paymentMethod: input.paymentMethod,
    amount: Number.parseFloat(input.amount ?? "0"),
    transactionId: input.transactionId,
  };
}

/**
 * Build normalized webhook response for virtual account providers.
 */
export function buildVirtualAccountWebhookResult(
  input: BuildWebhookResultInput,
): WebhookResult {
  return {
    orderId: input.orderId,
    status: input.status,
    ...(input.paidAt ? { paidAt: new Date(input.paidAt) } : {}),
    paymentMethod: input.paymentMethod,
    transactionId: input.transactionId,
    amount: Number.parseFloat(input.amount ?? "0"),
    raw: input.raw,
  };
}
