import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { RabProjectRouteService } from "@/modules/finance";

const rabProjectRouteService = new RabProjectRouteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const isSuperAdmin = ctx.permissions.includes("*");
  const hasReadAccess =
    isSuperAdmin || ctx.permissions.includes("expense:read");

  if (!hasReadAccess) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const metrics = await rabProjectRouteService.getDashboardMetrics();
  return apiSuccess(metrics);
});
