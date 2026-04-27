import { isSuperAdmin } from "@/lib/auth";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { RabProjectRouteService, isRouteServiceError } from "@/modules/finance";
import { hasPermission } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const rabProjectRouteService = new RabProjectRouteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  const hasAccess =
    isSuperAdmin(user) ||
    (await hasPermission("expense:read")) ||
    (await hasPermission("mixradius_expenses:read"));

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: expense:read ATAU mixradius_expenses:read",
    );
  }

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
