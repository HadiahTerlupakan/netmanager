import { MobileAttendanceHistoryRouteService } from "@/modules/attendance";
import { createHandler } from "@/lib/api";
import { ApiErrors } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 100;
const historyService = new MobileAttendanceHistoryRouteService();

export const GET = createHandler({ auth: true }, async (_request, ctx) => {
  const userSession = ctx.session!.user;
  const userId = userSession.id;
  const tenantId = userSession.tenantId;

  if (!tenantId) {
    return ApiErrors.unauthorized("Tenant tidak ditemukan");
  }

  const page = Math.max(1, parseInt((ctx.query.page as string) || "1") || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt((ctx.query.limit as string) || "10") || 10),
  );

  return historyService.getHistory({
    userId,
    tenantId,
    page,
    limit,
  });
});
