import { logger } from "@/lib/logger";
import { fetchWithTimeout } from "./fetch-with-timeout";
import crypto from "crypto";
import type {
  CreatePaymentParams,
  ProviderConfig,
  WebhookResult,
} from "../provider-interface";
import { buildVirtualAccountWebhookResult } from "./virtual-account-provider-helper";

const BCA_PRODUCTION_URL = "https://api.bca.co.id";
const BCA_SANDBOX_URL = "https://sandbox.bca.co.id/api";
const BCA_PAYMENT_URL = "/va/payments";

export type BcaPaymentStatus = WebhookResult["status"];

export function resolveBcaBaseUrl(isProduction: boolean) {
  return isProduction ? BCA_PRODUCTION_URL : BCA_SANDBOX_URL;
}

export function createBcaBasicAuthorization(input: {
  clientKey?: string;
  apiSecret?: string;
}) {
  return `Basic ${Buffer.from(`${input.clientKey}:${input.apiSecret}`).toString("base64")}`;
}

export function buildBcaCreatePaymentBody(
  params: CreatePaymentParams,
  config: ProviderConfig,
  expiryDate: Date,
) {
  return {
    CompanyCode: config.merchantId,
    PrimaryAccountNumber: params.orderId.substring(0, 12),
    CorporateID: config.merchantId,
    CustomerID: params.orderId,
    CustomerName: params.customerName.substring(0, 50),
    ExpiredDate: (expiryDate.toISOString().split("T")[0] ?? "").replace(
      /-/g,
      "",
    ),
    TotalAmount: {
      Value: params.amount.toFixed(2),
      Currency: "IDR",
    },
    AdditionalInfo: {
      Description: params.description.substring(0, 100),
    },
  };
}

export function buildBcaStatusUrl(
  merchantId: string | undefined,
  orderId: string,
) {
  return `${BCA_PAYMENT_URL}/${merchantId}/${orderId}`;
}

export function buildBcaHeaders(input: {
  accessToken: string;
  apiKey?: string;
  timestamp: string;
  signature: string;
  correlationId: string;
}) {
  return {
    Authorization: `Bearer ${input.accessToken}`,
    "X-BCA-Key": input.apiKey || "",
    "X-BCA-Timestamp": input.timestamp,
    "X-BCA-Signature": input.signature,
    "X-BCA-CorrelationID": input.correlationId,
  };
}

export async function getBcaAccessToken(input: {
  baseUrl: string;
  config: ProviderConfig;
}) {
  try {
    return await requestBcaAccessToken(input);
  } catch (error: unknown) {
    logger.error("BCA getAccessToken error:", error);
    throw error;
  }
}

async function requestBcaAccessToken(input: {
  baseUrl: string;
  config: ProviderConfig;
}) {
  const response = await fetchWithTimeout(`${input.baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: createBcaBasicAuthorization(input.config),
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    throw new Error("Failed to get BCA access token");
  }
  return ((await response.json()) as { access_token: string }).access_token;
}

export function buildBcaWebhookPaymentResult(payload: Record<string, unknown>) {
  const orderId =
    (payload.CustomerID as string) || (payload.TransactionID as string);
  const status = normalizeBcaStatus({
    transactionStatus: payload.TransactionStatus,
    paidStatus: payload.PaidStatus,
  });

  return buildVirtualAccountWebhookResult({
    orderId,
    status,
    paidAt: payload.PaidDate as string | undefined,
    paymentMethod: "BCA Virtual Account",
    transactionId: payload.TransactionID as string,
    amount: (payload.TotalAmount as { Value?: string })?.Value,
    raw: payload,
  });
}

export function normalizeBcaStatus(input: {
  transactionStatus?: unknown;
  paidStatus?: unknown;
}): BcaPaymentStatus {
  if (input.transactionStatus === "PAID" || input.paidStatus === "Y") {
    return "PAID";
  }
  return BCA_STATUS_MAP[input.transactionStatus as string] ?? "PENDING";
}

const BCA_STATUS_MAP: Record<string, BcaPaymentStatus> = {
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
};

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
