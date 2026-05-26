import { hasPermission } from "@/lib/rbac";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getIncidentService } from "@/modules/incident";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/incidents/analytics?days=<n>
 * MTTR & severity breakdown untuk N hari terakhir (default 30).
 */
export const GET = createHandler({ auth: true }, async (req) => {
  if (!(await hasPermission("incidents:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat analytics incident",
    );
  }

  try {
    const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
    const result = await getIncidentService().getAnalytics(days);

    return apiSuccess({
      ...result,
      recentlyResolved: result.recentlyResolved.map((r) => ({
        ...r,
        resolvedAt: r.resolvedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    logger.error("[Incident Analytics] Error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal mengambil analytics",
    );
  }
});
