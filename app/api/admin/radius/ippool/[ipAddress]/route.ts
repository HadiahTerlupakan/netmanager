import { RadiusAdminService, RadiusAdminServiceError } from "@/modules/network";
import { apiSuccess, ApiErrors, apiError, createHandler } from "@/lib/api";

const radiusAdminService = new RadiusAdminService();

export const DELETE = createHandler(
  { auth: true, permissions: ["radius:delete"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const result = await radiusAdminService.removeIpPool({
        tenantId,
        ipAddress: ctx.params.ipAddress,
      });

      return apiSuccess(result, { message: "IP berhasil dihapus dari pool" });
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
