/**
 * Klasifikasi error pengiriman email berdasarkan kode SMTP / properti error
 * dari nodemailer. Output dipakai untuk:
 * - Menyimpan kategori di EmailDeliveryLog (kolom errorCategory).
 * - Menjadi basis keputusan retry (TRANSIENT vs PERMANENT).
 * - Menggantikan stack trace dengan pesan aman sebelum disimpan ke DB.
 */
export type EmailErrorCategory =
  | "TRANSIENT"
  | "AUTH"
  | "INVALID_RECIPIENT"
  | "CONFIG"
  | "PERMANENT"
  | "UNKNOWN";

export interface ClassifiedEmailError {
  category: EmailErrorCategory;
  safeMessage: string;
  retryable: boolean;
}

const SAFE_MESSAGES: Record<EmailErrorCategory, string> = {
  TRANSIENT: "SMTP transient error — kirim ulang nanti",
  AUTH: "Autentikasi SMTP gagal",
  INVALID_RECIPIENT: "Alamat penerima ditolak SMTP server",
  CONFIG: "Konfigurasi SMTP tidak valid",
  PERMANENT: "SMTP menolak pesan secara permanen",
  UNKNOWN: "Pengiriman email gagal",
};

const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNECTION",
  "ECONNRESET",
  "ESOCKET",
  "EDNS",
  "EAI_AGAIN",
]);

const AUTH_CODES = new Set(["EAUTH"]);
const INVALID_RECIPIENT_CODES = new Set(["EENVELOPE"]);
const CONFIG_CODES = new Set(["EMESSAGE", "ESTREAM"]);

interface NormalizedError {
  code?: string;
  responseCode?: number;
  message: string;
}

/** Classify error untuk delivery log + retry decision. */
export function classifyEmailError(error: unknown): ClassifiedEmailError {
  const normalized = normalizeError(error);
  const category = resolveCategory(normalized);
  return {
    category,
    safeMessage: SAFE_MESSAGES[category],
    retryable: category === "TRANSIENT",
  };
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    const errWithProps = error as Error & {
      code?: unknown;
      responseCode?: unknown;
    };
    return {
      code:
        typeof errWithProps.code === "string" ? errWithProps.code : undefined,
      responseCode:
        typeof errWithProps.responseCode === "number"
          ? errWithProps.responseCode
          : undefined,
      message: error.message,
    };
  }
  return { message: typeof error === "string" ? error : "Unknown email error" };
}

function resolveCategory(err: NormalizedError): EmailErrorCategory {
  if (err.code) {
    if (TRANSIENT_CODES.has(err.code)) return "TRANSIENT";
    if (AUTH_CODES.has(err.code)) return "AUTH";
    if (INVALID_RECIPIENT_CODES.has(err.code)) return "INVALID_RECIPIENT";
    if (CONFIG_CODES.has(err.code)) return "CONFIG";
  }

  if (err.responseCode) {
    if (err.responseCode >= 400 && err.responseCode < 500) return "TRANSIENT";
    if (err.responseCode >= 500 && err.responseCode < 600) {
      return err.responseCode === 535 ? "AUTH" : "PERMANENT";
    }
  }

  return "UNKNOWN";
}
