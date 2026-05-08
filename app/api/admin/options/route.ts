import { apiSuccess, createHandler } from "@/lib/api";
import { AdminOptionsRouteService } from "@/modules/roles";
import { checkSiteRestriction } from "@/modules/roles";

const adminOptionsRouteService = new AdminOptionsRouteService();

// GET /api/admin/options - Get dropdown options
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const resource = new URL(req.url).searchParams.get("resource") || "users";
  const { isRestricted, siteIds } = checkSiteRestriction(
    ctx.session as never,
    resource,
  );
  const allowedSiteIds = isRestricted ? siteIds : undefined;

  const options = await adminOptionsRouteService.getOptions(allowedSiteIds);
  return apiSuccess(options);
});
