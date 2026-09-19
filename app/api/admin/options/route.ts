import {
  apiSuccess,
  createHandler,
  buildSessionWithPermissions,
} from "@/lib/api";
import { AdminOptionsRouteService } from "@/modules/roles";
import { checkSiteRestriction } from "@/modules/roles";

const adminOptionsRouteService = new AdminOptionsRouteService();

// GET /api/admin/options - Get dropdown options
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const resource = new URL(req.url).searchParams.get("resource") || "users";
  const { isRestricted, siteIds } = checkSiteRestriction(
    buildSessionWithPermissions(ctx.session!, ctx.permissions),
    resource,
  );

  // Jika restricted tapi tidak punya site access, return empty options
  if (isRestricted && siteIds.length === 0) {
    return apiSuccess({ sites: [], departments: [] });
  }

  const allowedSiteIds = isRestricted ? siteIds : undefined;

  const options = await adminOptionsRouteService.getOptions(allowedSiteIds);
  return apiSuccess(options);
});
