import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { MobileWorkOrderActionService } from "@/modules/work-order";

const service = new MobileWorkOrderActionService();

/**
 * Update mobile work order task status.
 */
export const PATCH = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
    const body = await req.json();
    if (!body.taskId) {
      return apiError("Task ID wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    try {
      await service.updateTaskStatus({
        workOrderId: ctx.params.id,
        taskId: body.taskId,
        isCompleted: Boolean(body.isCompleted),
        tenantId: ctx.session!.user.tenantId as string,
        actor: {
          id: ctx.session!.user.id,
          name: ctx.session!.user.name || "Unknown",
          role: ctx.session!.user.role,
          siteId: ctx.session!.user.siteId,
          tenantId: ctx.session!.user.tenantId as string,
          isSuperAdmin: Boolean(ctx.session!.user.isSuperAdmin),
        },
      });

      return apiSuccess({ message: "Task berhasil diupdate" });
    } catch (error) {
      logger.error("Task Update Error:", error);

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
  },
);
