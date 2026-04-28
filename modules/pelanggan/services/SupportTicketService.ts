import { logger } from "@/lib/logger";
import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import { logActivitySafe } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import { TicketEventDispatcher } from "@/modules/events";
import type { ICustomerTicketRepository } from "../domain/ports/ICustomerTicketRepository";
import { SupportTicketMapper } from "../mappers/SupportTicketMapper";
import { CustomerTicketRepository } from "../repositories/CustomerTicketRepository";
import { formatDailyDocumentNumber } from "../utils/daily-document-number";

/** Service for customer support ticket business logic. */
const CLOSED_TICKET_MESSAGE = "Tiket sudah ditutup";
const TICKET_NOT_FOUND_MESSAGE = "Tiket tidak ditemukan";
const TICKET_FORBIDDEN_MESSAGE = "Anda tidak memiliki akses ke tiket ini";
const EMPTY_REPLY_MESSAGE = "Pesan atau lampiran tidak boleh kosong";
const CLOSED_REPLY_MESSAGE = "Tiket sudah ditutup dan tidak dapat dibalas";
const CLOSE_SUCCESS_MESSAGE =
  "Tiket berhasil ditutup. Terima kasih telah menghubungi kami!";
const REPLY_SUCCESS_MESSAGE = "Balasan berhasil dikirim";
const DEFAULT_CUSTOMER_NAME = "Pengguna";
const MIN_RATING = 1;
const MAX_RATING = 5;

export class SupportTicketService {
  private repository: ICustomerTicketRepository;

  constructor(
    repository: ICustomerTicketRepository = new CustomerTicketRepository(),
  ) {
    this.repository = repository;
  }

  /** Get customer tickets with pagination. */
  async getCustomerTickets(
    customerId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ) {
    const { tickets, total } = await this.repository.findAllForCustomer(
      customerId,
      { page, limit, status },
    );

    return {
      tickets: this.repository.mapCustomerTicketResponses(tickets),
      pagination: this.repository.buildCustomerTicketPagination(
        page,
        limit,
        total,
      ),
    };
  }

  /** Create new support ticket. */
  async createTicket(
    customerId: string,
    data: {
      category: string;
      subject: string;
      description: string;
      priority?: string;
    },
  ) {
    this.validateCreateTicketInput(data);
    const ticketNumber = await this.generateTicketNumber();
    const ticket = await this.repository.create({
      pelangganId: customerId,
      ticketNumber,
      category: data.category as TicketCategory,
      priority: (data.priority as TicketPriority) || TicketPriority.MEDIUM,
      subject: data.subject,
      description: data.description,
    });

    this.logTicketCreation(customerId, ticket);
    await this.dispatchTicketCreated(customerId, ticket);
    return this.buildCreateTicketResponse(ticket);
  }

  /** Get one customer ticket detail with replies. */
  async getCustomerTicketDetail(customerId: string, ticketId: string) {
    const ticket = await this.repository.findByIdForCustomer(
      ticketId,
      customerId,
    );
    if (!ticket) {
      throw new Error(TICKET_NOT_FOUND_MESSAGE);
    }

    return SupportTicketMapper.toDetail(ticket);
  }

  /** Create a customer reply for a ticket. */
  async replyToCustomerTicket(
    customerId: string,
    ticketId: string,
    input: { message?: string; attachments?: string[] },
  ) {
    this.validateReplyInput(input);
    const ticket = await this.requireCustomerTicket(customerId, ticketId);
    this.ensureTicketOpen(ticket.status);
    const reply = await this.repository.createReply({
      ticketId,
      pelangganId: customerId,
      isFromAdmin: false,
      message: input.message?.trim() || "",
      attachments: input.attachments,
    });

    await this.reopenWaitingCustomerTicket(customerId, ticketId, ticket.status);
    this.emitCustomerReply(ticketId, customerId, ticket, reply as never);
    return this.buildReplyResponse(reply as never);
  }

  /** Close a customer ticket and append feedback message. */
  async closeCustomerTicket(
    customerId: string,
    ticketId: string,
    input: { feedback?: string; rating?: number },
  ) {
    const ticket = await this.requireOwnedTicket(ticketId);
    this.ensureTicketOwnership(ticket.pelangganId, customerId);
    this.ensureTicketClosable(ticket.status);
    await this.repository.updateCustomerStatus(
      ticketId,
      customerId,
      TicketStatus.CLOSED,
      new Date(),
    );
    await this.repository.createReply({
      ticketId,
      pelangganId: customerId,
      isFromAdmin: false,
      message: this.buildClosingMessage(input),
    });
    return { message: CLOSE_SUCCESS_MESSAGE };
  }

  /** Generate the next daily ticket number. */
  private async generateTicketNumber() {
    const today = new Date();
    const count = await this.repository.getCountForToday();
    return formatDailyDocumentNumber({
      prefix: "TKT",
      date: today,
      count,
      sequenceWidth: 5,
    });
  }

  /** Validate create ticket payload. */
  private validateCreateTicketInput(data: {
    category: string;
    subject: string;
    description: string;
  }) {
    if (!data.category || !data.subject || !data.description) {
      throw new Error("Kategori, subjek, dan deskripsi wajib diisi");
    }

    if (
      Object.values(TicketCategory).includes(data.category as TicketCategory)
    ) {
      return;
    }

    throw new Error("Kategori tidak valid");
  }

