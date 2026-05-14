import type { Job } from "bullmq";
import type { Status } from "@prisma/client";
import { logger } from "@/lib/logger";
import { EVENT_NAMES, requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { RadiusSyncService } from "../radius-sync-service";
import { getPelangganService } from "@/modules/pelanggan";

const SOURCE = "CustomerStatusHandler";

/**
 * Handler yang mengkonsumsi event customer lifecycle dan mensinkronkan
 * MikroTik/RADIUS sesuai state baru pelanggan.
 *
 * Di-register ke event bus untuk event:
 * - CUSTOMER_CREATED / CUSTOMER_UPDATED → syncSingleCustomer
 * - CUSTOMER_SUSPENDED / CUSTOMER_ACTIVATED / CUSTOMER_ISOLATED → handleStatusChange
 * - CUSTOMER_DELETED → removeCustomer
 *
 * Setelah sync selesai, syncStatus pelanggan di-update ke SYNCED atau FAILED.
 * CUSTOMER_DELETED tidak update syncStatus karena record sudah dihapus.
 * Semua error di-throw supaya BullMQ retry dengan exponential backoff.
 */
export async function handleCustomerStatusEvent(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const radius = new RadiusSyncService();

  // CUSTOMER_DELETED tidak punya syncStatus untuk di-update (record sudah dihapus)
  if (eventName === EVENT_NAMES.CUSTOMER_DELETED) {
    const username = requirePayloadString(payload.username, "username", SOURCE);
    const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
    await radius.removeCustomer(username, tenantId);
    return;
  }

  // Semua event yang punya customerId — track syncStatus setelah operasi selesai
  if (
    eventName === EVENT_NAMES.CUSTOMER_CREATED ||
    eventName === EVENT_NAMES.CUSTOMER_UPDATED ||
    eventName === EVENT_NAMES.CUSTOMER_ISOLATED ||
    eventName === EVENT_NAMES.CUSTOMER_SUSPENDED ||
    eventName === EVENT_NAMES.CUSTOMER_ACTIVATED
  ) {
    const customerId = requirePayloadString(
      payload.customerId,
      "customerId",
      SOURCE,
    );
    const pelangganService = getPelangganService();

    try {
      if (
        eventName === EVENT_NAMES.CUSTOMER_CREATED ||
        eventName === EVENT_NAMES.CUSTOMER_UPDATED
      ) {
        await radius.syncSingleCustomer(customerId);
      } else {
        const newStatus = requirePayloadString(
          payload.newStatus,
          "newStatus",
          SOURCE,
        ) as Status;
        logger.info(
          `[CustomerStatusHandler] Sync MikroTik/RADIUS for ${customerId} → ${newStatus}`,
        );
        await radius.handleStatusChange(customerId, newStatus);
      }

      // Sukses — tandai SYNCED, reset syncRetryCount, set lastSyncedAt
      await pelangganService.updateSyncStatus(customerId, "SYNCED", null);
    } catch (err) {
      // Gagal — tandai FAILED. Wrap di .catch supaya throw err selalu tercapai
      // meskipun updateSyncStatus sendiri gagal (mis. P2025 record not found).
      const errorMessage =
        err instanceof Error ? err.message : "Sync ke MikroTik/RADIUS gagal";
      await pelangganService
        .updateSyncStatus(customerId, "FAILED", errorMessage)
        .catch((updateErr) =>
          logger.error(
            `[${SOURCE}] Gagal update syncStatus ke FAILED untuk ${customerId}:`,
            updateErr instanceof Error ? updateErr : undefined,
          ),
        );
      throw err;
    }

    return;
  }

  logger.warn(`[CustomerStatusHandler] Unknown eventName: ${eventName}`);
}
