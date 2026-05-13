import { RadiusAdminService, RadiusAdminServiceError } from "@/modules/network";
import { apiSuccess, ApiErrors, apiError, createHandler } from "@/lib/api";

const radiusAdminService = new RadiusAdminService();

export const GET = createHandler(
  { auth: true, permissions: ["radius:read"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const result = await radiusAdminService.getNasList(tenantId);
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
      const createdNas = await radiusAdminService.createNas({
        tenantId,
        userId,
        payload,
      });

      return apiSuccess(createdNas, {
        status: 201,
        message: "NAS berhasil dibuat",
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
