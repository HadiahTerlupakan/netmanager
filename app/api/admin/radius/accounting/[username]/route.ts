import { RadiusSyncService } from "@/modules/network";
import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";

const radiusSyncService = new RadiusSyncService();

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export const GET = createHandler(
  { auth: true, permissions: ["radius:read"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const username = (ctx.params?.username || "").trim();
    if (!username) {
      return ApiErrors.badRequest("Username tidak valid");
    }

    const { searchParams } = req.nextUrl;
    const startDate = parseDateParam(searchParams.get("startDate"));
    const endDate = parseDateParam(searchParams.get("endDate"));

    const stats = await radiusSyncService.getCustomerAccountingStats(
      username,
      tenantId,
      startDate,
      endDate,
    );

    const serializedStats = {
      ...stats,
      totalSessionTime: stats.totalSessionTime.toString(),
      totalInputOctets: stats.totalInputOctets.toString(),
      totalOutputOctets: stats.totalOutputOctets.toString(),
      totalSessionTimeHours: Number(stats.totalSessionTime) / 3600,
      totalInputGB: Number(stats.totalInputOctets) / 1073741824,
      totalOutputGB: Number(stats.totalOutputOctets) / 1073741824,
    };

    return apiSuccess({
      username,
      period: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
      },
      stats: serializedStats,
    });
  },
);
