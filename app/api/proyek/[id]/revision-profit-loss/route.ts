import { isSuperAdmin } from "@/lib/auth";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import {
  RabProjectRouteService,
  RabProjectSiteAccessService,
  resolveRabSiteScope,
} from "@/modules/proyek";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const rabProjectRouteService = new RabProjectRouteService();
const rabProjectSiteAccess = new RabProjectSiteAccessService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  const hasAccess = isSuperAdmin(user) || (await hasPermission("expense:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read",
    );
  }

  await rabProjectSiteAccess.assertProjectAccessible(
    ctx.params.id,
    resolveRabSiteScope(user, ctx.permissions),
  );

  try {
    const report = await rabProjectRouteService.getRevisionProfitLoss(
      ctx.params.id,
    );
    return apiSuccess(report);
  } catch (error) {
    if (isRouteServiceError(error) && error.status === 404) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});
