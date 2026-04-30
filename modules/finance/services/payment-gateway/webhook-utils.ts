import { logger } from "@/lib/logger";
import { parseOptionalDate } from "@/lib/utils/server-datetime";
import type { PaymentMethod } from "@prisma/client-billing";
import type { WebhookResult } from "./provider-interface";

const PAYMENT_METHOD_MAP: Record<string, PaymentMethod> = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  BANK: "BANK_TRANSFER",
  VA: "BANK_TRANSFER",
  EWALLET: "E_WALLET",
  E_WALLET: "E_WALLET",
  CREDIT_CARD: "CREDIT_CARD",
  CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  CHECK: "CHECK",
  OTHER: "OTHER",
};

/** Parse JSON atau form-urlencoded payload webhook. */
export function parseWebhookPayload(rawBody: string, providerType: string) {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return parseFormPayload(rawBody, providerType);
  }
}

/** Ekstrak invoice IDs dari metadata notes payment. */
export function extractInvoiceIdsFromNotes(notes: string | null): string[] {
  if (!notes) {
    return [];
  }

  try {
    const metadata = JSON.parse(notes);
    if (!hasInvoiceIds(metadata)) {
      return [];
    }

    return metadata.invoiceIds.filter(isNonEmptyString);
  } catch (error) {
    logger.warn("[Webhook] Failed to parse payment notes metadata:", error);
    return [];
  }
}

/** Normalize nama metode pembayaran gateway ke enum billing. */
export function normalizePaymentMethod(paymentMethod: string | undefined) {
  if (!paymentMethod) {
    return undefined;
  }

  const normalized = paymentMethod.trim().toUpperCase().replace(/\s+/g, "_");
  return PAYMENT_METHOD_MAP[normalized] || undefined;
}

/** Cek mismatch nominal webhook terhadap payment tersimpan. */
export function hasAmountMismatch(
  storedAmount: bigint,
  webhookAmount: number | undefined,
) {
  if (webhookAmount === undefined || Number.isNaN(webhookAmount)) {
    return false;
  }

  return storedAmount !== BigInt(Math.round(webhookAmount));
}

/** Cek mismatch transaction ID webhook terhadap payment tersimpan. */
export function hasTransactionMismatch(
  storedTransactionId: string | null,
  webhookTransactionId: string | undefined,
) {
  if (!storedTransactionId || !webhookTransactionId) {
    return false;
  }

  return storedTransactionId !== webhookTransactionId;
}

/** Konversi unknown menjadi object record aman. */
export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

/** Konversi unknown menjadi string non-empty. */
export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

/** Parse tanggal webhook atau fallback ke sekarang. */
export function parseDateOrNow(value: unknown) {
  return typeof value === "string"
    ? (parseOptionalDate(value) ?? new Date())
    : new Date();
}

function parseFormPayload(rawBody: string, providerType: string) {
  try {
    const searchParams = new URLSearchParams(rawBody);
    const payload = Object.fromEntries(searchParams.entries());
    if (Object.keys(payload).length === 0 && rawBody.length > 0) {
      throw new Error("Fallback URLSearchParams yielded empty result");
    }
    return payload;
  } catch {
    logger.error(
      `[Webhook] Invalid body from ${providerType}: Not JSON or Form-Urlencoded`,
    );
    return null;
  }
}

function hasInvoiceIds(value: unknown): value is { invoiceIds: unknown[] } {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as { invoiceIds?: unknown }).invoiceIds),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export type GatewayStatusMap = Record<WebhookResult["status"], string>;
