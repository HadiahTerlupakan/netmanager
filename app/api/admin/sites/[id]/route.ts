import { hasPermission } from "@/lib/rbac";
import { SiteService } from "@/modules/roles";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { siteUpdateSchema } from "@/lib/validations/site";

const siteService = new SiteService();

/**
 * GET /api/admin/sites/[id] - Get site details
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("site:read"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk melihat site");
  }

  const { id } = ctx.params;
  const result = await siteService.getSiteById(id);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Site");
    }
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data);
});

/**
 * PATCH /api/admin/sites/[id] - Update site
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("site:update"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk mengubah site");
  }

  const { id } = ctx.params;
  const body = await req.json();
  const parsed = siteUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0].message,
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const result = await siteService.updateSite(
    id,
    parsed.data,
    ctx.session!.user.id,
  );

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Site");
    }
    if (result.code === "DUPLICATE_CODE") {
      return ApiErrors.conflict("Kode site sudah digunakan");
    }
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data, { message: "Site berhasil diperbarui" });
});

/**
 * DELETE /api/admin/sites/[id] - Delete site
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("site:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus site",
    );
  }

  const { id } = ctx.params;
  const result = await siteService.deleteSite(id, ctx.session!.user.id);

  if (!result.success) {
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Site");
    }
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(null, { message: result.data!.message });
});
