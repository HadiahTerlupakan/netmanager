import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { SiteService } from "@/modules/roles";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { checkSiteRestriction } from "@/modules/roles";

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
    ctx.session as never,
    "site",
  );
  const allowedSiteIds = isRestricted ? siteIds : undefined;

  const sites = await siteService.getSites({
    ...(search ? { search } : {}),
    activeOnly,
    allowedSiteIds,
  });

  return apiSuccess(sites);
});

/**
 * POST /api/admin/sites - Create new site
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("site:create"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk membuat site");
  }

  const body = await req.json();

  try {
    const site = await siteService.createSite(body, ctx.session!.user.id);
    return apiSuccess(site, { status: 201, message: "Site berhasil dibuat" });
  } catch (error) {
    logger.error("Error creating site:", error);

    const message = error instanceof Error ? error.message : "";
    if (message === "Code and name are required") {
      return apiError(
        "Kode dan nama wajib diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }
    if (message === "Site code already exists") {
      return ApiErrors.conflict("Kode site sudah ada");
    }

    return ApiErrors.internalError("Gagal membuat site");
  }
});
