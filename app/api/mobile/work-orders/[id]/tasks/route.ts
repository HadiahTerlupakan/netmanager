import { NextRequest, NextResponse } from "next/server";

import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { MobileWorkOrderActionService } from "@/modules/work-order";

const service = new MobileWorkOrderActionService();

/**
 * Update mobile work order task status.
 */
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

    const body = await request.json();
    if (!body.taskId) {
      return apiError("Task ID wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    await service.updateTaskStatus({
      workOrderId: params.id,
      taskId: body.taskId,
      isCompleted: Boolean(body.isCompleted),
      tenantId: authResult.tenantId as string,
      actor: {
        id: authResult.id as string,
        name: (authResult.name as string) || "Unknown",
        role: authResult.role as string | undefined,
        siteId: authResult.siteId as string | undefined,
        tenantId: authResult.tenantId as string,
        isSuperAdmin: Boolean(authResult.isSuperAdmin),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Task berhasil diupdate",
    });
  } catch (error) {
    console.error("Task Update Error:", error);

    if (error instanceof Error && error.message === "TASK_NOT_FOUND") {
      return apiError(
        "Task tidak ditemukan pada work order ini",
        ErrorCodes.NOT_FOUND,
        { status: 404 },
      );
    }

    if (error instanceof Error && error.message === "WORK_ORDER_NOT_FOUND") {
      return apiError("Work Order tidak ditemukan", ErrorCodes.NOT_FOUND, {
        status: 404,
      });
    }

    if (
      error instanceof Error &&
      (error.message.includes("Akses ditolak") ||
        error.message.includes("tidak memiliki akses"))
    ) {
      return apiError(error.message, ErrorCodes.FORBIDDEN, { status: 403 });
    }

    if (error instanceof Error) {
      return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
