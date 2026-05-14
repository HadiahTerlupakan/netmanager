import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { getMixRadiusGroupRouteService } from "@/modules/integrations";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const permissions = authResult.permissions || [];
    if (!permissions.includes("m_mixradius:read")) {
      return apiError(
        "Dilarang: Memerlukan izin m_mixradius:read",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    const routeService = getMixRadiusGroupRouteService();
    const groups = await routeService.getMobileGroups(
      authResult.siteId as string | null | undefined,
      authResult.tenantId ?? undefined,
    );

    return apiSuccess(groups);
  } catch (error) {
    logger.error("Error fetching MixRadius groups:", error);
    return apiError(
      "Gagal mengambil grup MixRadius",
      ErrorCodes.INTERNAL_ERROR,
      {
        status: 500,
      },
    );
  }
}
