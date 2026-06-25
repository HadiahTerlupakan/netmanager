import { randomUUID } from "crypto";
import {
  Prisma,
  type PrismaClient,
  type WorkOrderAssignments,
  type WorkOrderAttachments,
  type WorkOrderTasks,
  type WorkOrderUpdates,
} from "@prisma/client";
import { socketEmitter } from "@/lib/websocket/emitter";
import type {
  AddUpdateData,
  CreateTaskData,
  UpdateTaskData,
} from "../domain/ports/IWorkOrderRepository";

export async function addAssignment(
  prisma: PrismaClient,
  getTenantWhere: () => Promise<Prisma.WorkOrdersWhereInput>,
  workOrderId: string,
  userId: string,
  role?: string,
): Promise<WorkOrderAssignments> {
  const tenantWhere = await getTenantWhere();
  const normalizedRole = role ?? null;
  // Verify parent WO exists in this tenant
  const wo = await prisma.workOrders.findFirst({
    where: { id: workOrderId, ...tenantWhere },
  });
  if (!wo) throw new Error("Work order not found or access denied");
  const existingAssignment = await prisma.workOrderAssignments.findFirst({
    where: {
      workOrderId,
      userId,
      role: normalizedRole,
      workOrders: tenantWhere,
    },
  });
  if (existingAssignment) {
    return existingAssignment;
  }
  try {
    return await prisma.workOrderAssignments.create({
      data: {
        id: randomUUID(),
        workOrderId,
        userId,
        role: normalizedRole,
        tenantId: wo.tenantId,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const duplicateAssignment = await prisma.workOrderAssignments.findFirst({
        where: {
          workOrderId,
          userId,
          role: normalizedRole,
          workOrders: tenantWhere,
        },
      });
      if (duplicateAssignment) {
        return duplicateAssignment;
      }
    }
    throw error;
  }
}
export async function removeAssignment(
  prisma: PrismaClient,
  getTenantWhere: () => Promise<Prisma.WorkOrdersWhereInput>,
  assignmentId: string,
): Promise<void> {
  const tenantWhere = await getTenantWhere();
  const result = await prisma.workOrderAssignments.deleteMany({
    where: {
      id: assignmentId,
      workOrders: { ...tenantWhere },
    },
  });
  if (result.count === 0)
    throw new Error("Assignment not found or access denied");
}
export async function addTask(
  prisma: PrismaClient,
  getTenantWhere: () => Promise<Prisma.WorkOrdersWhereInput>,
  data: CreateTaskData,
): Promise<WorkOrderTasks> {
  const tenantWhere = await getTenantWhere();
  // Verify parent WO exists in this tenant
  const wo = await prisma.workOrders.findFirst({
    where: { id: data.workOrderId, ...tenantWhere },
  });
  if (!wo) throw new Error("Work order not found or access denied");
  return prisma.workOrderTasks.create({
    data: {
      id: randomUUID(),
      ...data,
      status: "PENDING",
      updatedAt: new Date(),
      tenantId: wo.tenantId,
    },
  });
}
export async function updateTask(
  prisma: PrismaClient,
  getTenantWhere: () => Promise<Prisma.WorkOrdersWhereInput>,
  taskId: string,
  data: UpdateTaskData,
): Promise<WorkOrderTasks> {
  const tenantWhere = await getTenantWhere();
  const updateData: Record<string, unknown> = { ...data };
  if (data.status === "COMPLETED" && data.completedById) {
    updateData.completedAt = new Date();
  }
  const result = await prisma.workOrderTasks.updateMany({
    where: {
      id: taskId,
      workOrders: { ...tenantWhere },
    },
    data: updateData as Prisma.WorkOrderTasksUpdateInput,
  });
  if (result.count === 0) throw new Error("Task not found or access denied");
  return prisma.workOrderTasks.findUnique({
    where: { id: taskId },
  }) as Promise<WorkOrderTasks>;
}
export async function deleteTask(
  prisma: PrismaClient,
  getTenantWhere: () => Promise<Prisma.WorkOrdersWhereInput>,
  taskId: string,
): Promise<void> {
  const tenantWhere = await getTenantWhere();
  const result = await prisma.workOrderTasks.deleteMany({
    where: {
      id: taskId,
      workOrders: { ...tenantWhere },
    },
  });
  if (result.count === 0) throw new Error("Task not found or access denied");
}
export async function addUpdate(
  prisma: PrismaClient,
  data: AddUpdateData,
): Promise<WorkOrderUpdates> {
  const wo = await prisma.workOrders.findUnique({
    where: { id: data.workOrderId },
    select: { tenantId: true },
  });
  if (!wo) throw new Error("Work order not found");
  const update = await prisma.workOrderUpdates.create({
    data: {
      id: randomUUID(),
      workOrderId: data.workOrderId,
      updateType: data.updateType,
      message: data.message,
      oldStatus: data.oldStatus ?? null,
      newStatus: data.newStatus ?? null,
      createdById: data.createdById ?? null,
      tenantId: wo.tenantId,
    },
  });
  // NOTE: Notification moved to Service layer
  // Fetch creator for socket payload
  let createdByUser = null;
  if (data.createdById) {
    createdByUser = await prisma.user.findUnique({
      where: { id: data.createdById },
      select: { id: true, name: true },
    });
  }
  // Socket Emit for Realtime Updates
  // Map updateType to valid activity type
  let activityType: "comment" | "update" | "attachment" = "update";
  if (data.updateType === "COMMENT") activityType = "comment";
  if (data.updateType === "PHOTO") activityType = "attachment";
  socketEmitter.workOrderActivity(data.workOrderId, {
    id: update.id,
    type: activityType,
    message: data.message,
    updateType: data.updateType,
    createdAt: update.createdAt.toISOString(),
    createdBy: createdByUser
      ? {
          id: createdByUser.id,
          ...(createdByUser.name && { name: createdByUser.name }),
        }
      : null,
  });
  return update;
}
export async function getUpdates(
  prisma: PrismaClient,
  getTenantWhere: () => Promise<Prisma.WorkOrdersWhereInput>,
  workOrderId: string,
): Promise<WorkOrderUpdates[]> {
  const tenantWhere = await getTenantWhere();
  return prisma.workOrderUpdates.findMany({
    where: {
      workOrderId,
      workOrders: { ...tenantWhere },
    },
    orderBy: { createdAt: "desc" },
  });
}
export async function addAttachment(
  prisma: PrismaClient,
  getTenantWhere: () => Promise<Prisma.WorkOrdersWhereInput>,
  addUpdateFn: (data: AddUpdateData) => Promise<WorkOrderUpdates>,
  workOrderId: string,
  fileName: string,
  filePath: string,
  fileSize: number,
  fileType: string,
  caption?: string,
  uploadedById?: string,
): Promise<WorkOrderAttachments> {
  const tenantWhere = await getTenantWhere();
  // Verify parent WO exists in this tenant
  const wo = await prisma.workOrders.findFirst({
    where: { id: workOrderId, ...tenantWhere },
  });
  if (!wo) throw new Error("Work order not found or access denied");
  const attachment = await prisma.workOrderAttachments.create({
    data: {
      id: randomUUID(),
      workOrderId,
      fileName,
      filePath,
      fileSize,
      fileType,
      caption: caption ?? null,
      uploadedById: uploadedById ?? null,
      tenantId: wo.tenantId,
    },
  });
  // Log photo upload
  const updateData: AddUpdateData = {
    workOrderId,
    updateType: "PHOTO",
    message: caption || `Photo uploaded: ${fileName}`,
  };
  if (uploadedById) {
    updateData.createdById = uploadedById;
  }
  await addUpdateFn(updateData);
  return attachment;
}
export async function deleteAttachment(
  prisma: PrismaClient,
  getTenantWhere: () => Promise<Prisma.WorkOrdersWhereInput>,
  addUpdateFn: (data: AddUpdateData) => Promise<WorkOrderUpdates>,
  attachmentId: string,
  deletedById?: string,
): Promise<void> {
  const tenantWhere = await getTenantWhere();
  const attachment = await prisma.workOrderAttachments.findFirst({
    where: {
      id: attachmentId,
      workOrders: { ...tenantWhere },
    },
  });
  if (!attachment) throw new Error("Attachment not found or access denied");
  await prisma.workOrderAttachments.delete({
    where: { id: attachmentId },
  });
  // Log deletion to timeline (triggers socket event -> triggers UI refresh)
  const updateData: AddUpdateData = {
    workOrderId: attachment.workOrderId,
    updateType: "NOTE",
    message: `Menghapus lampiran: ${attachment.fileName}`,
  };
  if (deletedById) {
    updateData.createdById = deletedById;
  }
  await addUpdateFn(updateData);
}
