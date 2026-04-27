import { RadiusAdminService, RadiusAdminServiceError } from "@/modules/network";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, apiError, createHandler } from "@/lib/api";

const radiusAdminService = new RadiusAdminService();

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("radius:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus IP Pool",
    );
  }

  try {
    const tenantId = ctx.session!.user.tenantId;
    const result = await radiusAdminService.removeIpPool({
      tenantId,
      ipAddress: ctx.params.ipAddress,
    });

    return apiSuccess(result, { message: "IP berhasil dihapus dari pool" });
  } catch (error) {
    return mapRadiusAdminError(error);
  }
});

function mapRadiusAdminError(error: unknown) {
  if (error instanceof RadiusAdminServiceError) {
    return apiError(error.message, error.code, { status: error.status });
  }

  throw error;
}
