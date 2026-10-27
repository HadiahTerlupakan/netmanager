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

function md5(text: string) {
  return crypto.createHash("md5").update(text).digest("hex");
}

/**
 * Tanda tangan permintaan, dicoba berurutan: HMAC-SHA256 lalu MD5 lama.
 * Sandbox Duitku masih menolak HMAC dengan "Wrong signature" untuk merchant
 * yang belum dipindahkan (terlihat 2026-10-27), meski dokumentasinya sudah
 * hanya memuat HMAC.
 */
export function createDuitkuInvoiceSignatures(input: {
  merchantCode: string;
  merchantOrderId: string;
  paymentAmount: number;
  apiKey: string;
}) {
  const base = `${input.merchantCode}${input.merchantOrderId}${input.paymentAmount}`;
  return [hmacSha256(base, input.apiKey), md5(`${base}${input.apiKey}`)];
}

export function createDuitkuStatusSignatures(input: {
  merchantCode: string;
  merchantOrderId: string;
  apiKey: string;
}) {
  const base = `${input.merchantCode}${input.merchantOrderId}`;
  return [hmacSha256(base, input.apiKey), md5(`${base}${input.apiKey}`)];
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
  return [hmacSha256(base, input.apiKey), md5(`${base}${input.apiKey}`)];
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
