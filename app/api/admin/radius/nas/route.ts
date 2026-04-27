import { RadiusAdminService, RadiusAdminServiceError } from "@/modules/network";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, apiError, createHandler } from "@/lib/api";

const radiusAdminService = new RadiusAdminService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("radius:read"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk melihat NAS");
  }

  try {
    const tenantId = ctx.session!.user.tenantId;
    const result = await radiusAdminService.getNasList(tenantId);

    return apiSuccess(result);
  } catch (error) {
    return mapRadiusAdminError(error);
  }
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("radius:create"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk membuat NAS");
  }

  try {
    const tenantId = ctx.session!.user.tenantId;
    const userId = ctx.session!.user.id;
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
});

function mapRadiusAdminError(error: unknown) {
  if (error instanceof RadiusAdminServiceError) {
    return apiError(error.message, error.code, { status: error.status });
  }

  throw error;
}
