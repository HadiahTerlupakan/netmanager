import { RadiusSyncService } from "@/modules/network";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

const radiusSyncService = new RadiusSyncService();

export const GET = createHandler(
  { auth: true, permissions: ["radius:read"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const username = (req.nextUrl.searchParams.get("username") || "").trim();
    const nasIpAddress = (
      req.nextUrl.searchParams.get("nasIpAddress") || ""
    ).trim();

    if (!username) {
      return ApiErrors.badRequest("Query parameter username wajib diisi");
    }

    const result = await radiusSyncService.debugLiveSessionUsageByUsername(
      username,
      tenantId,
      nasIpAddress || undefined,
    );

    if (!result.success) {
      return ApiErrors.internalError(result.error || "Gagal debug live usage");
    }

    return apiSuccess({
      username,
      tenantId,
      ...(nasIpAddress ? { nasIpAddress } : {}),
      routerSource: result.routerSource,
      routerId: result.routerId,
      debug: result.debug,
    });
  },
);
