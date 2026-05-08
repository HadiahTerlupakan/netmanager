import { logger } from "@/lib/logger";
import {
  TicketStatus,
  TicketCategory,
  TicketPriority,
} from "../types/pelanggan.enums";
import type { ICustomerTicketRepository } from "../domain/ports/ICustomerTicketRepository";
import { CustomerTicketRepository } from "../repositories/CustomerTicketRepository";
import {
  deleteAdminTicket,
  updateAdminTicket,
} from "./admin-support-ticket-mutation.helpers";
import {
  getAdminTicketById,
  getAdminTickets,
  getAdminUnreadCount,
} from "./admin-support-ticket-query.helpers";
import {
  buildReplyPayload,
  emitReplyEvent,
  sendReplyWhatsapp,
} from "./admin-support-ticket-reply.helpers";

/**
 * Service Result type for consistent API responses
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Filter options for listing tickets
 */
export interface TicketFilterOptions {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  search?: string;
  assignedToMe?: boolean;
  siteId?: string; // For site restriction
}

/**
 * User context for permission checks
 */
export interface UserContext {
  id: string;
  role?: string;
  siteId?: string | null;
  permissions?: string[];
}

interface AdminTicketReplyInput {
  ticketId: string;
  senderId: string;
  message?: string;
  updateStatus?: TicketStatus;
  sendWhatsApp?: boolean;
  attachments?: string[];
  allowedSiteIds?: string[];
}

interface AdminUnreadCountResponse {
  count: number;
  breakdown: {
    openTickets: number;
    needsReply: number;
    customerRepliedWhileWaiting: number;
  };
}

/**
 * Admin Support Ticket Service
 * Handles all support ticket business logic for admin panel
 */
export class AdminSupportTicketService {
  private ticketRepo: ICustomerTicketRepository;

  constructor(
    ticketRepo: ICustomerTicketRepository = new CustomerTicketRepository(),
  ) {
    this.ticketRepo = ticketRepo;
  }

  /**
   * Get paginated list of tickets with filters and stats
   */
  async getTickets(
    filters: TicketFilterOptions,
    user: UserContext,
    hasSiteRestriction: boolean,
  ): Promise<
    ServiceResult<{
      tickets: import("../domain/ports/ICustomerTicketRepository").CustomerTicketListItem[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      stats: Record<string, unknown>;
    }>
  > {
    return getAdminTickets({
      filters,
      user,
      hasSiteRestriction,
      ticketRepo: this.ticketRepo,
    });
  }

  /**
   * Get single ticket with all replies
   */
  async getTicketById(
    id: string,
    user: UserContext,
    hasSiteRestriction: boolean,
  ): Promise<ServiceResult<unknown>> {
    return getAdminTicketById({
      id,
      user,
      hasSiteRestriction,
      ticketRepo: this.ticketRepo,
    });
  }

  /**
   * Update ticket (status, priority, assignee)
   */
  async updateTicket(
    id: string,
    data: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedToId?: string | null;
      closingNote?: string;
    },
    user: UserContext,
    hasSiteRestriction: boolean,
  ): Promise<ServiceResult<unknown>> {
    return updateAdminTicket({
      id,
      data,
      user,
      hasSiteRestriction,
      ticketRepo: this.ticketRepo,
    });
  }

  /**
   * Delete ticket
   */
  async deleteTicket(
    id: string,
    user: UserContext,
    hasSiteRestriction: boolean,
  ): Promise<ServiceResult<{ id: string }>> {
    return deleteAdminTicket({
      id,
      user,
      hasSiteRestriction,
      ticketRepo: this.ticketRepo,
    });
  }

  /** Balas tiket admin dan jalankan side effect notifikasi. */
  async replyToTicket(
    input: AdminTicketReplyInput,
  ): Promise<ServiceResult<{ reply: unknown; whatsappSent: boolean }>> {
    try {
      const ticket = await this.ticketRepo.findByIdAdmin(input.ticketId);
      if (!ticket) return this.notFoundResult();
      if (ticket.status === TicketStatus.CLOSED)
        return this.closedTicketResult();

      // Validate scope: ticket must belong to pelanggan in allowed sites
      if (input.allowedSiteIds && input.allowedSiteIds.length > 0) {
        const { getPelangganService } = await import("./PelangganService");
        const pelanggan = await getPelangganService().getPelanggan(
          ticket.pelangganId,
        );
        if (
          !pelanggan ||
          !pelanggan.siteId ||
          !input.allowedSiteIds.includes(pelanggan.siteId)
        ) {
          return {
            success: false,
            error:
              "Anda tidak dapat membalas tiket untuk pelanggan di luar scope Anda",
            code: "FORBIDDEN",
          };
        }
      }

      const reply = await this.ticketRepo.createReply({
        ticketId: input.ticketId,
        senderId: input.senderId,
        isFromAdmin: true,
        message: input.message?.trim() || "",
        attachments: input.attachments,
      });

      const nextStatus = input.updateStatus || TicketStatus.WAITING_CUSTOMER;
      await this.ticketRepo.updateAdmin(input.ticketId, {
        status: nextStatus,
        user: ticket.user?.id ? undefined : { connect: { id: input.senderId } },
      });

      emitReplyEvent(input.ticketId, reply);
      const whatsappSent = await sendReplyWhatsapp(ticket, input);
      return {
        success: true,
        data: { reply: buildReplyPayload(reply), whatsappSent },
      };
    } catch (error) {
      logger.error("[AdminSupportTicketService.replyToTicket] Error:", error);
      return {
        success: false,
        error: "Gagal mengirim balasan",
        code: "INTERNAL_ERROR",
      };
    }
  }

  /** Hitung tiket yang membutuhkan respon admin. */
  async getUnreadCount(
    siteId?: string,
  ): Promise<ServiceResult<AdminUnreadCountResponse>> {
    return getAdminUnreadCount({ siteId, ticketRepo: this.ticketRepo });
  }

  /** Hasil gagal saat tiket tidak ditemukan. */
  private notFoundResult(): ServiceResult<never> {
    return {
      success: false,
      error: "Tiket tidak ditemukan",
      code: "NOT_FOUND",
    };
  }

  /** Hasil gagal saat tiket telah ditutup. */
  private closedTicketResult(): ServiceResult<never> {
    return {
      success: false,
      error: "Tiket sudah ditutup dan tidak dapat dibalas",
      code: "VALIDATION_ERROR",
    };
  }
}

// Singleton instance
let serviceInstance: AdminSupportTicketService | null = null;

export function getAdminSupportTicketService(): AdminSupportTicketService {
  if (!serviceInstance) {
    serviceInstance = new AdminSupportTicketService();
  }
  return serviceInstance;
}
