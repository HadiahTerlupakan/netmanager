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
      const username = req.nextUrl.searchParams.get("username") || undefined;
      const result = await radiusAdminService.getActiveSessions({
        tenantId,
        username,
      });

      return apiSuccess(result);
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
