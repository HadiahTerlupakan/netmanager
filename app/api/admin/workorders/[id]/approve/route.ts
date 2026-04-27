import {
  getWorkOrderService,
  adminWorkOrderRouteService,
  type UserContext,
} from "@/modules/work-order";
import { hasPermission } from "@/lib/rbac";
import { createNotification, sendPushToUsers } from "@/modules/notification";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";

/** POST /api/admin/workorders/[id]/approve */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;
  const hasApprovePermission =
    (await hasPermission("workorders:approve_request")) ||
    (await hasPermission("list:approve_request")) ||
    (await hasPermission("workorders:requests:approve"));

  if (!hasApprovePermission) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk approve/reject work order",
    );
  }

  const body = await req.json();

  if (!body.action || !["APPROVE", "REJECT"].includes(body.action)) {
    return apiError(
      "Action harus APPROVE atau REJECT",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  if (body.action === "REJECT" && !body.reason) {
    return apiError(
      "Alasan wajib diisi saat menolak",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const userContext = await adminWorkOrderRouteService.getUserContext(
    user,
    ctx.permissions,
  );

  if (!userContext) {
    return ApiErrors.unauthorized();
  }

  const workOrderService = getWorkOrderService();
  const getResult = await workOrderService.getWorkOrderById(
    id,
    userContext as UserContext,
  );

  if (!getResult.success) {
    if (getResult.code === "FORBIDDEN") {
      return ApiErrors.forbidden(getResult.error || "Akses ditolak");
    }

    return ApiErrors.notFound("Work Order");
  }

  const existingWO = getResult.data!;
  const result =
    body.action === "APPROVE"
      ? await workOrderService.approveRequest(id, userContext)
      : await workOrderService.rejectRequest(id, userContext, body.reason);

  if (!result.success) {
    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }

    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Work Order");
    }

    const statusCode = result.code === "INVALID_STATUS" ? 400 : 500;
    return apiError(
      result.error || "Gagal memproses request",
      ErrorCodes.INTERNAL_ERROR,
      { status: statusCode },
    );
  }

  await notifyRequester({
    requesterId: existingWO.requestedById,
    action: body.action,
    title: existingWO.title,
    workOrderId: id,
    reason: body.reason,
  });

  return apiSuccess(result.data, {
    message:
      body.action === "APPROVE"
        ? "Work order request berhasil disetujui"
        : "Work order request ditolak",
  });
});

/** Notify requester after approval result. */
async function notifyRequester(input: {
  requesterId?: string | null;
  action: "APPROVE" | "REJECT";
  title: string;
  workOrderId: string;
  reason?: string;
}) {
  if (!input.requesterId) {
    return;
  }

  const notificationTitle =
    input.action === "APPROVE"
      ? "✅ WO Request Disetujui"
      : "❌ WO Request Ditolak";
  const notificationMessage =
    input.action === "APPROVE"
      ? `Request Anda "${input.title}" telah disetujui and siap dikerjakan.`
      : `Request Anda "${input.title}" ditolak: ${input.reason}`;

  try {
    await createNotification({
      type: "WORK_ORDER",
      priority: input.action === "REJECT" ? "HIGH" : "NORMAL",
      title: notificationTitle,
      message: notificationMessage,
      link: `/admin/workorders/${input.workOrderId}`,
      userId: input.requesterId,
      sourceType: "WORK_ORDER",
      sourceId: input.workOrderId,
    });

    await sendPushToUsers(
      [input.requesterId],
      notificationTitle,
      notificationMessage,
      {
        workOrderId: input.workOrderId,
        type: "WO_REQUEST_RESULT",
        action: input.action,
        screen: "WorkOrderDetail",
      },
    );
  } catch {
    return;
  }
}
