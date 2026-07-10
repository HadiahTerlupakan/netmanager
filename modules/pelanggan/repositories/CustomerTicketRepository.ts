import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import { buildCustomerTicketPagination as buildCustomerTicketPaginationMeta } from "./customer-ticket.repository.helpers";
import {
  countAdminTickets,
  countAdminTicketsNeedingReply,
  countUnreadCustomerTicketNotifications,
  createCustomerTicket,
  createTicketReply,
  deleteTicket,
  findAllAdminTickets,
  findAllTicketsForCustomer,
  findClosedTicketsWithReplies,
  getAdminTicketStatusCounts,
  getTodayTicketCount,
  updateAdminTicket,
  updateCustomerOwnedTicketStatus,
} from "./customer-ticket.repository.prisma-helpers";
import { getCustomerNotificationSummary } from "./customer-ticket-notification.repository-helpers";
import {
  findByIdAdmin,
  findByIdBasic,
  findByIdForCustomer,
} from "./customer-ticket-detail.repository-helpers";

import type {
  CustomerNotificationQuery,
  CustomerTicketQuery,
  CustomerTicketUpdateData,
  ICustomerTicketRepository,
} from "../domain/ports/ICustomerTicketRepository";
import { SupportTicketMapper } from "../mappers/SupportTicketMapper";

/**
 * Repository for customer support ticket operations.
 */
export class CustomerTicketRepository implements ICustomerTicketRepository {
  /** Get tickets for a customer with pagination. */
  async findAllForCustomer(
    pelangganId: string,
    options: { page: number; limit: number; status?: string },
  ) {
    return findAllTicketsForCustomer(pelangganId, options);
  }

  /** Get count of tickets created today for number generation. */
  async getCountForToday(): Promise<number> {
    return getTodayTicketCount();
  }

  /** Count unread ticket notifications that require customer attention. */
  async countUnreadCustomerNotifications(pelangganId: string): Promise<number> {
    return countUnreadCustomerTicketNotifications(pelangganId);
  }

  /** Get unread ticket and announcement summary for customer portal. */
  async getCustomerNotificationSummary(query: CustomerNotificationQuery) {
    return getCustomerNotificationSummary(query);
  }

  /** Create a new support ticket. */
  async create(data: {
    pelangganId: string;
    ticketNumber: string;
    category: TicketCategory;
    priority: TicketPriority;
    subject: string;
    description: string;
  }) {
    return createCustomerTicket(data);
  }

  /** Map customer ticket list into response DTOs. */
  mapCustomerTicketResponses(
    tickets: Parameters<typeof SupportTicketMapper.toCustomerList>[0],
  ) {
    return SupportTicketMapper.toCustomerList(tickets);
  }

  /** Build customer ticket pagination metadata. */
  buildCustomerTicketPagination(page: number, limit: number, total: number) {
    return buildCustomerTicketPaginationMeta(page, limit, total);
  }

  /** Get admin ticket list. */
  async findAllAdmin(where: CustomerTicketQuery, skip: number, take: number) {
    return findAllAdminTickets(where, skip, take);
  }

  /** Count admin tickets. */
  async countAdmin(where: CustomerTicketQuery) {
    return countAdminTickets(where);
  }

  /** Get grouped ticket status counts. */
  async getStatusCounts(where: CustomerTicketQuery) {
    return getAdminTicketStatusCounts(where);
  }

  /** Get closed tickets with rating replies. */
  async getClosedTicketsWithReplies(where: CustomerTicketQuery) {
    return findClosedTicketsWithReplies(where);
  }

  /** Get admin ticket detail by id. */
  async findByIdAdmin(id: string) {
    return findByIdAdmin(id);
  }

  /** Get basic ticket detail by id. */
  async findByIdBasic(id: string) {
    return findByIdBasic(id);
  }

  /** Update admin ticket. */
  async updateAdmin(id: string, updateData: CustomerTicketUpdateData) {
    return updateAdminTicket(id, updateData);
  }

  /** Create reply for ticket. */
  async createReply(data: {
    ticketId: string;
    message: string;
    isFromAdmin: boolean;
    senderId?: string;
    pelangganId?: string;
    attachments?: string[];
  }) {
    return createTicketReply(data);
  }

  /** Count active tickets whose latest reply is from customer. */
  async countNeedsReplyAdmin(status: TicketStatus, siteId?: string) {
    return countAdminTicketsNeedingReply(status, siteId);
  }

  /** Get customer-owned ticket detail by id. */
  async findByIdForCustomer(id: string, pelangganId: string) {
    return findByIdForCustomer(id, pelangganId);
  }

  /** Update ticket status for customer-owned ticket. */
  async updateCustomerStatus(
    id: string,
    pelangganId: string,
    status: string,
    closedAt?: Date,
    rating?: number | null,
  ) {
    const updatedCount = await updateCustomerOwnedTicketStatus(
      id,
      pelangganId,
      status,
      closedAt,
      rating,
    );
    if (updatedCount === 0) return null;
    return findByIdForCustomer(id, pelangganId);
  }

  /** Delete ticket by id. */
  async delete(id: string) {
    return deleteTicket(id);
  }
}
