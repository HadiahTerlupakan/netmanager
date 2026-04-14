import { prisma } from "@/modules/database";
import { WorkOrderRepository } from "@/modules/work-order";
import { validateMobileAssignedWorkOrderAccess } from "@/modules/work-order";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

const MOBILE_DETAIL_STATUSES = [
  "REQUESTED",
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
] as const;

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const workOrderId = ctx.params.id;
  const repository = new WorkOrderRepository(prisma);
  const user = ctx.session!.user;

  try {
    const workOrder = await validateMobileAssignedWorkOrderAccess({
      repository,
      workOrderId,
      userContext: {
        id: user.id,
        name: user.name ?? undefined,
        role: user.role as string | undefined,
        permissions: [],
        siteId: user.siteId as string | undefined,
        tenantId: user.tenantId as string | undefined,
        isSuperAdmin: Boolean(user.isSuperAdmin),
      },
      allowedStatuses: [...MOBILE_DETAIL_STATUSES],
      invalidStatusMessage: "Work order tidak dapat diakses pada status ini",
    });

    return apiSuccess(workOrder);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Work Order tidak ditemukan");
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
});
