import { RadiusAdminService, RadiusAdminServiceError } from "@/modules/network";
import { apiSuccess, ApiErrors, apiError, createHandler } from "@/lib/api";

const radiusAdminService = new RadiusAdminService();

export const GET = createHandler(
  { auth: true, permissions: ["radius:read"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const poolName = req.nextUrl.searchParams.get("poolName") || undefined;
      const getStats = req.nextUrl.searchParams.get("stats") === "true";
      const result = await radiusAdminService.getIpPools({
        tenantId,
        poolName,
        getStats,
      });

      return apiSuccess(result);
    } catch (error) {
      return mapRadiusAdminError(error);
    }
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["radius:create"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    const userId = ctx.session?.user.id;
    if (!tenantId || !userId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const payload = await req.json();
      const createdPool = await radiusAdminService.addIpPool({
        tenantId,
        userId,
        poolName: payload.poolName,
        framedIpAddress: payload.framedIpAddress,
      });

      return apiSuccess(createdPool, {
        status: 201,
        message: "IP berhasil ditambahkan ke pool",
      });
    } catch (error) {
      return mapRadiusAdminError(error);
    }
  },
);

function mapRadiusAdminError(error: unknown) {
  if (error instanceof RadiusAdminServiceError) {
    return apiError(error.message, error.code, { status: error.status });
  }

  throw error;
}
