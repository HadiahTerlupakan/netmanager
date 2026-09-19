import { hasPermission } from "@/lib/rbac";
import { SiteService } from "@/modules/roles";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
  buildSessionWithPermissions,
} from "@/lib/api";
import { checkSiteRestriction } from "@/modules/roles";
import { siteCreateSchema } from "@/lib/validations/site";

const siteService = new SiteService();

/**
 * GET /api/admin/sites - List all sites
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") || undefined;
  const activeOnly = searchParams.get("activeOnly") === "true";

  // Permission check
  const canReadSite = await hasPermission("site:read");
  const canCreateUser = await hasPermission("users:create");

  if (!canReadSite && !canCreateUser) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat site (Butuh: site:read atau users:create)",
    );
  }

  // Apply scope restriction even for activeOnly (dropdown)
  const { isRestricted, siteIds } = checkSiteRestriction(
    buildSessionWithPermissions(ctx.session!, ctx.permissions),
    "site",
  );
  const allowedSiteIds = isRestricted ? siteIds : undefined;

  const result = await siteService.getSites({
    ...(search ? { search } : {}),
    activeOnly,
    allowedSiteIds,
  });

  if (!result.success) {
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data);
});

/**
 * POST /api/admin/sites - Create new site
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("site:create"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk membuat site");
  }

  const body = await req.json();
  const parsed = siteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      parsed.error.issues[0].message,
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const result = await siteService.createSite(
    parsed.data,
    ctx.session!.user.id,
  );

  if (!result.success) {
    if (result.code === "VALIDATION_ERROR") {
      return apiError(result.error!, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }
    if (result.code === "DUPLICATE_CODE") {
      return ApiErrors.conflict("Kode site sudah digunakan");
    }
    return ApiErrors.internalError(result.error);
  }

  return apiSuccess(result.data, {
    status: 201,
    message: "Site berhasil dibuat",
  });
});
