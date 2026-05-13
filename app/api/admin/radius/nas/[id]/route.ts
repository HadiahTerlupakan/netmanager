import { RadiusAdminService, RadiusAdminServiceError } from "@/modules/network";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

const radiusAdminService = new RadiusAdminService();

export const GET = createHandler(
  { auth: true, permissions: ["radius:read"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const id = parseNasId(ctx.params.id);
      const nas = await radiusAdminService.getNasById(id, tenantId);
      return apiSuccess(nas);
    } catch (error) {
      return mapRadiusAdminError(error);
    }
  },
);

export const PUT = createHandler(
  { auth: true, permissions: ["radius:update"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const id = parseNasId(ctx.params.id);
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
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["radius:delete"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    try {
      const id = parseNasId(ctx.params.id);
      await radiusAdminService.deleteNas(id, tenantId);

      return apiSuccess(null, { message: "NAS berhasil dihapus" });
    } catch (error) {
      return mapRadiusAdminError(error);
    }
  },
);

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
