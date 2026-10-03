import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import { responsGalatInsiden } from "@/lib/api/incident-route";
import { parseQuery } from "@/lib/api/query-parser";
import { getIncidentService, incidentAnalyticsQuerySchema } from "@/modules/incident";

export const dynamic = "force-dynamic";

/** GET /api/admin/incidents/analytics?days=<1–365> — MTTR & sebaran severity (bawaan 30 hari). */
export const GET = createHandler({ auth: true, permissions: ["incidents:read"] }, async (req, ctx) => {
  const { days } = incidentAnalyticsQuerySchema.parse(parseQuery(new URL(req.url).searchParams));
  try {
    const result = await getIncidentService().getAnalytics(requireSessionTenantId(ctx), days);
    return apiSuccess({
      ...result,
      recentlyResolved: result.recentlyResolved.map((item) => ({
        ...item,
        resolvedAt: item.resolvedAt.toISOString(),
      })),
    });
  } catch (error) {
    return responsGalatInsiden(error, "analytics");
  }
});
