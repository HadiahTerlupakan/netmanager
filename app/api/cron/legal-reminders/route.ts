import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { runAsSystemContext } from "@/lib/tenant-context";
import { LegalReminderService } from "@/modules/legal";

/**
 * POST /api/cron/legal-reminders
 *
 * Mengirim pengingat tenggat dokumen legal (masa berlaku, batas pemberitahuan,
 * jaminan, kewajiban berkala) untuk semua tenant. Aman dijalankan ulang:
 * pengingat yang sudah terkirim tercatat dan tidak dikirim dobel.
 */
function hasValidCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function POST(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return ApiErrors.unauthorized("Invalid cron secret");
  }

  try {
    // Cron bukan request pengguna: konteks dielevasi agar dokumen semua tenant terperiksa.
    const sent = await runAsSystemContext("legal: pengingat tenggat dokumen", () =>
      new LegalReminderService().run(),
    );

    return apiSuccess({ sent, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error("[Cron] legal-reminders gagal:", error);

    return ApiErrors.internalError("Gagal memproses pengingat legal");
  }
}
