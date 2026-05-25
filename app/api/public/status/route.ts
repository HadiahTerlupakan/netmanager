import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { NextRequest } from "next/server";
import { getIncidentService } from "@/modules/incident";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/status — status page publik (no auth).
 * Return active incidents (belum RESOLVED) + 10 incident terakhir
 * yang sudah RESOLVED. Hanya yang isPublic=true.
 */
export async function GET(_req: NextRequest) {
  try {
    const service = getIncidentService();
    const [active, recent] = await Promise.all([
      service.list({ status: "ACTIVE", publicOnly: true, limit: 50 }),
      service.list({ status: "RESOLVED", publicOnly: true, limit: 10 }),
    ]);

    return apiSuccess({ active, recent });
  } catch (error: unknown) {
    logger.error("[Public Status] Error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal mengambil status",
    );
  }
}
