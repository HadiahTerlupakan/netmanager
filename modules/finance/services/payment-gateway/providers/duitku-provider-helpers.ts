import crypto from "crypto";
import type {
  ProviderConfig,
  TransactionStatus,
  WebhookResult,
} from "../provider-interface";

export function createDuitkuInvoiceSignature(input: {
  merchantCode: string;
  merchantOrderId: string;
  paymentAmount: number;
  apiKey: string;
}) {
  return crypto
    .createHash("md5")
    .update(
      `${input.merchantCode}${input.merchantOrderId}${input.paymentAmount}${input.apiKey}`,
    )
    .digest("hex");
}

export function createDuitkuStatusSignature(input: {
  merchantCode: string;
  merchantOrderId: string;
  apiKey: string;
}) {
  return crypto
    .createHash("md5")
    .update(`${input.merchantCode}${input.merchantOrderId}${input.apiKey}`)
    .digest("hex");
}

export function createDuitkuWebhookSignature(input: {
  merchantCode: string;
  amount: string;
  merchantOrderId: string;
  apiKey: string;
}) {
  return crypto
    .createHash("md5")
    .update(
      `${input.merchantCode}${input.amount}${input.merchantOrderId}${input.apiKey}`,
    )
    .digest("hex");
}

export function mapDuitkuStatus(
  statusCode: string | undefined,
): TransactionStatus["status"] {
  switch (statusCode) {
    case "00":
      return "PAID";
    case "01":
      return "PENDING";
    case "02":
      return "EXPIRED";
    case "03":
      return "CANCELLED";
    default:
      return "FAILED";
  }
}

export function buildDuitkuWebhookResult(
  payload: Record<string, unknown>,
): WebhookResult {
  const status = mapDuitkuStatus(payload.resultCode as string | undefined);

  return {
    orderId: payload.merchantOrderId as string,
    status,
    ...(status === "PAID" ? { paidAt: new Date() } : {}),
    paymentMethod: payload.paymentCode as string,
    transactionId: payload.reference as string,
    amount: parseFloat(payload.amount as string),
    raw: payload,
  };
}

export function buildDuitkuTestResult(config: ProviderConfig) {
  return {
    success: true,
    message: "Connection successful",
    details: {
      merchantCode: config.merchantId || "",
      environment: config.isProduction ? "Production" : "Sandbox",
    },
  };
}
