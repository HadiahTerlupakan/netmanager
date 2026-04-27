/**
 * SupportTicketMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { SupportTickets, TicketReplies } from "@prisma/client";
import type {
  TicketListItemDTO,
  TicketDetailDTO,
  TicketPortalDTO,
  TicketMessageDTO,
  TicketAttachmentDTO,
} from "../dto/SupportTicketDTO";

type CustomerTicketReplySummary = {
  createdAt: Date;
  message: string;
  isFromAdmin: boolean;
} | null;

export type CustomerTicketListItemDTO = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: SupportTickets["category"];
  priority: SupportTickets["priority"];
  status: SupportTickets["status"];
  createdAt: Date;
  updatedAt: Date;
  lastReply: CustomerTicketReplySummary;
  replyCount: number;
};

// Extended types with relations
type TicketWithRelations = SupportTickets & {
  pelanggan?: {
    id: string;
    idPelanggan: string;
    nama: string;
    email: string | null;
    noTelp: string | null;
  } | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  replies?: (TicketReplies & {
    sender?: {
      id: string;
      name: string | null;
    } | null;
  })[];
  _count?: {
    replies: number;
  };
  attachments?: {
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string | null;
    fileSize: number | null;
  }[];
};

export class SupportTicketMapper {
  /**
   * Map to list item DTO
   */
  static toListItem(entity: TicketWithRelations): TicketListItemDTO {
    const lastReply = entity.replies?.[entity.replies.length - 1];

    return {
      id: entity.id,
      ticketNumber: entity.ticketNumber,
      subject: entity.subject,
      category: entity.category,
      status: entity.status,
      priority: entity.priority,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      pelangganName: entity.pelanggan?.nama ?? null,
      assignedToName: entity.assignedTo?.name ?? null,
      lastReplyAt: lastReply?.createdAt?.toISOString() ?? null,
      unreadCount: 0, // Can be computed separately
    };
  }

  /**
   * Map array to list items
   */
  static toListItems(entities: TicketWithRelations[]): TicketListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }

  /**
   * Map to detail DTO
   */
  static toDetail(entity: TicketWithRelations): TicketDetailDTO {
    return {
      id: entity.id,
      ticketNumber: entity.ticketNumber,
      subject: entity.subject,
      description: entity.description ?? "",
      category: entity.category,
      status: entity.status,
      priority: entity.priority,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      closedAt: entity.closedAt?.toISOString() ?? null,
      pelanggan: entity.pelanggan
        ? {
            id: entity.pelanggan.id,
            idPelanggan: entity.pelanggan.idPelanggan,
            nama: entity.pelanggan.nama,
            email: entity.pelanggan.email,
            noTelp: entity.pelanggan.noTelp,
          }
        : null,
      assignedTo: entity.assignedTo
        ? {
            id: entity.assignedTo.id,
            name: entity.assignedTo.name,
            email: entity.assignedTo.email,
          }
        : null,
      messages: this.mapMessages(entity.replies ?? []),
      attachments: this.mapAttachments(entity.attachments ?? []),
    };
  }

  /**
   * Map to portal DTO (for customer)
   */
  static toPortal(
    entity: TicketWithRelations,
    hasNewReply: boolean = false,
  ): TicketPortalDTO {
    const lastReply = entity.replies?.[entity.replies.length - 1];

    return {
      id: entity.id,
      ticketNumber: entity.ticketNumber,
      subject: entity.subject,
      category: entity.category,
      status: entity.status,
      priority: entity.priority,
      createdAt: entity.createdAt.toISOString(),
      lastReplyAt: lastReply?.createdAt?.toISOString() ?? null,
      hasNewReply,
    };
  }

  /**
   * Map array to portal DTOs
   */
  static toPortalList(entities: TicketWithRelations[]): TicketPortalDTO[] {
    return entities.map((entity) => this.toPortal(entity));
  }

  /**
   * Map customer ticket entities into list responses.
   */
  static toCustomerList(
    entities: Array<{
      id: string;
      ticketNumber: string;
      subject: string;
      category: SupportTickets["category"];
      priority: SupportTickets["priority"];
      status: SupportTickets["status"];
      createdAt: Date;
      updatedAt: Date;
      replies?: Array<{
        createdAt: Date;
        message: string;
        isFromAdmin: boolean;
      }>;
      _count?: {
        replies: number;
      };
    }>,
  ): CustomerTicketListItemDTO[] {
    return entities.map((entity) => {
      const latestReply = entity.replies?.[0] ?? null;

      return {
        id: entity.id,
        ticketNumber: entity.ticketNumber,
        subject: entity.subject,
        category: entity.category,
        priority: entity.priority,
        status: entity.status,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        lastReply: latestReply,
        replyCount: entity._count?.replies ?? 0,
      };
    });
  }

  // ==================== Private Helpers ====================

  private static mapMessages(
    replies: (TicketReplies & {
      sender?: { id: string; name: string | null } | null;
    })[],
  ): TicketMessageDTO[] {
    return replies.map((reply) => ({
      id: reply.id,
      message: reply.message,
      isFromAdmin: reply.isFromAdmin,
      createdAt: reply.createdAt.toISOString(),
      sender: reply.sender
        ? {
            id: reply.sender.id,
            name: reply.sender.name,
            type: reply.isFromAdmin
              ? ("admin" as const)
              : ("customer" as const),
          }
        : null,
      attachments: [] as TicketAttachmentDTO[], // Attachments per message can be added if needed
    }));
  }

  private static mapAttachments(
    attachments: {
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string | null;
      fileSize: number | null;
    }[],
  ): TicketAttachmentDTO[] {
    return attachments.map((att) => ({
      id: att.id,
      fileName: att.fileName,
      fileUrl: att.fileUrl,
      fileType: att.fileType,
      fileSize: att.fileSize,
    }));
  }
}
