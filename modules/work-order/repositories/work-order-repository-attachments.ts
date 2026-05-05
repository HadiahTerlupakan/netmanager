import type {
  SupportTickets,
  WorkOrderAttachments,
  WorkOrders,
  WorkOrderUpdates,
} from "@prisma/client";

import type { WorkOrderActivityRepository } from "./WorkOrderActivityRepository";
import type { AddUpdateData } from "../domain/ports/IWorkOrderRepository";

type PrismaInstance = typeof import("@/lib/prisma").prisma;

export function addWorkOrderAttachment(input: {
  activityRepository: WorkOrderActivityRepository;
  addUpdate: (data: AddUpdateData) => Promise<WorkOrderUpdates>;
  workOrderId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  caption?: string;
  uploadedById?: string;
}): Promise<WorkOrderAttachments> {
  return input.activityRepository.addAttachment(
    buildAttachmentPayload(input),
    input.addUpdate,
  );
}

function buildAttachmentPayload(input: {
  workOrderId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  caption?: string;
  uploadedById?: string;
}) {
  return {
    workOrderId: input.workOrderId,
    fileName: input.fileName,
    filePath: input.filePath,
    fileSize: input.fileSize,
    fileType: input.fileType,
    caption: input.caption,
    uploadedById: input.uploadedById,
  };
}

export async function deleteWorkOrderAttachment(input: {
  activityRepository: WorkOrderActivityRepository;
  addUpdate: (data: AddUpdateData) => Promise<WorkOrderUpdates>;
  attachmentId: string;
  deletedById?: string;
}) {
  await input.activityRepository.deleteAttachment(
    input.attachmentId,
    input.deletedById,
    input.addUpdate,
  );
}

export function findWorkOrderWithTicketAndAttachments(input: {
  prisma: PrismaInstance;
  id: string;
}): Promise<
  | (WorkOrders & {
      ticket: SupportTickets | null;
      attachments: WorkOrderAttachments[];
    })
  | null
> {
  return input.prisma.workOrders.findUnique({
    where: { id: input.id },
    include: { ticket: true, attachments: true },
  }) as Promise<
    | (WorkOrders & {
        ticket: SupportTickets | null;
        attachments: WorkOrderAttachments[];
      })
    | null
  >;
}

export function findWorkOrdersByTicketId(input: {
  prisma: PrismaInstance;
  ticketId: string;
}): Promise<WorkOrders[]> {
  return input.prisma.workOrders.findMany({
    where: { ticketId: input.ticketId },
  });
}
