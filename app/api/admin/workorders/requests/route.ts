import {
  getWorkOrderService,
  getAdminWorkOrderRouteService,
} from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** GET /api/admin/workorders/requests */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("workorders:requests:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat permintaan work order",
    );
  }

  const page = Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const limit = Number.parseInt(
    req.nextUrl.searchParams.get("limit") || "20",
    10,
  );
  const access = await getAdminWorkOrderRouteService().buildAccessFilters(
    user,
    ctx.permissions,
  );

  if (access.unauthorized) {
    return ApiErrors.unauthorized();
  }

  // `emptyResponse` menandai pengguna yang DIBATASI tetapi tidak punya
  // site/departemen. Tanpa cabang ini, alurnya jatuh ke parameter query dan
  // justru menampilkan seluruh permintaan WO di tenant — kebalikan dari maksud
  // pembatasannya. Daftar utama (`/api/admin/workorders`) sudah benar.
  if (access.emptyResponse) {
    return apiSuccess({
      data: [],
      pagination: { page, totalPages: 1, total: 0 },
      pendingCount: 0,
    });
  }

  const filters = getAdminWorkOrderRouteService().buildRequestListFilters({
    access,
    searchParams: req.nextUrl.searchParams,
  });

  const result = await getWorkOrderService().getWorkOrderRequests(
    filters,
    page,
    limit,
  );

  if (!result.success) {
    return apiError(
      result.error || "Gagal mengambil permintaan work order",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  return apiSuccess({
    data: result.data?.workOrders || [],
    pagination: {
      page: result.data?.page || page,
      totalPages: result.data?.totalPages || 1,
      total: result.data?.total || 0,
    },
    pendingCount: result.data?.total || 0,
  });
});
