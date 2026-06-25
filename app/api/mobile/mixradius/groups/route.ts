import { logger } from "@/lib/logger";
import { createHandler } from "@/lib/api";
import { getMixRadiusGroupRouteService } from "@/modules/integrations";
import { getUserSiteIds } from "@/modules/roles";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import type { Session } from "next-auth";

export const GET = createHandler(
  { auth: true, permissions: ["m_mixradius:read"] },
  async (_req, ctx) => {
    try {
      const routeService = getMixRadiusGroupRouteService();
      const siteIds = getUserSiteIds(ctx.session as Session | null);
      const groups = await routeService.getMobileGroups(
        siteIds,
        ctx.session!.user.tenantId ?? undefined,
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
  },
);
