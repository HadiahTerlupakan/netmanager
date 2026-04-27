import { RadiusAdminService, RadiusAdminServiceError } from "@/modules/network";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, apiError, createHandler } from "@/lib/api";

const radiusAdminService = new RadiusAdminService();

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("radius:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat sesi RADIUS",
    );
  }

  try {
    const username = req.nextUrl.searchParams.get("username") || undefined;
    const tenantId = ctx.session!.user.tenantId;
    const result = await radiusAdminService.getActiveSessions({
      tenantId,
      username,
    });

    return apiSuccess(result);
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
