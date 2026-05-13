import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { EVENT_NAMES } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { RadiusSyncService } from "../radius-sync-service";
import { PelangganRepository } from "@/modules/pelanggan/repositories/PelangganRepository";

/**
 * Guard helper — memastikan field payload adalah string non-kosong sebelum dipakai.
 * Throw eksplisit supaya BullMQ tidak meneruskan job dengan data malformed ke MikroTik/RADIUS.
 */
function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(
      `[PackageChangeHandler] Payload field "${field}" harus string non-kosong, dapat ${typeof value}`,
    );
  }
  return value;
}

/**
 * Handler yang subscribe ke PACKAGE_CHANGED event.
 *
 * - IMMEDIATE apply: panggil syncSingleCustomer untuk update PPP secret profile,
 *   lalu handleStatusChange(AKTIF) untuk force disconnect session sehingga
 *   pelanggan re-auth dengan rate limit paket baru.
 * - NEXT_CYCLE apply: skip — cron job PendingPackageApplier yang akan apply
 *   saat due date tercapai.
 *
 * Setelah operasi selesai, syncStatus pelanggan di-update ke SYNCED atau FAILED.
 * Error di-throw supaya BullMQ retry dengan exponential backoff.
 */
export async function handlePackageChange(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const customerId = requireString(payload.customerId, "customerId");
  const applyTime = requireString(payload.applyTime, "applyTime") as
    | "IMMEDIATE"
    | "NEXT_CYCLE";

  if (applyTime === "NEXT_CYCLE") {
    logger.info(
      `[PackageChangeHandler] Skip ${customerId} — applyTime=NEXT_CYCLE, akan di-apply oleh cron`,
    );
    return;
  }

  const repo = new PelangganRepository();
  const radius = new RadiusSyncService();

  try {
    // syncSingleCustomer: update PPP secret profile di MikroTik/RADIUS
    // sesuai hargaPaket terbaru pelanggan
    await radius.syncSingleCustomer(customerId);

    // handleStatusChange(AKTIF): force disconnect active sessions supaya
    // pelanggan re-auth dan mendapat rate limit dari profile baru
    await radius.handleStatusChange(customerId, "AKTIF");

    await repo.updateSyncStatus(customerId, "SYNCED", null);
    logger.info(
      `[PackageChangeHandler] Applied package change for ${customerId}: ${payload.oldProfileName} → ${payload.newProfileName}`,
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "Gagal apply package change ke MikroTik";
    await repo.updateSyncStatus(customerId, "FAILED", errorMessage);
    throw err;
  }
}

// Exported for event-handlers.ts registration
export const HANDLED_EVENT = EVENT_NAMES.PACKAGE_CHANGED;
