import type { Job } from "bullmq";
import type { Status } from "@prisma/client";
import { logger } from "@/lib/logger";
import { EVENT_NAMES } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { RadiusSyncService } from "../radius-sync-service";

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
    await radius.syncSingleCustomer(payload.customerId as string);
    return;
  }

  if (eventName === EVENT_NAMES.CUSTOMER_DELETED) {
    await radius.removeCustomer(payload.username as string);
    return;
  }

  if (
    eventName === EVENT_NAMES.CUSTOMER_ISOLATED ||
    eventName === EVENT_NAMES.CUSTOMER_SUSPENDED ||
    eventName === EVENT_NAMES.CUSTOMER_ACTIVATED
  ) {
    const newStatus = payload.newStatus as Status;
    const customerId = payload.customerId as string;
    logger.info(
      `[CustomerStatusHandler] Sync MikroTik/RADIUS for ${customerId} → ${newStatus}`,
    );
    await radius.handleStatusChange(customerId, newStatus);
    return;
  }

  logger.warn(`[CustomerStatusHandler] Unknown eventName: ${eventName}`);
}
