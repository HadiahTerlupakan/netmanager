import { RadiusAdminService, RadiusAdminServiceError } from "@/modules/network";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

const radiusAdminService = new RadiusAdminService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("radius:read"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk melihat NAS");
  }

  try {
    const id = parseNasId(ctx.params.id);
    const tenantId = ctx.session!.user.tenantId;
    const nas = await radiusAdminService.getNasById(id, tenantId);

    return apiSuccess(nas);
  } catch (error) {
    return mapRadiusAdminError(error);
  }
});

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("radius:update"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk mengubah NAS");
  }

  try {
    const id = parseNasId(ctx.params.id);
    const tenantId = ctx.session!.user.tenantId;
    const payload = await req.json();
    const updatedNas = await radiusAdminService.updateNas({
      id,
      tenantId,
      payload,
    });

    return apiSuccess(updatedNas, { message: "NAS berhasil diperbarui" });
  } catch (error) {
    return mapRadiusAdminError(error);
  }
});

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("radius:delete"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk menghapus NAS");
  }

  try {
    const id = parseNasId(ctx.params.id);
    const tenantId = ctx.session!.user.tenantId;
    await radiusAdminService.deleteNas(id, tenantId);

    return apiSuccess(null, { message: "NAS berhasil dihapus" });
  } catch (error) {
    return mapRadiusAdminError(error);
  }
});

/** Parse route param into NAS id. */
function parseNasId(idParam: string) {
  const id = Number.parseInt(idParam, 10);
  if (Number.isNaN(id)) {
    throw new RadiusAdminServiceError(
      "ID NAS tidak valid",
      400,
      ErrorCodes.BAD_REQUEST,
    );
  }

  return id;
}

function mapRadiusAdminError(error: unknown) {
  if (error instanceof RadiusAdminServiceError) {
    return apiError(error.message, error.code, { status: error.status });
  }

  throw error;
}
