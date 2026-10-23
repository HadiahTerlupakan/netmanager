import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";

const SOURCE = "RencanaAssignedPresurveiHandler";

/** `sourceType` notifikasi penugasan rencana — juga dipakai deep-link mobile. */
export const SUMBER_NOTIFIKASI_RENCANA = "PRESURVEI_RENCANA";

/** Rute rincian rencana di aplikasi mobile. */
export function tautanRencanaMobile(rencanaId: string): string {
  return `/presurvei/rencana/${rencanaId}`;
}

/**
 * Beri tahu sales bahwa ia ditugasi rencana kunjungan (notifikasi + push).
 *
 * Idempotent: event bus menjamin at-least-once, jadi notifikasi yang sudah
 * ada untuk rencana ini tidak dikirim ulang.
 */
export async function handleRencanaAssignedPresurvei(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const rencanaId = requirePayloadString(payload.rencanaId, "rencanaId", SOURCE);
  const salesId = requirePayloadString(payload.salesId, "salesId", SOURCE);
  const tanggal = requirePayloadString(payload.tanggal, "tanggal", SOURCE);
  const tujuan = requirePayloadString(payload.tujuan, "tujuan", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const waktu =
    typeof payload.jam === "string" && payload.jam
      ? `${tanggal} pukul ${payload.jam}`
      : tanggal;
  const pemberi =
    typeof payload.namaPembuat === "string" && payload.namaPembuat
      ? payload.namaPembuat
      : "Atasan Anda";

  const { createNotification, hasNotificationForSource } = await import(
    "@/modules/notification"
  );

  const sudahDikirim = await hasNotificationForSource({
    userId: salesId,
    sourceType: SUMBER_NOTIFIKASI_RENCANA,
    sourceId: rencanaId,
  });
  if (sudahDikirim) {
    logger.info(`[${SOURCE}] Notifikasi rencana ${rencanaId} sudah ada, dilewati`);
    return;
  }

  await createNotification({
    type: "SYSTEM",
    priority: "HIGH",
    title: "📍 Penugasan kunjungan baru",
    message: `${pemberi} menugaskan kunjungan tanggal ${waktu}: ${tujuan}`,
    link: tautanRencanaMobile(rencanaId),
    userId: salesId,
    sourceType: SUMBER_NOTIFIKASI_RENCANA,
    sourceId: rencanaId,
    tenantId,
  });
}
