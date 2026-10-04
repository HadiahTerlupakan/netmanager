import { NextRequest } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { runAsSystemContext } from "@/lib/tenant-context";
import { EndorsementService } from "@/modules/endorsement";

/**
 * POST /api/cron/endorsement-expire
 *
 * Menandai surat pengesahan yang melewati masa berlaku. Tanpa ini, tautan yang
 * sudah lewat tanggal tetap berstatus terkirim dan terlihat menunggu selamanya
 * di daftar admin.
 *
 * Sebelumnya, surat yang sudah ditandatangani semua tetapi gagal difinalisasi
 * (mis. PDF gabungan gagal disusun) dicoba disahkan ulang — supaya tidak ikut
 * gugur sebagai kedaluwarsa.
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
    // Cron bukan berasal dari request pengguna, jadi konteks tenant dielevasi
    // eksplisit — surat milik semua tenant harus ikut diperiksa.
    const { finalized, expired } = await runAsSystemContext(
      "endorsement: finalisasi ulang & tandai surat kedaluwarsa",
      async () => {
        const service = new EndorsementService();
        return {
          finalized: await service.finalizePending(),
          expired: await service.expireOverdue(),
        };
      },
    );

    return apiSuccess({
      finalized,
      expired,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Cron] endorsement-expire gagal:", error);

    return ApiErrors.internalError("Gagal memproses surat kedaluwarsa");
  }
}
