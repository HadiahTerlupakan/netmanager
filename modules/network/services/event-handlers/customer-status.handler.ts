import type { Job } from "bullmq";
import type { Status } from "@prisma/client";
import { logger } from "@/lib/logger";
import { EVENT_NAMES } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { RadiusSyncService } from "../radius-sync-service";

/**
 * Guard helper — memastikan field payload adalah string non-kosong sebelum dipakai.
 * Throw eksplisit supaya BullMQ tidak meneruskan job dengan data malformed ke MikroTik/RADIUS.
 */
function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(
      `[CustomerStatusHandler] Payload field "${field}" harus string non-kosong, dapat ${typeof value}`,
    );
  }
  return value;
}

/**
 * Handler yang mengkonsumsi event customer lifecycle dan mensinkronkan
 * MikroTik/RADIUS sesuai state baru pelanggan.
 *
 * Di-register ke event bus untuk event:
 * - CUSTOMER_CREATED / CUSTOMER_UPDATED → syncSingleCustomer
 * - CUSTOMER_SUSPENDED / CUSTOMER_ACTIVATED / CUSTOMER_ISOLATED → handleStatusChange
 * - CUSTOMER_DELETED → removeCustomer
 *
 * Semua error di-throw supaya BullMQ retry dengan exponential backoff.
 */
export async function handleCustomerStatusEvent(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const radius = new RadiusSyncService();

  if (
    eventName === EVENT_NAMES.CUSTOMER_CREATED ||
    eventName === EVENT_NAMES.CUSTOMER_UPDATED
  ) {
    const customerId = requireString(payload.customerId, "customerId");
    await radius.syncSingleCustomer(customerId);
    return;
  }

  if (eventName === EVENT_NAMES.CUSTOMER_DELETED) {
    const username = requireString(payload.username, "username");
    const tenantId =
      typeof payload.tenantId === "string" ? payload.tenantId : undefined;
    await radius.removeCustomer(username, tenantId);
    return;
  }

  if (
    eventName === EVENT_NAMES.CUSTOMER_ISOLATED ||
    eventName === EVENT_NAMES.CUSTOMER_SUSPENDED ||
    eventName === EVENT_NAMES.CUSTOMER_ACTIVATED
  ) {
    const customerId = requireString(payload.customerId, "customerId");
    const newStatus = requireString(payload.newStatus, "newStatus") as Status;
    logger.info(
      `[CustomerStatusHandler] Sync MikroTik/RADIUS for ${customerId} → ${newStatus}`,
    );
    await radius.handleStatusChange(customerId, newStatus);
    return;
  }

  logger.warn(`[CustomerStatusHandler] Unknown eventName: ${eventName}`);
}
