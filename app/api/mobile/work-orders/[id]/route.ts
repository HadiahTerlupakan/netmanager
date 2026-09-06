import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";
import { getEmployeeWorkOrderQueryService } from "@/modules/work-order";

/** Mengambil detail work order mobile untuk user yang berhak. */
export const GET = createHandler(
  { auth: true, permissions: ["m_work_order:read"] },
  async (_req, ctx) => {
    const workOrderId = ctx.params.id;
    const user = ctx.session!.user;

    try {
      const workOrder =
        await getEmployeeWorkOrderQueryService().getMobileWorkOrderDetail(
          workOrderId,
          {
            id: user.id,
            name: user.name ?? undefined,
            role: user.role as string | undefined,
            siteId: user.siteId as string | undefined,
            tenantId: user.tenantId as string | undefined,
            isSuperAdmin: Boolean(user.isSuperAdmin),
          },
        );

      return apiSuccess(workOrder);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan server";
      if (message.includes("tidak ditemukan")) {
        return ApiErrors.notFound("Work Order");
      }
      if (
        message.includes("Akses ditolak") ||
        message.includes("tidak memiliki akses") ||
        message.includes("tidak dapat diakses pada status ini")
      ) {
        return ApiErrors.forbidden(message);
      }
      return apiError(message, ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }
  },
);
