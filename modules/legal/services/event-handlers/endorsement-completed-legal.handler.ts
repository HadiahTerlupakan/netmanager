import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { LegalSigningService } from "../LegalSigningService";

const SOURCE = "EndorsementCompletedLegalHandler";
const LEGAL_SOURCE_TYPE = "LEGAL_DOCUMENT";

/**
 * Surat pengesahan sah → bila suratnya berasal dari dokumen legal, ganti berkas
 * dokumen itu dengan PDF bertanda tangan.
 *
 * `tenantId` wajib: tanpa itu worker berjalan dalam konteks sistem yang tidak
 * menyaring tenant sama sekali, jadi event seperti itu dilewati. Idempoten (at-least-once) — penerapan ulang
 * dilewati bila berkasnya sudah versi sah.
 */
export async function handleEndorsementCompletedLegal(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  if (payload.sourceType !== LEGAL_SOURCE_TYPE) return;

  const endorsementId = requirePayloadString(payload.endorsementId, "endorsementId", SOURCE);
  if (typeof payload.tenantId !== "string" || !payload.tenantId) {
    // Tidak akan pernah berhasil bila diulang — catat dan lewati, jangan retry.
    logger.warn(`[${SOURCE}] Surat ${endorsementId} tanpa tenantId, dilewati`);
    return;
  }

  const isApplied = await new LegalSigningService().applySignedVersion(endorsementId);
  if (isApplied) {
    logger.info(`[${SOURCE}] Dokumen legal memakai versi sah dari surat ${endorsementId}`);
  }
}
