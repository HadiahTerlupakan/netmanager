import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  getMixRadiusService,
} from "@/modules/integrations";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/mixradius/odps/[id]/customers
 * Fetch customers for a specific ODP
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden("Anda tidak memiliki akses ke data MixRadius");
  }

  const { id } = ctx.params;

  const mixRadiusService = getMixRadiusService();
  const customers = await mixRadiusService.fetchODPCustomers(id);

  return apiSuccess({
    data: customers,
    total: customers.length,
  });
});