  /** Log customer ticket creation. */
  private logTicketCreation(
    customerId: string,
    ticket: { id: string; ticketNumber: string; subject: string },
  ) {
    logActivitySafe({
      action: "CREATE",
      subject: "Support Ticket",
      details: {
        customerId,
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
      },
    });
  }

  /** Dispatch ticket created event. */
  private async dispatchTicketCreated(
    customerId: string,
    ticket: {
      id: string;
      ticketNumber: string;
      subject: string;
      priority: string;
    },
  ) {
    await TicketEventDispatcher.onCreated({
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      priority: ticket.priority,
      triggeredBy: customerId,
    }).catch((error) =>
      logger.error(
        "Failed to publish TICKET_CREATED event",
        error instanceof Error ? error : undefined,
      ),
    );
  }

  /** Build create ticket response payload. */
  private buildCreateTicketResponse(ticket: {
    id: string;
    ticketNumber: string;
    category: string;
    priority: string;
    subject: string;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      priority: ticket.priority,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
    };
  }

  /** Validate reply payload. */
  private validateReplyInput(input: {
    message?: string;
    attachments?: string[];
  }) {
    const hasMessage = Boolean(input.message?.trim());
    const hasAttachments = Boolean(input.attachments?.length);
    if (hasMessage || hasAttachments) {
      return;
    }

    throw new Error(EMPTY_REPLY_MESSAGE);
  }

  /** Require one customer-owned ticket detail. */
  private async requireCustomerTicket(customerId: string, ticketId: string) {
    const ticket = await this.repository.findByIdForCustomer(
      ticketId,
      customerId,
    );
    if (ticket) {
      return ticket;
    }

    throw new Error(TICKET_NOT_FOUND_MESSAGE);
  }

  /** Require a ticket by id for ownership checks. */
  private async requireOwnedTicket(ticketId: string) {
    const ticket = await this.repository.findByIdBasic(ticketId);
    if (ticket) {
      return ticket;
    }

    throw new Error(TICKET_NOT_FOUND_MESSAGE);
  }

  /** Ensure customer owns the ticket. */
  private ensureTicketOwnership(
    ticketCustomerId?: string,
    customerId?: string,
  ) {
    if (ticketCustomerId === customerId) {
      return;
    }

    throw new Error(TICKET_FORBIDDEN_MESSAGE);
  }

  /** Ensure ticket can still receive replies. */
  private ensureTicketOpen(status: string) {
    if (status !== TicketStatus.CLOSED) {
      return;
    }

    throw new Error(CLOSED_REPLY_MESSAGE);
  }

  /** Ensure ticket can be closed by customer. */
  private ensureTicketClosable(status: string) {
    if (status !== TicketStatus.CLOSED) {
      return;
    }

    throw new Error(CLOSED_TICKET_MESSAGE);
  }

  /** Reopen waiting-customer ticket after customer reply. */
  private async reopenWaitingCustomerTicket(
    customerId: string,
    ticketId: string,
    status: string,
  ) {
    if (status !== TicketStatus.WAITING_CUSTOMER) {
      return;
    }

    await this.repository.updateCustomerStatus(
      ticketId,
      customerId,
      TicketStatus.IN_PROGRESS,
    );
  }

  /** Emit websocket payload for customer reply. */
  private emitCustomerReply(
    ticketId: string,
    customerId: string,
    ticket: { pelanggan?: { nama: string } | null },
    reply: {
      id: string;
      message: string;
      createdAt: Date;
      isFromAdmin: boolean;
      attachments?: unknown;
    },
  ) {
    socketEmitter.ticketMessage(ticketId, {
      id: reply.id,
      message: reply.message,
      isFromAdmin: false,
      createdAt: reply.createdAt.toISOString(),
      sender: {
        id: customerId,
        name: ticket.pelanggan?.nama || DEFAULT_CUSTOMER_NAME,
      },
      attachments: (reply.attachments as string[] | null) ?? null,
    });
  }

  /** Build API response for customer reply. */
  private buildReplyResponse(reply: {
    id: string;
    message: string;
    createdAt: Date;
    isFromAdmin: boolean;
    attachments?: unknown;
  }) {
    return {
      message: REPLY_SUCCESS_MESSAGE,
      reply: {
        id: reply.id,
        message: reply.message,
        createdAt: reply.createdAt,
        isFromAdmin: reply.isFromAdmin,
        attachments: reply.attachments,
      },
    };
  }

  /** Build ticket closing message from optional rating and feedback. */
  private buildClosingMessage(input: { feedback?: string; rating?: number }) {
    const parts = ["✅ Tiket ditutup oleh pelanggan."];
    const ratingLabel = this.getRatingLabel(input.rating);
    if (ratingLabel) {
      parts.push(`\n\n📊 Rating: ${ratingLabel}`);
    }

    if (input.feedback?.trim()) {
      parts.push(`\n\n💬 Feedback:\n${input.feedback.trim()}`);
    }

    return parts.join("");
  }

  /** Convert rating number into user-facing label. */
  private getRatingLabel(rating?: number) {
    if (!rating || rating < MIN_RATING || rating > MAX_RATING) {
      return "";
    }

    const labels = {
      1: "⭐ Tidak Puas",
      2: "⭐⭐ Kurang Puas",
      3: "⭐⭐⭐ Cukup Puas",
      4: "⭐⭐⭐⭐ Puas",
      5: "⭐⭐⭐⭐⭐ Sangat Puas",
    } as const;
    return labels[rating as keyof typeof labels] || "";
  }
}
