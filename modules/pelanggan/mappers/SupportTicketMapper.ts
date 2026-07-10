/**
 * SupportTicketMapper
 *
 * Transforms Prisma entities to domain entities and DTOs.
 */

import type { Status, SupportTickets } from "@prisma/client";
import type { SupportTicketEntity } from "../domain/entities/SupportTicketEntity";
import type {
  TicketDetailDTO,
  TicketListItemDTO,
  TicketPortalDTO,
} from "../dto/SupportTicketDTO";
import {
  mapAttachments,
  mapMessages,
  mapReplyEntities,
} from "./support-ticket-mapper.helpers";

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

type TicketWithRelations = SupportTickets & {
  pelanggan?: {
    id?: string;
    idPelanggan?: string;
    nama: string;
    email?: string | null;
    noTelp?: string | null;
    username?: string;
    alamat?: string | null;
    status?: Status;
    siteId?: string | null;
    hargaPaket?: { name: string } | null;
  } | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  user?: {
    id?: string;
    name: string | null;
    email?: string;
    image?: string | null;
  } | null;
  replies?: Parameters<typeof mapReplyEntities>[0];
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
  /** Map Prisma ticket into domain entity. */
  static toDomain(entity: TicketWithRelations): SupportTicketEntity {
    return {
      id: entity.id,
      ticketNumber: entity.ticketNumber,
      pelangganId: entity.pelangganId,
      subject: entity.subject,
      description: entity.description,
      category: entity.category,
      priority: entity.priority,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      resolvedAt: entity.resolvedAt,
      closedAt: entity.closedAt,
      rating: (entity as { rating?: number | null }).rating ?? null,
      pelanggan: entity.pelanggan
        ? {
            id: entity.pelanggan.id,
            idPelanggan: entity.pelanggan.idPelanggan,
            nama: entity.pelanggan.nama,
            username: entity.pelanggan.username,
            email: entity.pelanggan.email,
            noTelp: entity.pelanggan.noTelp,
            alamat: entity.pelanggan.alamat,
            status: entity.pelanggan.status,
            siteId: entity.pelanggan.siteId,
            hargaPaket: entity.pelanggan.hargaPaket,
          }
        : null,
      user: entity.user
        ? {
            id: entity.user.id ?? "",
            name: entity.user.name,
            email: entity.user.email,
            image: entity.user.image,
          }
        : null,
      assignedTo: entity.assignedTo
        ? {
            id: entity.assignedTo.id,
            name: entity.assignedTo.name,
            email: entity.assignedTo.email,
          }
        : null,
      replies: mapReplyEntities(entity.replies),
      attachments: mapAttachments(entity.attachments ?? []),
      replyCount: entity._count?.replies ?? 0,
    };
  }

  /** Map Prisma ticket list into domain entities. */
  static toDomainList(entities: TicketWithRelations[]): SupportTicketEntity[] {
    return entities.map((entity) => this.toDomain(entity));
  }

  /** Map domain entity into list DTO. */
  static toListItem(entity: SupportTicketEntity): TicketListItemDTO {
    const lastReply = entity.replies?.[entity.replies.length - 1];

    return {
      id: entity.id,
      ticketNumber: entity.ticketNumber,
      subject: entity.subject,
      category: entity.category as TicketListItemDTO["category"],
      status: entity.status as TicketListItemDTO["status"],
      priority: entity.priority as TicketListItemDTO["priority"],
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      pelangganName: entity.pelanggan?.nama ?? null,
      assignedToName: entity.assignedTo?.name ?? null,
      lastReplyAt: lastReply?.createdAt.toISOString() ?? null,
      unreadCount: 0,
      rating: entity.rating ?? null,
    };
  }

  /** Map domain entities into list DTOs. */
  static toListItems(entities: SupportTicketEntity[]): TicketListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }

  /** Map domain entity into detail DTO. */
  static toDetail(entity: SupportTicketEntity): TicketDetailDTO {
    return {
      id: entity.id,
      ticketNumber: entity.ticketNumber,
      subject: entity.subject,
      description: entity.description ?? "",
      category: entity.category as TicketDetailDTO["category"],
      status: entity.status as TicketDetailDTO["status"],
      priority: entity.priority as TicketDetailDTO["priority"],
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      closedAt: entity.closedAt?.toISOString() ?? null,
      rating: entity.rating ?? null,
      pelanggan: entity.pelanggan
        ? {
            id: entity.pelanggan.id ?? "",
            idPelanggan: entity.pelanggan.idPelanggan ?? "",
            nama: entity.pelanggan.nama,
            email: entity.pelanggan.email ?? null,
            noTelp: entity.pelanggan.noTelp ?? null,
          }
        : null,
      assignedTo: entity.assignedTo
        ? {
            id: entity.assignedTo.id,
            name: entity.assignedTo.name,
            email: entity.assignedTo.email ?? "",
          }
        : null,
      messages: mapMessages(entity.replies ?? []),
      attachments: mapAttachments(entity.attachments ?? []),
    };
  }

  /** Map domain entity into portal DTO. */
  static toPortal(
    entity: SupportTicketEntity,
    hasNewReply: boolean = false,
  ): TicketPortalDTO {
    const lastReply = entity.replies?.[entity.replies.length - 1];

    return {
      id: entity.id,
      ticketNumber: entity.ticketNumber,
      subject: entity.subject,
      category: entity.category as TicketPortalDTO["category"],
      status: entity.status as TicketPortalDTO["status"],
      priority: entity.priority as TicketPortalDTO["priority"],
      createdAt: entity.createdAt.toISOString(),
      lastReplyAt: lastReply?.createdAt.toISOString() ?? null,
      hasNewReply,
    };
  }

  /** Map domain entities into portal DTOs. */
  static toPortalList(entities: SupportTicketEntity[]): TicketPortalDTO[] {
    return entities.map((entity) => this.toPortal(entity));
  }

  /** Map domain entities into customer ticket list DTOs. */
  static toCustomerList(
    entities: SupportTicketEntity[],
  ): CustomerTicketListItemDTO[] {
    return entities.map((entity) => ({
      id: entity.id,
      ticketNumber: entity.ticketNumber,
      subject: entity.subject,
      category: entity.category as CustomerTicketListItemDTO["category"],
      priority: entity.priority as CustomerTicketListItemDTO["priority"],
      status: entity.status as CustomerTicketListItemDTO["status"],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      lastReply: entity.replies?.[0]
        ? {
            createdAt: entity.replies[0].createdAt,
            message: entity.replies[0].message,
            isFromAdmin: entity.replies[0].isFromAdmin,
          }
        : null,
      replyCount: entity.replyCount ?? 0,
    }));
  }
}
