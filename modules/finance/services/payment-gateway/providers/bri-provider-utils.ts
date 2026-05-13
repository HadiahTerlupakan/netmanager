import crypto from "crypto";
import type { TransactionStatus } from "../provider-interface";
import { timingSafeCompare } from "./signature-compare.helpers";

const BRI_PAID_STATUS = "PAID";
const BRI_EXPIRED_STATUS = "EXPIRED";
const BRI_PENDING_STATUS = "PENDING";

export function resolveBriBaseUrl(isProduction: boolean) {
  return isProduction
    ? "https://api.bri.co.id"
    : "https://sandbox.partner.api.bri.co.id";
}

export function createBriBasicAuthorization(input: {
  clientKey?: string;
  apiSecret?: string;
}) {
  return `Basic ${Buffer.from(`${input.clientKey}:${input.apiSecret}`).toString("base64")}`;
}

export function generateBriSignature(input: BRIRequestSignatureInput) {
  const hashedBody = crypto
    .createHash("sha256")
    .update(input.body)
    .digest("hex")
    .toLowerCase();
  const stringToSign = `${input.method}:${input.url}:${hashedBody}:${input.accessToken}:${input.timestamp}`;

  return crypto
    .createHmac("sha256", input.apiSecret)
    .update(stringToSign)
    .digest("base64");
}

export function normalizeBriStatus(input: {
  statusBayar?: unknown;
  status?: unknown;
}): TransactionStatus["status"] {
  if (input.statusBayar === "Y" || input.status === BRI_PAID_STATUS) {
    return BRI_PAID_STATUS;
  }

  if (input.status === BRI_EXPIRED_STATUS) {
    return BRI_EXPIRED_STATUS;
  }

  return BRI_PENDING_STATUS;
}

export function verifyBriWebhookSignature(input: {
  payload: Record<string, unknown>;
  signature: string;
  timestamp: string;
  apiSecret: string;
}) {
  const expectedSignature = generateBriSignature({
    method: "POST",
    url: "/webhook/bri",
    accessToken: "",
    body: JSON.stringify(input.payload),
    timestamp: input.timestamp,
    apiSecret: input.apiSecret,
  });

  return timingSafeCompare(expectedSignature, input.signature);
}

export function buildBriWebhookResult(payload: Record<string, unknown>) {
  return {
    orderId: (payload.custCode as string) || (payload.brivaNo as string) || "",
    status: normalizeBriStatus({
      statusBayar: payload.statusBayar,
      status: payload.status,
    }),
    paidAt: payload.paymentDate as string | undefined,
    paymentMethod: "BRI Virtual Account",
    transactionId: payload.trxId as string,
    amount: payload.amount as string | undefined,
    raw: payload,
  };
}

type BRIRequestSignatureInput = {
  method: string;
  url: string;
  accessToken: string;
  body: string;
  timestamp: string;
  apiSecret: string;
};
