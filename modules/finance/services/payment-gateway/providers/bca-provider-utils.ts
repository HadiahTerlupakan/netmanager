import crypto from "crypto";
import type { WebhookResult } from "../provider-interface";

export type BcaPaymentStatus = WebhookResult["status"];

/** Normalize status BCA menjadi status gateway internal. */
export function normalizeBcaStatus(input: {
  transactionStatus?: unknown;
  paidStatus?: unknown;
}) {
  if (input.transactionStatus === "PAID" || input.paidStatus === "Y") {
    return "PAID";
  }

  if (input.transactionStatus === "EXPIRED") {
    return "EXPIRED";
  }

  if (input.transactionStatus === "FAILED") {
    return "FAILED";
  }

  if (input.transactionStatus === "CANCELLED") {
    return "CANCELLED";
  }

  return "PENDING";
}

/** Generate signature request BCA API. */
export function generateBcaSignature(input: BcaSignatureInput) {
  const hashedBody = input.body
    ? crypto.createHash("sha256").update(input.body).digest("hex").toLowerCase()
    : "";
  const stringToSign = `${input.method}:${input.relativeUrl}:${input.accessToken}:${hashedBody}:${input.timestamp}`;

  return crypto
    .createHmac("sha256", input.apiSecret)
    .update(stringToSign)
    .digest("hex");
}

/** Cek signature webhook BCA dengan timing-safe comparison. */
export function verifyBcaWebhookSignature(input: {
  payload: Record<string, unknown>;
  signature: string;
  apiSecret: string;
}) {
  const expectedSignature = crypto
    .createHmac("sha256", input.apiSecret)
    .update(JSON.stringify(input.payload))
    .digest("hex");
  const source = Buffer.from(input.signature);
  const target = Buffer.from(expectedSignature);

  return (
    source.length === target.length && crypto.timingSafeEqual(source, target)
  );
}

type BcaSignatureInput = {
  method: string;
  relativeUrl: string;
  accessToken: string;
  body: string;
  timestamp: string;
  apiSecret: string;
};
