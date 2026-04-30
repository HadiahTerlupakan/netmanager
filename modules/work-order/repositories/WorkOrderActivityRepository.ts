import { randomUUID } from "crypto";
import type {
  WorkOrderAssignments,
  WorkOrderAttachments,
  WorkOrderTasks,
  WorkOrderUpdates,
} from "@prisma/client";
import type {
  AddUpdateData,
  CreateTaskData,
  UpdateTaskData,
} from "../domain/ports/IWorkOrderRepository";
import type { Prisma } from "@prisma/client";
import type { prisma as defaultPrisma } from "@/lib/prisma";
import {
  addAssignment,
  addAttachment,
  addTask,
  addUpdate,
  deleteAttachment,
  deleteTask,
  getUpdates,
  removeAssignment,
  updateTask,
} from "./work-order-repository-activity";

type PrismaInstance = typeof defaultPrisma;
type TenantWhereProvider = () => Promise<Prisma.WorkOrdersWhereInput>;
type AddUpdateHandler = (data: AddUpdateData) => Promise<WorkOrderUpdates>;

export class WorkOrderActivityRepository {
  constructor(
    private readonly prisma: PrismaInstance,
    private readonly getTenantWhere: TenantWhereProvider,
  ) {}

  async addAssignment(
    workOrderId: string,
    userId: string,
    role?: string,
  ): Promise<WorkOrderAssignments> {
    return addAssignment(
      this.prisma,
      this.getTenantWhere,
      workOrderId,
      userId,
      role,
    );
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    await removeAssignment(this.prisma, this.getTenantWhere, assignmentId);
  }

  async addTask(data: CreateTaskData): Promise<WorkOrderTasks> {
    return addTask(this.prisma, this.getTenantWhere, data);
  }

  async updateTask(
    taskId: string,
    data: UpdateTaskData,
  ): Promise<WorkOrderTasks> {
    return updateTask(this.prisma, this.getTenantWhere, taskId, data);
  }

  async deleteTask(taskId: string): Promise<void> {
    await deleteTask(this.prisma, this.getTenantWhere, taskId);
  }

  async addUpdate(data: AddUpdateData): Promise<WorkOrderUpdates> {
    return addUpdate(this.prisma, data);
  }

  async getUpdates(workOrderId: string): Promise<WorkOrderUpdates[]> {
    return getUpdates(this.prisma, this.getTenantWhere, workOrderId);
  }

  async addAttachment(
    input: {
      workOrderId: string;
      fileName: string;
      filePath: string;
      fileSize: number;
      fileType: string;
      caption?: string;
      uploadedById?: string;
    },
    addUpdateHandler: AddUpdateHandler,
  ): Promise<WorkOrderAttachments> {
    return addAttachment(
      this.prisma,
      this.getTenantWhere,
      addUpdateHandler,
      input.workOrderId,
      input.fileName,
      input.filePath,
      input.fileSize,
      input.fileType,
      input.caption,
      input.uploadedById,
    );
  }

  async deleteAttachment(
    attachmentId: string,
    deletedById: string | undefined,
    addUpdateHandler: AddUpdateHandler,
  ): Promise<void> {
    await deleteAttachment(
      this.prisma,
      this.getTenantWhere,
      addUpdateHandler,
      attachmentId,
      deletedById,
    );
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
