import { logger } from "@/lib/logger";
import { WorkOrderEventDispatcher } from "@/modules/events";
import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { validateWorkOrderAccess as validateWorkOrderAccessHelper } from "./work-order-access";
import { invalidateWorkOrderCaches } from "./work-order-side-effects";
import type {
  ServiceResult,
  UserContext,
} from "./work-order-service.contracts";

type WorkOrderActivityRepositoryPort = Pick<
  WorkOrderRepository,
  "addComment" | "addTask" | "addAttachment" | "deleteAttachment" | "findById"
>;

export class WorkOrderActivityService {
  constructor(private readonly repository: WorkOrderActivityRepositoryPort) {}

  /** Add a comment to a work order. */
  async addComment(
    workOrderId: string,
    message: string,
    userContext: UserContext,
  ): Promise<ServiceResult<unknown>> {
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);
      const comment = await this.repository.addComment(
        workOrderId,
        message,
        userContext.id,
      );
      await WorkOrderEventDispatcher.onActivity({
        workOrderId,
        activityId: (comment as { id: string }).id,
        activityType: "comment",
        message,
        tenantId: userContext.tenantId,
        triggeredBy: userContext.id,
      }).catch((err) =>
        logger.error(
          "Failed to publish WORK_ORDER_ACTIVITY event",
          err instanceof Error ? err : undefined,
        ),
      );
      return { success: true, data: comment };
    } catch (error) {
      return this.operationFailed(error, "Gagal menambahkan komentar");
    }
  }

  /** Add a task to a work order. */
  async addTask(
    workOrderId: string,
    taskData: { title: string; description?: string; order?: number },
    userContext: UserContext,
  ): Promise<ServiceResult<unknown>> {
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);
      const task = await this.repository.addTask({
        workOrderId,
        title: taskData.title,
        ...(taskData.description && { description: taskData.description }),
        ...(taskData.order !== undefined && { order: taskData.order }),
      });
      return { success: true, data: task };
    } catch (error) {
      return this.operationFailed(error, "Gagal menambahkan tugas");
    }
  }

  /** Add attachment to work order. */
  async addAttachment(
    workOrderId: string,
    data: {
      fileName: string;
      filePath: string;
      fileSize: number;
      fileType: string;
      caption?: string;
    },
    userContext: UserContext,
  ): Promise<ServiceResult<unknown>> {
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);
      const attachment = await this.repository.addAttachment(
        workOrderId,
        data.fileName,
        data.filePath,
        data.fileSize,
        data.fileType,
        data.caption,
        userContext.id,
      );
      await invalidateWorkOrderCaches();
      return { success: true, data: attachment };
    } catch (error) {
      logger.error(
        "WorkOrderActivityService.addAttachment failed",
        error instanceof Error ? error : undefined,
      );
      return this.operationFailed(
        error,
        "Gagal menambahkan lampiran",
        "UPLOAD_ERROR",
      );
    }
  }

  /** Delete attachment from work order. */
  async deleteAttachment(
    workOrderId: string,
    attachmentId: string,
    userContext: UserContext,
  ): Promise<ServiceResult<void>> {
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);
      const workOrder = await this.repository.findById(workOrderId);
      if (!workOrder) return this.notFound("Work order tidak ditemukan");

      const attachment = workOrder.attachments?.find(
        (a) => a.id === attachmentId,
      );
      if (!attachment) {
        return this.notFound("Lampiran tidak ditemukan pada work order ini");
      }

      await this.repository.deleteAttachment(attachmentId, userContext.id);
      await invalidateWorkOrderCaches();
      return { success: true };
    } catch (error) {
      logger.error(
        "WorkOrderActivityService.deleteAttachment failed",
        error instanceof Error ? error : undefined,
      );
      return this.operationFailed(
        error,
        "Gagal menghapus lampiran",
        "DELETE_ERROR",
      ) as ServiceResult<void>;
    }
  }

  private async validateWorkOrderAccess(
    workOrderId: string,
    userContext: UserContext,
  ): Promise<WorkOrderWithRelations | null> {
    return validateWorkOrderAccessHelper({
      repository: this.repository as WorkOrderRepository,
      workOrderId,
      userContext,
    });
  }

  private notFound(error: string): ServiceResult<void> {
    return { success: false, error, code: "NOT_FOUND" };
  }

  private operationFailed(
    error: unknown,
    fallback: string,
    fallbackCode: string = "OPERATION_FAILED",
  ): ServiceResult<unknown> {
    logger.error(fallback, error instanceof Error ? error : undefined);
    return {
      success: false,
      error: error instanceof Error ? error.message : fallback,
      code:
        error instanceof Error && error.message.includes("Akses ditolak")
          ? "FORBIDDEN"
          : fallbackCode,
    };
  }
}
