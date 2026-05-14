import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { EVENT_NAMES, requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { RadiusSyncService } from "../radius-sync-service";

const BATCH_SIZE = 50;
const SOURCE = "ProfilePppUpdatedHandler";

/**
 * Handler yang subscribe ke PROFILE_PPP_UPDATED event.
 *
 * Bulk disconnect + resync semua pelanggan aktif yang menggunakan profile PPP
 * yang diupdate, supaya mereka re-auth dengan config baru (rate limit, timeout, dll).
 *
 * Jika bandwidthChanged = false, skip — tidak ada perubahan yang memerlukan
 * force re-auth pelanggan.
 *
 * Processing sequential dengan batch 50 untuk mencegah overwhelm MikroTik.
 * Jika sebagian pelanggan gagal, throw error untuk trigger BullMQ retry.
 */
export async function handleProfilePppUpdated(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const profileId = requirePayloadString(
    payload.profileId,
    "profileId",
    SOURCE,
  );
  const bandwidthChanged = payload.bandwidthChanged === true;

  if (!bandwidthChanged) {
    logger.info(
      `[ProfilePppUpdatedHandler] Skip profile ${profileId} — bandwidth tidak berubah`,
    );
    return;
  }

  // Query semua pelanggan aktif yang pakai profile ini via HargaPaket → ProfilePPP
  const affectedCustomers = await prisma.pelanggan.findMany({
    where: {
      hargaPaket: {
        profilePPPId: profileId,
      },
      status: "AKTIF",
    },
    select: { id: true, username: true },
  });

  logger.info(
    `[ProfilePppUpdatedHandler] Found ${affectedCustomers.length} active customers using profile ${profileId}`,
  );

  if (affectedCustomers.length === 0) return;

  const radius = new RadiusSyncService();
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < affectedCustomers.length; i += BATCH_SIZE) {
    const batch = affectedCustomers.slice(i, i + BATCH_SIZE);

    // Sequential dalam batch untuk throttle MikroTik (bukan Promise.all)
    for (const customer of batch) {
      try {
        await radius.handleStatusChange(customer.id, "AKTIF");
        successCount++;
      } catch (err) {
        failCount++;
        logger.error(
          `[ProfilePppUpdatedHandler] Failed disconnect ${customer.id}:`,
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    }

    // Throttle 200ms antar batch supaya MikroTik tidak overwhelmed
    if (i + BATCH_SIZE < affectedCustomers.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    }
  }

  logger.info(
    `[ProfilePppUpdatedHandler] Completed profile ${profileId}: ${successCount} sukses, ${failCount} fail`,
  );

  if (failCount > 0 && successCount === 0) {
    // Semua gagal — throw supaya BullMQ retry seluruh batch
    throw new Error(
      `Profile PPP update total failure: ${failCount} dari ${affectedCustomers.length} pelanggan gagal di-resync`,
    );
  }

  if (failCount > 0) {
    // Partial failure — log error tapi JANGAN throw. Kalau throw, BullMQ
    // retry seluruh batch → pelanggan yang sudah berhasil di-disconnect ulang.
    // Pelanggan yang gagal sudah di-log per-item di atas.
    logger.error(
      `[ProfilePppUpdatedHandler] Partial failure profile ${profileId}: ${failCount} gagal dari ${affectedCustomers.length}. Pelanggan yang gagal perlu manual resync.`,
    );
  }
}

// Exported for event-handlers.ts registration
export const HANDLED_EVENT = EVENT_NAMES.PROFILE_PPP_UPDATED;
