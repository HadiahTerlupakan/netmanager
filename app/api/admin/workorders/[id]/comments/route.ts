import { prisma } from "@/modules/database";
import { getWorkOrderService } from "@/modules/work-order";
import { socketEmitter } from "@/lib/websocket/emitter";
import { hasPermission } from "@/lib/rbac";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import { createNotification } from "@/modules/notification";
import { onWorkOrderUpdated } from "@/modules/work-order";

interface CommentData {
  id: string;
  message: string;
  createdAt: Date;
  userId: string;
}

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("list:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menambah komentar",
    );
  }

  const body = await req.json();
  const { message } = body;

  if (!message) {
    return apiError("Pesan wajib diisi", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  // Fetch user details for context
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { siteId: true, departmentId: true, role: true },
  });
  if (!dbUser) return ApiErrors.unauthorized();

  // Use service to add comment
  const workOrderService = getWorkOrderService();
  const result = await workOrderService.addComment(id, message, {
    id: user.id,
    role: user.role,
    permissions: ctx.permissions,
    siteId: dbUser.siteId || undefined,
    departmentId: dbUser.departmentId || undefined,
  });

  if (!result.success) {
    if (result.code === "FORBIDDEN") {
      return ApiErrors.forbidden(result.error || "Akses ditolak");
    }
    if (result.code === "NOT_FOUND") {
      return ApiErrors.notFound("Work Order");
    }
    return apiError(
      result.error || "Gagal menambah komentar",
      ErrorCodes.INTERNAL_ERROR,
      { status: 500 },
    );
  }

  const comment = result.data as CommentData;

  // Log activity
  await logger.logActivity({
    action: "CREATE",
    subject: "Work Order Comment",
    details: {
      workOrderId: id,
      commentId: comment.id,
      message: comment.message.substring(0, 100), // Log shortened message
    },
    userId: user.id,
  });

  // Emit WebSocket event for real-time Activity Timeline
  socketEmitter.workOrderActivity(id, {
    id: comment.id,
    type: "comment",
    message: comment.message,
    updateType: "COMMENT",
    createdAt: comment.createdAt.toISOString(),
    createdBy: user
      ? {
          id: user.id,
          ...(user.name ? { name: user.name } : {}),
        }
      : null,
  });

  // Send Push Notification to Assigned User
  try {
    const workOrder = await prisma.workOrders.findUnique({
      where: { id },
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        type: true,
        priority: true,
        departmentId: true,
        siteId: true,
        assignedToId: true,
        assignedTo: {
          select: { id: true, pushToken: true, isActive: true },
        },
      },
    });

    if (workOrder?.assignedTo?.isActive) {
      // Check if user is on leave
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const isOnLeave = await prisma.leaveRequest.findFirst({
        where: {
          userId: workOrder.assignedTo.id,
          status: "APPROVED",
          startDate: { lte: now },
          endDate: { gte: startOfToday },
        },
      });

      await createNotification({
        type: "WORK_ORDER",
        priority: "NORMAL",
        title: `Komentar Baru: ${workOrder.workOrderNumber}`,
        message: `${user.name || "Admin"}: ${message.substring(0, 100)}`,
        link: `/admin/workorders/${id}`,
        userId: workOrder.assignedTo.id,
        sourceType: "WORK_ORDER",
        sourceId: id,
        skipExpoPush: Boolean(isOnLeave),
      });

      await onWorkOrderUpdated(
        {
          id: workOrder.id,
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          type: workOrder.type,
          priority: workOrder.priority,
          departmentId: workOrder.departmentId,
          siteId: workOrder.siteId,
          assignedToId: workOrder.assignedToId,
        },
        `${user.name || "Admin"}: ${message.substring(0, 100)}`,
        user.name || "Admin",
        user.id,
        [workOrder.assignedTo.id],
      );
    }
  } catch (error) {
    console.error("Failed to send comment notification:", error);
  }

  return apiSuccess(comment, {
    status: 201,
    message: "Komentar berhasil ditambahkan",
  });
});
