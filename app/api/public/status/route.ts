import { NextRequest } from "next/server";

import { apiError, apiSuccess, ApiErrors, ErrorCodes } from "@/lib/api-response";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import { logger } from "@/lib/logger";
import { getIncidentService } from "@/modules/incident";

export const dynamic = "force-dynamic";

const HTTP_NOT_FOUND = 404;

/**
 * GET /api/public/status — status page publik (no auth): insiden publik yang belum
 * selesai + 10 terakhir yang selesai. Tenant diturunkan dari host (fail-closed);
 * domain yang bukan milik tenant mana pun dibalas 404 dan tidak dicatat sebagai ERROR.
 */
export async function GET(_req: NextRequest) {
  try {
    return apiSuccess(await getIncidentService().statusPublik());
  } catch (error: unknown) {
    if (isRouteServiceError(error) && error.status === HTTP_NOT_FOUND) {
      return apiError(error.message, ErrorCodes.NOT_FOUND, { status: HTTP_NOT_FOUND });
    }
    logger.error("[Public Status] Error:", error);
    return ApiErrors.internalError("Gagal mengambil status");
  }
}
