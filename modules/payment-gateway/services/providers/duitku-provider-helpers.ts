import crypto from "crypto";
import type {
  ProviderConfig,
  TransactionStatus,
  WebhookResult,
} from "../provider-interface";

// Duitku memakai HMAC-SHA256 dengan API Key sebagai kunci; MD5 dinyatakan
// usang sejak April 2026 (docs.duitku.com/api/en, changelog).
function hmacSha256(stringToSign: string, apiKey: string) {
  return crypto.createHmac("sha256", apiKey).update(stringToSign).digest("hex");
}

export function createDuitkuInvoiceSignature(input: {
  merchantCode: string;
  merchantOrderId: string;
  paymentAmount: number;
  apiKey: string;
}) {
  return hmacSha256(
    `${input.merchantCode}${input.merchantOrderId}${input.paymentAmount}`,
    input.apiKey,
  );
}

export function createDuitkuStatusSignature(input: {
  merchantCode: string;
  merchantOrderId: string;
  apiKey: string;
}) {
  return hmacSha256(
    `${input.merchantCode}${input.merchantOrderId}`,
    input.apiKey,
  );
}

/**
 * Tanda tangan callback yang sah: HMAC-SHA256 saat ini, dan MD5 lama untuk
 * merchant yang belum dipindahkan Duitku. Keduanya berkunci API Key.
 */
export function createDuitkuWebhookSignatures(input: {
  merchantCode: string;
  amount: string;
  merchantOrderId: string;
  apiKey: string;
}) {
  const base = `${input.merchantCode}${input.amount}${input.merchantOrderId}`;
  return [
    hmacSha256(base, input.apiKey),
    crypto.createHash("md5").update(`${base}${input.apiKey}`).digest("hex"),
  ];
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
  // Callback Duitku hanya mengenal resultCode "00" (sukses) dan "01"
  // (gagal); "01" pada cek status berarti masih diproses, jadi pemetaan
  // mapDuitkuStatus tidak berlaku di sini.
  const status: WebhookResult["status"] =
    payload.resultCode === "00" ? "PAID" : "FAILED";

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
