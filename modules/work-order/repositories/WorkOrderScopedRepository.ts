import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type {
  WorkOrderAssignments,
  WorkOrderAttachments,
  WorkOrderTasks,
  WorkOrderUpdates,
} from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/prisma";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type {
  AddUpdateData,
  CreateTaskData,
  UpdateTaskData,
} from "../domain/ports/IWorkOrderRepository";
import { WorkOrderReportingRepository } from "./WorkOrderReportingRepository";
import { WorkOrderActivityRepository } from "./WorkOrderActivityRepository";
import {
  addWorkOrderAttachment,
  deleteWorkOrderAttachment,
} from "./work-order-repository-attachments";

type PrismaInstance = typeof defaultPrisma;

export class WorkOrderScopedRepository extends WorkOrderReportingRepository {
  protected readonly activityRepository: WorkOrderActivityRepository;

  constructor(
    protected override readonly prisma: PrismaInstance = defaultPrisma,
  ) {
    super(prisma);
    this.activityRepository = new WorkOrderActivityRepository(this.prisma, () =>
      this.getTenantWhere(),
    );
  }

  /** Ambil filter tenant isolation dari request context. */
  protected async getTenantWhere(): Promise<Prisma.WorkOrdersWhereInput> {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (isSuperAdmin) return {};
    if (!tenantId) return { tenantId: "___MISSING_TENANT_ID___" };
    return { tenantId };
  }

  async addAssignment(
    workOrderId: string,
    userId: string,
    role?: string,
  ): Promise<WorkOrderAssignments> {
    return this.activityRepository.addAssignment(workOrderId, userId, role);
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    await this.activityRepository.removeAssignment(assignmentId);
  }

  async addTask(data: CreateTaskData): Promise<WorkOrderTasks> {
    return this.activityRepository.addTask(data);
  }

  async updateTask(
    taskId: string,
    data: UpdateTaskData,
  ): Promise<WorkOrderTasks> {
    return this.activityRepository.updateTask(taskId, data);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.activityRepository.deleteTask(taskId);
  }

  async completeTask(taskId: string, userId: string): Promise<WorkOrderTasks> {
    return this.updateTask(taskId, {
      status: "COMPLETED",
      completedById: userId,
    });
  }

  async addUpdate(data: AddUpdateData): Promise<WorkOrderUpdates> {
    return this.activityRepository.addUpdate(data);
  }

  async getUpdates(workOrderId: string): Promise<WorkOrderUpdates[]> {
    return this.activityRepository.getUpdates(workOrderId);
  }

  async addAttachment(
    workOrderId: string,
    fileName: string,
    filePath: string,
    fileSize: number,
    fileType: string,
    caption?: string,
    uploadedById?: string,
  ): Promise<WorkOrderAttachments> {
    return addWorkOrderAttachment({
      activityRepository: this.activityRepository,
      addUpdate: (data) => this.addUpdate(data),
      workOrderId,
      fileName,
      filePath,
      fileSize,
      fileType,
      caption,
      uploadedById,
    });
  }

  async deleteAttachment(
    attachmentId: string,
    deletedById?: string,
  ): Promise<void> {
    await deleteWorkOrderAttachment({
      activityRepository: this.activityRepository,
      addUpdate: (data) => this.addUpdate(data),
      attachmentId,
      deletedById,
    });
  }

  async addComment(
    workOrderId: string,
    message: string,
    userId: string,
  ): Promise<WorkOrderUpdates> {
    return this.prisma.workOrderUpdates.create({
      data: {
        id: randomUUID(),
        workOrderId,
        updateType: "COMMENT",
        message,
        createdById: userId,
      },
    });
  }
}
