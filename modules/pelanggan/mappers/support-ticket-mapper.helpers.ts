import type { TicketReplies } from "@prisma/client";

import type {
  TicketAttachmentDTO,
  TicketMessageDTO,
} from "../dto/SupportTicketDTO";
import type {
  SupportTicketAttachmentEntity,
  SupportTicketReplyEntity,
} from "../domain/entities/SupportTicketEntity";

type ReplyRelation = Partial<TicketReplies> & {
  createdAt: Date;
  message: string;
  isFromAdmin: boolean;
  sender?: {
    id: string;
    name: string | null;
    image?: string | null;
    email?: string;
  } | null;
  user?: {
    id: string;
    name: string | null;
    image?: string | null;
    email?: string;
  } | null;
};

export function mapReplyEntities(
  replies: Array<ReplyRelation> | undefined | null,
): SupportTicketReplyEntity[] {
  return (replies ?? []).map((reply) => ({
    id: reply.id,
    createdAt: reply.createdAt,
    message: reply.message,
    isFromAdmin: reply.isFromAdmin,
    user: reply.sender ?? reply.user ?? null,
  }));
}

export function mapMessages(
  replies: SupportTicketReplyEntity[],
): TicketMessageDTO[] {
  return replies.map((reply) => ({
    id: reply.id ?? "",
    message: reply.message,
    isFromAdmin: reply.isFromAdmin,
    createdAt: reply.createdAt.toISOString(),
    sender: reply.user
      ? {
          id: reply.user.id ?? "",
          name: reply.user.name ?? null,
          type: reply.isFromAdmin ? "admin" : "customer",
        }
      : null,
    attachments: [] as TicketAttachmentDTO[],
  }));
}

export function mapAttachments(
  attachments: SupportTicketAttachmentEntity[] = [],
): TicketAttachmentDTO[] {
  return attachments.map((attachment) => ({
    id: attachment.id,
    fileName: attachment.fileName,
    fileUrl: attachment.fileUrl,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize,
  }));
}
