import type { ICustomerTicketRepository } from "../domain/ports/ICustomerTicketRepository";
import { CustomerTicketRepository } from "../repositories/CustomerTicketRepository";
import { buildTicketReplyNotifications } from "./customer-notification.helpers";

const DEFAULT_NOTIFICATION_LIMIT = 10;

export class CustomerNotificationService {
  constructor(
    private readonly customerTicketRepository: ICustomerTicketRepository = new CustomerTicketRepository(),
  ) {}

  /**
   * Get unread notification count for a customer.
   */
  async getUnreadCount(customerId: string) {
    return this.customerTicketRepository.countUnreadCustomerNotifications(
      customerId,
    );
  }

  /**
   * Get customer notifications and unread summaries.
   */
  async getNotifications(
    customerId: string,
    limit: number = DEFAULT_NOTIFICATION_LIMIT,
  ) {
    const notificationSummary =
      await this.customerTicketRepository.getCustomerNotificationSummary({
        pelangganId: customerId,
        limit,
        now: new Date(),
      });

    return this.buildNotificationResponse(notificationSummary);
  }

  /** Map repository summary into customer notification response. */
  private buildNotificationResponse(
    notificationSummary: Awaited<
      ReturnType<ICustomerTicketRepository["getCustomerNotificationSummary"]>
    >,
  ) {
    return {
      notifications: buildTicketReplyNotifications(
        notificationSummary.ticketsWithNewReplies,
      ),
      announcements: notificationSummary.announcements,
      unreadTicketCount: notificationSummary.unreadTicketCount,
      unreadAnnouncementCount: notificationSummary.unreadAnnouncementCount,
      unreadCount:
        notificationSummary.unreadTicketCount +
        notificationSummary.unreadAnnouncementCount,
    };
  }
}

let customerNotificationServiceInstance: CustomerNotificationService | null =
  null;

export function getCustomerNotificationService(): CustomerNotificationService {
  if (!customerNotificationServiceInstance) {
    customerNotificationServiceInstance = new CustomerNotificationService();
  }

  return customerNotificationServiceInstance;
}
