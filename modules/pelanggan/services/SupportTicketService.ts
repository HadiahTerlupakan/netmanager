import { TicketCategory, TicketPriority } from "@prisma/client";
import { logger, logActivitySafe } from "@/lib/logger";
import { TicketEventDispatcher } from "@/modules/events";
import { CustomerTicketRepository } from "../repositories/CustomerTicketRepository";
import { formatDailyDocumentNumber } from "../utils/daily-document-number";

/** Service for customer support ticket business logic. */
export class SupportTicketService {
  private repository: CustomerTicketRepository;

  constructor() {
    this.repository = new CustomerTicketRepository();
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
    if (!data.category || !data.subject || !data.description) {
      throw new Error("Kategori, subjek, dan deskripsi wajib diisi");
    }

    if (
      !Object.values(TicketCategory).includes(data.category as TicketCategory)
    ) {
      throw new Error("Kategori tidak valid");
    }

    const today = new Date();
    const count = await this.repository.getCountForToday();
    const ticketNumber = formatDailyDocumentNumber({
      prefix: "TKT",
      date: today,
      count,
      sequenceWidth: 5,
    });

    const ticket = await this.repository.create({
      pelangganId: customerId,
      ticketNumber,
      category: data.category as TicketCategory,
      priority: (data.priority as TicketPriority) || TicketPriority.MEDIUM,
      subject: data.subject,
      description: data.description,
    });

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
}
