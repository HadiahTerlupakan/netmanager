import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth/super-admin";
import { hasPermission } from "@/lib/rbac";
import { RabProjectRouteService, resolveRabSiteScope } from "@/modules/proyek";

const rabProjectRouteService = new RabProjectRouteService();

/**
 * GET /api/proyek/dashboard - metrik bottleneck persetujuan RAB. Akses dijaga
 * `expense:read` (seperti daftar RAB); angka dibatasi `expense:site_only`.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const hasReadAccess =
    isSuperAdmin(user) || (await hasPermission("expense:read"));

  if (!hasReadAccess) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const metrics = await rabProjectRouteService.getDashboardMetrics(
    resolveRabSiteScope(user, ctx.permissions),
  );
  return apiSuccess(metrics);
});
