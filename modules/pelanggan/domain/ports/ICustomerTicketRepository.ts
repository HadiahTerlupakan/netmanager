/**
 * Abstraction for customer ticket repository operations.
 */

import type {
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@prisma/client";
import type {
  SupportTicketEntity,
  SupportTicketListResultEntity,
} from "../entities/SupportTicketEntity";
import type { CustomerTicketListItemDTO } from "../../mappers/SupportTicketMapper";

export interface ICustomerTicketRepository {
  /** Get customer tickets with pagination. */
  findAllForCustomer(
    pelangganId: string,
    options: { page: number; limit: number; status?: string },
  ): Promise<SupportTicketListResultEntity>;

  /** Get ticket count created today. */
  getCountForToday(): Promise<number>;

  /** Count unread customer notifications. */
  countUnreadCustomerNotifications(pelangganId: string): Promise<number>;

  /** Create support ticket. */
  create(data: {
    pelangganId: string;
    ticketNumber: string;
    category: TicketCategory;
    priority: TicketPriority;
    subject: string;
    description: string;
  }): Promise<SupportTicketEntity>;

  /** Map ticket entities into customer response DTOs. */
  mapCustomerTicketResponses(
    tickets: SupportTicketEntity[],
  ): CustomerTicketListItemDTO[];

  /** Build customer pagination metadata. */
  buildCustomerTicketPagination(
    page: number,
    limit: number,
    total: number,
  ): ReturnType<typeof import("@/lib/utils/pagination").buildPaginationMeta>;

  /** Get admin ticket list. */
  findAllAdmin(
    where: Prisma.SupportTicketsWhereInput,
    skip: number,
    take: number,
  ): Promise<SupportTicketEntity[]>;

  /** Count admin tickets. */
  countAdmin(where: Prisma.SupportTicketsWhereInput): Promise<number>;

  /** Get grouped admin ticket counts by status. */
  getStatusCounts(
    where: Prisma.SupportTicketsWhereInput,
  ): Promise<Array<{ status: string; _count: { status: number } }>>;

  /** Get closed tickets with rating replies. */
  getClosedTicketsWithReplies(
    where: Prisma.SupportTicketsWhereInput,
  ): Promise<Array<{ replies: Array<{ message: string }> }>>;

  /** Get admin ticket detail by id. */
  findByIdAdmin(id: string): Promise<SupportTicketEntity | null>;

  /** Get minimal ticket detail by id. */
  findByIdBasic(id: string): Promise<SupportTicketEntity | null>;

  /** Update admin ticket. */
  updateAdmin(
    id: string,
    updateData: Prisma.SupportTicketsUpdateInput,
  ): Promise<SupportTicketEntity>;

  /** Create reply for ticket. */
  createReply(data: {
    ticketId: string;
    message: string;
    isFromAdmin: boolean;
    senderId?: string;
    pelangganId?: string;
    attachments?: string[];
  }): Promise<unknown>;

  /** Count active tickets whose latest reply is from customer. */
  countNeedsReplyAdmin(status: TicketStatus, siteId?: string): Promise<number>;

  /** Get customer-owned ticket detail by id. */
  findByIdForCustomer(
    id: string,
    pelangganId: string,
  ): Promise<SupportTicketEntity | null>;

  /** Update ticket status for customer-owned ticket. */
  updateCustomerStatus(
    id: string,
    pelangganId: string,
    status: string,
    closedAt?: Date,
  ): Promise<SupportTicketEntity | null>;

  /** Delete ticket by id. */
  delete(id: string): Promise<SupportTicketEntity>;
}
