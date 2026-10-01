import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import type { KegiatanHasil } from "../../domain/entities/Kegiatan";
import { KEGIATAN_HASIL_CONFIG } from "../../utils/statusConfig";
import {
  SUMBER_NOTIFIKASI_RENCANA,
  tautanRencanaMobile,
} from "./rencana-assigned-presurvei.handler";

const SOURCE = "RencanaReportedPresurveiHandler";

/** Label hasil kegiatan untuk pesan notifikasi; hasil tak dikenal ditulis apa adanya. */
function labelHasil(hasil: string): string {
  return KEGIATAN_HASIL_CONFIG[hasil as KegiatanHasil]?.label ?? hasil;
}

/**
 * Kabari pemberi tugas (kepala sales/admin) bahwa sales melaporkan
 * penugasannya. Tautan sama dengan notifikasi penugasan: push di HP pemberi
 * membuka rincian rencana beserta laporannya.
 *
 * Idempotent: notifikasi yang sudah ada untuk rencana ini di pemberi tidak
 * dikirim ulang (event bus at-least-once). Pemberi dan sales berbeda orang
 * (PENUGASAN), jadi \`sourceType\` yang sama dengan notifikasi penugasan tidak
 * bertabrakan: kuncinya per user.
 */
export async function handleRencanaReportedPresurvei(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const rencanaId = requirePayloadString(payload.rencanaId, "rencanaId", SOURCE);
  const pemberiId = requirePayloadString(payload.dibuatOlehId, "dibuatOlehId", SOURCE);
  const tujuan = requirePayloadString(payload.tujuan, "tujuan", SOURCE);
  const hasil = requirePayloadString(payload.hasil, "hasil", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const pelapor =
    typeof payload.namaSales === "string" && payload.namaSales
      ? payload.namaSales
      : "Sales";

  const { createNotification, hasNotificationForSource } = await import(
    "@/modules/notification"
  );

  const sudahDikirim = await hasNotificationForSource({
    userId: pemberiId,
    sourceType: SUMBER_NOTIFIKASI_RENCANA,
    sourceId: rencanaId,
  });
  if (sudahDikirim) {
    logger.info(`[${SOURCE}] Laporan rencana ${rencanaId} sudah dikabarkan, dilewati`);
    return;
  }

  await createNotification({
    type: "SYSTEM",
    priority: "NORMAL",
    title: "✅ Laporan kunjungan masuk",
    message: `${pelapor} melaporkan "${tujuan}" — hasil: ${labelHasil(hasil)}`,
    link: tautanRencanaMobile(rencanaId),
    userId: pemberiId,
    sourceType: SUMBER_NOTIFIKASI_RENCANA,
    sourceId: rencanaId,
    tenantId,
  });
}
