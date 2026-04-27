import { MobileAttendanceHistoryRouteService } from "@/modules/attendance";
import { createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

const historyService = new MobileAttendanceHistoryRouteService();

export const GET = createHandler({ auth: true }, async (_request, ctx) => {
  const userSession = ctx.session!.user;
  const userId = userSession.id;
  const tenantId = userSession.tenantId as string;
  const page = parseInt((ctx.query.page as string) || "1");
  const limit = parseInt((ctx.query.limit as string) || "10");

  return historyService.getHistory({
    userId,
    tenantId,
    page,
    limit,
  });
});
