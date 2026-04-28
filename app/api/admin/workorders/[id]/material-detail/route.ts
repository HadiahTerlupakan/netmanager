import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { getAdminWorkOrderRouteService } from "@/modules/work-order";

/** GET /api/admin/workorders/[id]/material-detail */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const updateId = req.nextUrl.searchParams.get("updateId");

  if (!updateId) {
    return apiError("updateId wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const result = await getAdminWorkOrderRouteService().getMaterialDetail(
    ctx.params.id,
    updateId,
  );

  if (result.code === "NOT_FOUND") {
    return ApiErrors.notFound("Update");
  }

  if (result.code === "INVALID_WORK_ORDER") {
    return apiError(
      "Update tidak ditemukan pada work order ini",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  return apiSuccess(result.data);
});
