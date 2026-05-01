import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { RadiusDashboardService } from "@/modules/network";

const radiusDashboardService = new RadiusDashboardService();
const allowedStatusValues = ["active", "all"] as const;

function parseRecentSessionsStatus(statusParam: string | null) {
  const status = statusParam ?? "active";

  if (
    !allowedStatusValues.includes(
      status as (typeof allowedStatusValues)[number],
    )
  ) {
    return null;
  }

  return status as (typeof allowedStatusValues)[number];
}

export const GET = createHandler(
  { auth: true, permissions: ["radius:read"] },
  async (req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const searchParams = req.nextUrl.searchParams;
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const statusParam = searchParams.get("status");

    const page = pageParam ? Number(pageParam) : 1;
    const limit = limitParam ? Number(limitParam) : 50;
    const status = parseRecentSessionsStatus(statusParam);

    if (!Number.isFinite(page) || page < 1) {
      return ApiErrors.badRequest("Query parameter page tidak valid");
    }

    if (!Number.isFinite(limit) || limit < 1) {
      return ApiErrors.badRequest("Query parameter limit tidak valid");
    }

    if (!status) {
      return ApiErrors.badRequest(
        "Query parameter status harus bernilai active atau all",
      );
    }

    const result = await radiusDashboardService.getRecentSessions({
      tenantId,
      page,
      limit,
      status,
    });

    return apiSuccess(result);
  },
);
