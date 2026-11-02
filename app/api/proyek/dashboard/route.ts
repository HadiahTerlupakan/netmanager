import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { RabProjectRouteService, resolveRabSiteScope } from "@/modules/proyek";

const rabProjectRouteService = new RabProjectRouteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const isSuperAdmin = ctx.permissions.includes("*");
  const hasReadAccess =
    isSuperAdmin || ctx.permissions.includes("expense:read");

  if (!hasReadAccess) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const metrics = await rabProjectRouteService.getDashboardMetrics(
    resolveRabSiteScope(ctx.session!.user, ctx.permissions),
  );
  return apiSuccess(metrics);
});
