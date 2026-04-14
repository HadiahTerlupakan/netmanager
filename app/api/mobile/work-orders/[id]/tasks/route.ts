import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { prisma } from "@/modules/database";
import {
  WorkOrderRepository,
  validateMobileAssignedWorkOrderAccess,
} from "@/modules/work-order";
import { socketEmitter } from "@/lib/websocket/emitter";
import { notifyAdminsAboutMobileAction } from "@/modules/notification";
import { apiError, ErrorCodes } from "@/lib/api-response";

// PATCH - Update Task Status
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const userId = authResult.id as string;
    const userName = (authResult.name as string) || "Unknown";
    const tenantId = authResult.tenantId as string;
    const workOrderId = params.id;
    const body = await request.json();
    const { taskId, isCompleted } = body;

    if (!taskId) {
      return apiError("Task ID wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const repository = new WorkOrderRepository(prisma);

    try {
      await validateMobileAssignedWorkOrderAccess({
        repository,
        workOrderId,
        userContext: {
          id: userId,
          name: userName,
          role: authResult.role as string | undefined,
          permissions: [],
          siteId: authResult.siteId as string | undefined,
          departmentId: authResult.departmentId as string | undefined,
          tenantId,
          isSuperAdmin: Boolean(authResult.isSuperAdmin),
        },
        allowedStatuses: ["ASSIGNED", "IN_PROGRESS", "ON_HOLD"],
        invalidStatusMessage:
          "Work order harus dalam status ASSIGNED, IN_PROGRESS, atau ON_HOLD",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan server";
      if (message.includes("tidak ditemukan")) {
        return apiError(message, ErrorCodes.NOT_FOUND, { status: 404 });
      }
      if (
        message.includes("Akses ditolak") ||
        message.includes("tidak memiliki akses")
      ) {
        return apiError(message, ErrorCodes.FORBIDDEN, { status: 403 });
      }
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    const task = await prisma.workOrderTasks.findFirst({
      where: { id: taskId, tenantId, workOrderId },
      select: { title: true },
    });

    if (!task) {
      return apiError(
        "Task tidak ditemukan pada work order ini",
        ErrorCodes.NOT_FOUND,
        { status: 404 },
      );
    }

    await repository.updateTask(taskId, {
      status: isCompleted ? "COMPLETED" : "PENDING",
      completedById: isCompleted ? userId : undefined,
    });

    const updatedWO = await repository.findById(workOrderId);

    if (updatedWO) {
      socketEmitter.updateWorkOrder(updatedWO);

      await notifyAdminsAboutMobileAction({
        workOrderId,
        workOrderNumber: updatedWO.workOrderNumber,
        title: updatedWO.title,
        actionType: "NOTE",
        actionMessage: isCompleted
          ? `Menyelesaikan task: ${task.title || "Unknown"}`
          : `Membatalkan task: ${task.title || "Unknown"}`,
        triggeredByUserId: userId,
        triggeredByName: userName,
        ...(updatedWO.departmentId && { departmentId: updatedWO.departmentId }),
        ...(updatedWO.siteId && { siteId: updatedWO.siteId }),
      }).catch((err) => console.error("[TaskNotify] Error:", err));
    }

    return NextResponse.json({
      success: true,
      message: "Task berhasil diupdate",
    });
  } catch (error) {
    console.error("Task Update Error:", error);
    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
