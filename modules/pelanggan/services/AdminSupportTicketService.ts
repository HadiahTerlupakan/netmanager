import {
  TicketStatus,
  TicketCategory,
  TicketPriority,
  Prisma,
} from "@prisma/client";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import type { ICustomerTicketRepository } from "../domain/ports/ICustomerTicketRepository";
import { CustomerTicketRepository } from "../repositories/CustomerTicketRepository";
import { logActivitySafe } from "@/lib/logger";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import { closeWoOnTicketClose } from "@/modules/work-order";
import { TicketEventDispatcher } from "@/modules/events";
import { socketEmitter } from "@/lib/websocket/emitter";
import { WhatsAppService } from "@/modules/notification";

const OPEN_TICKET_STATUS = TicketStatus.OPEN;

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
      tickets: unknown[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      stats: Record<string, unknown>;
    }>
  > {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        category,
        priority,
        search,
        assignedToMe,
      } = filters;

      const skip = (page - 1) * limit;
      const where: Prisma.SupportTicketsWhereInput = {};

      // Site restriction check
      if (hasSiteRestriction && user.role !== "SUPER_ADMIN") {
        if (!user.siteId) {
          return {
            success: false,
            error: "User tidak memiliki akses site",
            code: "FORBIDDEN",
          };
        }
        where.pelanggan = { siteId: user.siteId };
      }

      // Apply filters
      if (status && Object.values(TicketStatus).includes(status)) {
        where.status = status;
      }
      if (category && Object.values(TicketCategory).includes(category)) {
        where.category = category;
      }
      if (priority && Object.values(TicketPriority).includes(priority)) {
        where.priority = priority;
      }
      if (assignedToMe) {
        where.assignedToId = user.id;
      }

      // Search
      if (search) {
        where.OR = [
          { ticketNumber: { contains: search, mode: "insensitive" } },
          { subject: { contains: search, mode: "insensitive" } },
          { pelanggan: { nama: { contains: search, mode: "insensitive" } } },
          {
            pelanggan: {
              idPelanggan: { contains: search, mode: "insensitive" },
            },
          },
        ];
      }

      // Execute queries
      const [tickets, total, statusSummary] = await Promise.all([
        this.ticketRepo.findAllAdmin(where, skip, limit),
        this.ticketRepo.countAdmin(where),
        this.getStatusCounts(where),
      ]);

      // Calculate average rating
      const { avgRating, ratedCount } =
        await this.calculateAverageRating(where);

      // Format response
      const formattedTickets =
        this.ticketRepo.mapCustomerTicketResponses(tickets);

      return {
        success: true,
        data: {
          tickets: formattedTickets,
          pagination: buildPaginationMeta({
            page,
            limit,
            total,
          }),
          stats: {
            ...statusSummary,
            avgRating,
            ratedCount,
          },
        },
      };
    } catch (error) {
      console.error("[AdminSupportTicketService.getTickets] Error:", error);
      return {
        success: false,
        error: "Gagal mengambil daftar tiket",
        code: "INTERNAL_ERROR",
      };
    }
  }

  /**
   * Get single ticket with all replies
   */
  async getTicketById(
    id: string,
    user: UserContext,
    hasSiteRestriction: boolean,
  ): Promise<ServiceResult<unknown>> {
    try {
      const ticket = await this.ticketRepo.findByIdAdmin(id);

      if (!ticket) {
        return {
          success: false,
          error: "Tiket tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      // Site restriction check
      if (hasSiteRestriction && user.role !== "SUPER_ADMIN") {
        if (!user.siteId || ticket.pelanggan?.siteId !== user.siteId) {
          return { success: false, error: "Akses ditolak", code: "FORBIDDEN" };
        }
      }

      return { success: true, data: ticket };
    } catch (error) {
      console.error("[AdminSupportTicketService.getTicketById] Error:", error);
      return {
        success: false,
        error: "Gagal mengambil detail tiket",
        code: "INTERNAL_ERROR",
      };
    }
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
    try {
      const existing = await this.ticketRepo.findByIdBasic(id);

      if (!existing) {
        return {
          success: false,
          error: "Tiket tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      // Site restriction check
      if (hasSiteRestriction && user.role !== "SUPER_ADMIN") {
        if (!user.siteId || existing.pelanggan?.siteId !== user.siteId) {
          return { success: false, error: "Akses ditolak", code: "FORBIDDEN" };
        }
      }

      const updateData: Prisma.SupportTicketsUpdateInput = {};

      // Status update
      if (data.status && Object.values(TicketStatus).includes(data.status)) {
        updateData.status = data.status;

        if (data.status === TicketStatus.RESOLVED && !existing.resolvedAt) {
          updateData.resolvedAt = new Date();
        }
        if (data.status === TicketStatus.CLOSED && !existing.closedAt) {
          updateData.closedAt = new Date();
        }
      }

      // Priority update
      if (data.priority) {
        updateData.priority = data.priority;
      }

      // Assignee update
      if (data.assignedToId !== undefined) {
        // Use explicit type casting or handle relations if needed
        updateData.user = data.assignedToId
          ? { connect: { id: data.assignedToId } }
          : { disconnect: true };
      }

      const ticket = await this.ticketRepo.updateAdmin(id, updateData);

      // Handle closing side effects
      if (data.status === TicketStatus.CLOSED) {
        if (data.closingNote) {
          await this.ticketRepo.createReply({
            ticketId: id,
            message: data.closingNote,
            isFromAdmin: true,
            senderId: user.id,
          });
        }
        await closeWoOnTicketClose(id);
      }

      // Log activity
      await this.logActivity("UPDATE", "Support Ticket", user.id, {
        id,
        updates: updateData,
      });

      // Publish domain event for status change
      if (data.status && data.status !== existing.status) {
        await TicketEventDispatcher.onStatusChanged({
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: existing.subject,
          priority: ticket.priority,
          pelangganNama: ticket.pelanggan?.nama,
          siteId: existing.pelanggan?.siteId,
          triggeredBy: user.id,
        }).catch((err) =>
          console.error("Failed to publish TICKET_STATUS_CHANGED event:", err),
        );
      }

      return { success: true, data: ticket };
    } catch (error) {
      console.error("[AdminSupportTicketService.updateTicket] Error:", error);
      return {
        success: false,
        error: "Gagal mengupdate tiket",
        code: "INTERNAL_ERROR",
      };
    }
  }

  /**
   * Delete ticket
   */
  async deleteTicket(
    id: string,
    user: UserContext,
    hasSiteRestriction: boolean,
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const ticket = await this.ticketRepo.findByIdBasic(id);

      if (!ticket) {
        return {
          success: false,
          error: "Tiket tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      // Site restriction check
      if (hasSiteRestriction && user.role !== "SUPER_ADMIN") {
        if (!user.siteId || ticket.pelanggan?.siteId !== user.siteId) {
          return { success: false, error: "Akses ditolak", code: "FORBIDDEN" };
        }
      }

      await this.ticketRepo.delete(id);

      // Log activity
      await this.logActivity("DELETE", "Support Ticket", user.id, { id });

      return { success: true, data: { id } };
    } catch (error) {
      console.error("[AdminSupportTicketService.deleteTicket] Error:", error);
      if (isPrismaRecordNotFoundError(error)) {
        return {
          success: false,
          error: "Tiket tidak ditemukan",
          code: "NOT_FOUND",
        };
      }
      return {
        success: false,
        error: "Gagal menghapus tiket",
        code: "INTERNAL_ERROR",
      };
    }
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

      this.emitReplyEvent(input.ticketId, reply);
      const whatsappSent = await this.sendReplyWhatsapp(ticket, input);
      return {
        success: true,
        data: { reply: this.buildReplyPayload(reply), whatsappSent },
      };
    } catch (error) {
      console.error("[AdminSupportTicketService.replyToTicket] Error:", error);
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
    try {
      const openTickets = await this.ticketRepo.countAdmin(
        this.buildUnreadOpenWhere(siteId),
      );
      const needsReply = await this.ticketRepo.countNeedsReplyAdmin(
        TicketStatus.IN_PROGRESS,
        siteId,
      );
      const waitingReply = await this.ticketRepo.countNeedsReplyAdmin(
        TicketStatus.WAITING_CUSTOMER,
        siteId,
      );
      return {
        success: true,
        data: {
          count: openTickets + needsReply + waitingReply,
          breakdown: {
            openTickets,
            needsReply,
            customerRepliedWhileWaiting: waitingReply,
          },
        },
      };
    } catch (error) {
      console.error("[AdminSupportTicketService.getUnreadCount] Error:", error);
      return {
        success: false,
        error: "Gagal mengambil jumlah tiket",
        code: "INTERNAL_ERROR",
      };
    }
  }

  // ====== PRIVATE HELPERS ======

  private async getStatusCounts(baseWhere: Prisma.SupportTicketsWhereInput) {
    // Optimization: Use groupBy instead of 5 separate count queries
    const counts = await this.ticketRepo.getStatusCounts(baseWhere);

    const countMap = counts.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    const open = countMap[TicketStatus.OPEN] || 0;
    const inProgress = countMap[TicketStatus.IN_PROGRESS] || 0;
    const waitingCustomer = countMap[TicketStatus.WAITING_CUSTOMER] || 0;
    const resolved = countMap[TicketStatus.RESOLVED] || 0;
    const closed = countMap[TicketStatus.CLOSED] || 0;

    return {
      total: open + inProgress + waitingCustomer + resolved + closed,
      open,
      inProgress,
      waitingCustomer,
      resolved,
      closed,
    };
  }

  private async calculateAverageRating(
    baseWhere: Prisma.SupportTicketsWhereInput,
  ) {
    // Optimization: parse logic is still heavy in application layer due to string storage
    // but we ensure we only select minimal data
    const closedTicketsWithReplies =
      await this.ticketRepo.getClosedTicketsWithReplies(baseWhere);

    let totalRating = 0;
    let ratedCount = 0;

    for (const t of closedTicketsWithReplies) {
      if (t.replies[0]?.message) {
        const msg = t.replies[0].message;
        // Optimize string checking order (most likely first)
        let rating = 0;
        if (msg.includes("⭐⭐⭐⭐⭐")) rating = 5;
        else if (msg.includes("⭐⭐⭐⭐")) rating = 4;
        else if (msg.includes("⭐⭐⭐")) rating = 3;
        else if (msg.includes("⭐⭐")) rating = 2;
        else if (msg.includes("⭐")) rating = 1;

        if (rating > 0) {
          totalRating += rating;
          ratedCount++;
        }
      }
    }

    return {
      avgRating: ratedCount > 0 ? totalRating / ratedCount : 0,
      ratedCount,
    };
  }

  /** Bentuk filter tiket open untuk unread count. */
  private buildUnreadOpenWhere(
    siteId?: string,
  ): Prisma.SupportTicketsWhereInput {
    if (!siteId) return { status: OPEN_TICKET_STATUS };
    return { status: OPEN_TICKET_STATUS, pelanggan: { siteId } };
  }

  /** Emit event websocket untuk balasan tiket baru. */
  private emitReplyEvent(ticketId: string, reply: unknown) {
    const replyPayload = this.buildReplyPayload(reply);
    socketEmitter.ticketMessage(ticketId, {
      id: replyPayload.id,
      message: replyPayload.message,
      isFromAdmin: true,
      createdAt: replyPayload.createdAt.toISOString(),
      sender: replyPayload.sender,
      attachments: replyPayload.attachments,
    });
  }

  /** Kirim notifikasi WhatsApp ke pelanggan bila diaktifkan. */
  private async sendReplyWhatsapp(
    ticket: unknown,
    input: AdminTicketReplyInput,
  ) {
    const safeTicket = ticket as {
      ticketNumber: string;
      pelanggan?: { nama: string; noTelp?: string | null } | null;
    };
    if (
      !input.sendWhatsApp ||
      !safeTicket.pelanggan?.noTelp ||
      !input.message?.trim()
    )
      return false;

    try {
      const whatsappService = new WhatsAppService();
      const result = await whatsappService.sendMessage({
        phone: safeTicket.pelanggan.noTelp,
        message: this.buildWhatsappMessage(
          safeTicket.ticketNumber,
          safeTicket.pelanggan.nama,
          input.message.trim(),
        ),
      });
      return result.success;
    } catch (error) {
      console.error("[Admin Reply] WhatsApp error:", error);
      return false;
    }
  }

  /** Bentuk pesan WhatsApp untuk pelanggan. */
  private buildWhatsappMessage(
    ticketNumber: string,
    customerName: string,
    message: string,
  ) {
    const previewMessage =
      message.length > 500 ? `${message.substring(0, 500)}...` : message;
    return `🎫 *Tiket Dukungan*\n\nHalo ${customerName},\n\nTiket Anda *#${ticketNumber}* telah dibalas oleh tim kami:\n\n"${previewMessage}"\n\nSilakan login ke portal pelanggan untuk melihat detail dan membalas.\n\nTerima kasih,\nTim Dukungan`;
  }

  /** Bentuk payload reply yang kompatibel dengan response lama. */
  private buildReplyPayload(reply: unknown) {
    const safeReply = reply as {
      id: string;
      message: string;
      createdAt: Date;
      isFromAdmin: boolean;
      user?: { id: string; name: string | null } | null;
      attachments?: string[] | null;
    };
    return {
      id: safeReply.id,
      message: safeReply.message,
      createdAt: safeReply.createdAt,
      isFromAdmin: safeReply.isFromAdmin,
      sender: safeReply.user ?? null,
      attachments: safeReply.attachments ?? null,
    };
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

  private logActivity(
    action: string,
    subject: string,
    userId: string,
    details: Record<string, unknown>,
  ) {
    logActivitySafe({ action, subject, userId, details });
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
