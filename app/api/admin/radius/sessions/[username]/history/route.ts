import { RadiusSyncService } from "@/modules/network";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

const radiusSyncService = new RadiusSyncService();

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

    const searchParams = req.nextUrl.searchParams;
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const page = pageParam ? Number(pageParam) : 1;
    const limit = limitParam ? Number(limitParam) : 20;

    if (!Number.isFinite(page) || page < 1) {
      return ApiErrors.badRequest("Query parameter page tidak valid");
    }

    if (!Number.isFinite(limit) || limit < 1) {
      return ApiErrors.badRequest("Query parameter limit tidak valid");
    }

    const hasAccess =
      await radiusSyncService.canGetHistoryForRadiusDashboardUser(
        username,
        tenantId,
      );
    if (!hasAccess) {
      return ApiErrors.notFound("Histori user tidak ditemukan");
    }

    const history = await radiusSyncService.getHistoryForRadiusDashboardUser(
      username,
      tenantId,
      {
        page,
        limit,
        startDate,
        endDate,
      },
    );

    return apiSuccess(history);
  },
);
