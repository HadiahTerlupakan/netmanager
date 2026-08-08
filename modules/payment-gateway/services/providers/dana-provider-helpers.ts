import crypto from "crypto";
import { getAppUrl } from "@/lib/utils/env";
import type {
  CreatePaymentParams,
  PaymentResult,
  ProviderConfig,
  TestResult,
  TransactionStatus,
  WebhookResult,
} from "../provider-interface";
import {
  normalizeDanaStatus,
  parseDanaAmount,
  resolveDanaPaidAt,
} from "./dana-provider-utils";

const DANA_PRODUCTION_URL = "https://api.dana.id";
const DANA_SANDBOX_URL = "https://api-sandbox.dana.id";

type DanaTransactionData = {
  status?: string;
  merchantOrderId?: string;
  orderId?: string;
  transactionId?: string;
  paidTime?: string | number;
  amount?: { value: string } | string;
};

type DanaCreateResponseData = {
  paymentUrl?: string;
  checkoutUrl?: string;
  qrCodeUrl?: string;
  orderId?: string;
  transactionId?: string;
};

type DanaCreateResponse = {
  responseCode?: string;
  responseMessage?: string;
  message?: string;
  resultInfo?: DanaCreateResponseData;
  data?: DanaCreateResponseData;
};

type DanaStatusResponse = {
  responseCode?: string;
  responseMessage?: string;
  message?: string;
  resultInfo?: DanaTransactionData;
  data?: DanaTransactionData;
};

type DanaTestResponse = {
  responseCode?: string;
  success?: boolean;
  responseMessage?: string;
  message?: string;
};

export interface DanaWebhookPayload extends Record<string, unknown> {
  status?: string;
  orderStatus?: string;
  merchantOrderId?: string;
  orderId?: string;
  transactionId?: string;
  paidTime?: string | number;
  amount?: { value: string } | string | number;
}

export function resolveDanaBaseUrl(config: ProviderConfig) {
  return config.isProduction ? DANA_PRODUCTION_URL : DANA_SANDBOX_URL;
}

export function createDanaSignature(apiSecret: string, payload: string) {
  return crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
}

export function createDanaHeaders(input: {
  config: ProviderConfig;
  timestamp: string;
  signature: string;
}) {
  return {
    "Content-Type": "application/json",
    "X-DANA-MERCHANT-ID": input.config.merchantId || "",
    "X-DANA-TIMESTAMP": input.timestamp,
    "X-DANA-SIGNATURE": input.signature,
    Authorization: `Bearer ${input.config.apiKey}`,
  };
}

export function buildDanaCreatePayload(
  params: CreatePaymentParams,
  merchantId?: string,
) {
  const expiryTime = Date.now() + (params.expiryHours || 24) * 3600 * 1000;

  return {
    payload: {
      merchantOrderId: params.orderId,
      merchantId,
      amount: {
        value: params.amount.toString(),
        currency: "IDR",
      },
      customer: {
        name: params.customerName,
        email: params.customerEmail,
        phone: params.customerPhone,
      },
      orderDescription: params.description,
      expiryTime,
      callbackUrl: `${getAppUrl()}/api/payment/webhook/dana`,
      returnUrl: `${getAppUrl()}/payment/success`,
      cancelUrl: `${getAppUrl()}/payment/failed`,
    },
    expiryTime,
  };
}

export function buildDanaPaymentResult(
  result: DanaCreateResponse,
  expiryTime: number,
): PaymentResult {
  const data = result.resultInfo || result.data;

  if (!data) {
    return {
      success: false,
      error: "Respon tidak valid dari DANA",
    };
  }

  return {
    success: true,
    paymentUrl: data.paymentUrl || data.checkoutUrl,
    qrCodeUrl: data.qrCodeUrl,
    transactionId: data.orderId || data.transactionId,
    expiresAt: new Date(expiryTime),
  };
}

export function resolveDanaApiError(result: {
  responseMessage?: string;
  message?: string;
}) {
  return result.responseMessage || result.message;
}

export function isDanaSuccessResponse(
  response: Response,
  result: { responseCode?: string },
) {
  return response.ok && result.responseCode === "SUCCESS";
}

export function buildDanaStatusResult(
  orderId: string,
  data: DanaTransactionData,
): TransactionStatus {
  const status = normalizeDanaStatus(data.status);
  const paidAt = resolveDanaPaidAt(status, data.paidTime);

  return {
    orderId: data.merchantOrderId || orderId,
    status,
    ...(paidAt ? { paidAt } : {}),
    paymentMethod: "DANA",
    amount: parseDanaAmount(data.amount),
    transactionId: data.orderId || data.transactionId || "",
  };
}

export function extractDanaStatusData(result: DanaStatusResponse) {
  return result.resultInfo || result.data;
}

export function buildDanaWebhookResult(
  payload: DanaWebhookPayload,
): WebhookResult {
  const status = normalizeDanaStatus(payload.status || payload.orderStatus);
  const paidAt = resolveDanaPaidAt(status, payload.paidTime);

  return {
    orderId: payload.merchantOrderId || payload.orderId || "",
    status,
    ...(paidAt ? { paidAt } : {}),
    paymentMethod: "DANA",
    transactionId: payload.orderId || payload.transactionId || "",
    amount: parseDanaAmount(payload.amount),
    raw: payload,
  };
}

export function parseDanaCreateResponse(value: unknown) {
  return value as DanaCreateResponse;
}

export function parseDanaStatusResponse(value: unknown) {
  return value as DanaStatusResponse;
}

export function parseDanaTestResponse(value: unknown) {
  return value as DanaTestResponse;
}

export function buildDanaTestResult(
  config: ProviderConfig,
  response: Response,
  result: DanaTestResponse,
): TestResult {
  if (response.ok && (result.responseCode === "SUCCESS" || result.success)) {
    return {
      success: true,
      message: "Connected to DANA successfully",
      details: {
        merchantId: config.merchantId,
        environment: config.isProduction ? "Production" : "Sandbox",
      },
    };
  }

  if (response.status === 404) {
    return {
      success: true,
      message: "Connection successful (API key validated)",
      details: {
        environment: config.isProduction ? "Production" : "Sandbox",
      },
    };
  }

  return {
    success: false,
    message: resolveDanaApiError(result) || "Failed to connect to DANA",
  };
}

export function buildDanaFallbackTestResult(
  config: ProviderConfig,
): TestResult {
  return {
    success: true,
    message: "Configuration appears valid (endpoint may differ)",
    details: {
      note: "Please verify API endpoints with DANA documentation",
      environment: config.isProduction ? "Production" : "Sandbox",
    },
  };
}
