import type { Job } from "bullmq";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { logger } from "@/lib/logger";
import { notifyPaymentReviewRequired } from "../NotificationService";

const SOURCE = "PaymentReviewHandler";
const REVIEW_REASONS = new Set(["AMOUNT_MISMATCH", "TRANSACTION_MISMATCH"]);

/**
 * PAYMENT_REVIEW_REQUIRED → notifikasi admin (in-app, realtime, push) untuk
 * staf yang memegang `payment_gateway:read` di tenant pembayaran itu. Tanpa
 * tenant tidak ada penerima yang aman (bisa bocor lintas tenant), jadi
 * kejadiannya hanya dicatat di log.
 */
export async function handlePaymentReviewRequired(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const orderId = requirePayloadString(payload.orderId, "orderId", SOURCE);
  const reason = requirePayloadString(payload.reason, "reason", SOURCE);
  if (!REVIEW_REASONS.has(reason)) {
    logger.warn(`[${SOURCE}] Alasan pemeriksaan tidak dikenal: ${reason}`);
    return;
  }
  if (typeof payload.tenantId !== "string" || !payload.tenantId) {
    logger.error(
      `[${SOURCE}] Pembayaran ${orderId} perlu diperiksa (${reason}), tetapi tanpa tenant tidak ada staf yang bisa diberi tahu`,
    );
    return;
  }

  await notifyPaymentReviewRequired({
    provider: requirePayloadString(payload.provider, "provider", SOURCE),
    orderId,
    reason: reason as "AMOUNT_MISMATCH" | "TRANSACTION_MISMATCH",
    expected: requirePayloadString(payload.expected, "expected", SOURCE),
    received: requirePayloadString(payload.received, "received", SOURCE),
    tenantId: payload.tenantId,
  });
}
