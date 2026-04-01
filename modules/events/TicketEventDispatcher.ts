import { eventBus, EVENT_NAMES } from '@/lib/event-bus';

export class TicketEventDispatcher {
  /**
   * Dipanggil setelah Ticket baru dibuat.
   */
  static async onCreated(data: {
    ticketId: string
    ticketNumber: string
    subject: string
    priority: string
    pelangganNama?: string
    siteId?: string | null
    triggeredBy?: string
  }) {
    await eventBus.publish(EVENT_NAMES.TICKET_CREATED, {
      ticketId: data.ticketId,
      ticketNumber: data.ticketNumber,
      subject: data.subject,
      priority: data.priority,
      pelangganNama: data.pelangganNama,
      siteId: data.siteId ?? undefined,
      triggeredBy: data.triggeredBy,
    });
  }

  /**
   * Dipanggil setelah reply ditambahkan ke Ticket.
   */
  static async onReply(data: {
    ticketId: string
    ticketNumber: string
    replyId: string
    message: string
    isFromAdmin: boolean
    siteId?: string | null
    targetUserId?: string
    triggeredBy?: string
  }) {
    await eventBus.publish(EVENT_NAMES.TICKET_REPLY, {
      ticketId: data.ticketId,
      ticketNumber: data.ticketNumber,
      replyId: data.replyId,
      message: data.message,
      isFromAdmin: data.isFromAdmin,
      siteId: data.siteId ?? undefined,
      targetUserId: data.targetUserId,
      triggeredBy: data.triggeredBy,
    });
  }

  /**
   * Dipanggil setelah status Ticket berubah.
   */
  static async onStatusChanged(data: {
    ticketId: string
    ticketNumber: string
    subject: string
    priority: string
    pelangganNama?: string
    siteId?: string | null
    triggeredBy?: string
  }) {
    await eventBus.publish(EVENT_NAMES.TICKET_STATUS_CHANGED, {
      ticketId: data.ticketId,
      ticketNumber: data.ticketNumber,
      subject: data.subject,
      priority: data.priority,
      pelangganNama: data.pelangganNama,
      siteId: data.siteId ?? undefined,
      triggeredBy: data.triggeredBy,
    });
  }
}
