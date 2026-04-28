import { createHandler, apiPaginated } from "@/lib/api";
import { getEmployeeWorkOrderQueryService } from "@/modules/work-order";

/**
 * List mobile work orders for current user.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const userId = ctx.session!.user.id;
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") || "active";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const result = await getEmployeeWorkOrderQueryService().getMobileWorkOrders(
    userId,
    type,
    page,
    limit,
  );

  return apiPaginated(result.workOrders, {
    page: result.page,
    total: result.total,
    limit,
  });
});
