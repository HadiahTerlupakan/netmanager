import type { ICustomerTicketRepository } from "../domain/ports/ICustomerTicketRepository";
import { CustomerTicketRepository } from "../repositories/CustomerTicketRepository";
import { buildTicketReplyNotifications } from "./customer-notification.helpers";
import { pelangganContactService } from "./PelangganContactService";

const DEFAULT_NOTIFICATION_LIMIT = 10;

/** Notifikasi in-app yang tersimpan di tabel `notifications`. */
interface StoredNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

const STORED_NOTIFICATION_SENDER = "Sistem";

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
    const [notificationSummary, storedNotifications] = await Promise.all([
      this.customerTicketRepository.getCustomerNotificationSummary({
        pelangganId: customerId,
        limit,
        now: new Date(),
      }),
      this.loadStoredNotifications(customerId, limit),
    ]);

    return this.buildNotificationResponse(
      notificationSummary,
      storedNotifications,
    );
  }

  /**
   * Ambil notifikasi in-app milik pelanggan dari tabel `notifications`.
   *
   * Dispatcher billing menulis ke tabel itu, tetapi portal pelanggan dulu
   * hanya membaca balasan tiket dan pengumuman — sehingga notifikasi tagihan
   * yang tersimpan tidak pernah terlihat siapa pun.
   *
   * Import dilakukan saat pemanggilan, bukan di puncak berkas: modul
   * notification mengimpor modul pelanggan, jadi import statis akan membentuk
   * siklus yang membuat salah satu barrel dievaluasi setengah jalan.
   */
  private async loadStoredNotifications(
    customerId: string,
    limit: number,
  ): Promise<StoredNotification[]> {
    const contact = await pelangganContactService.findContactById(customerId);
    if (!contact?.userId) return [];

    const { getNotificationsForUser } =
      await import("@/modules/notification/api");
    const result = await getNotificationsForUser(contact.userId, { limit });

    return (result.notifications ?? []) as StoredNotification[];
  }

  /** Map repository summary into customer notification response. */
  private buildNotificationResponse(
    notificationSummary: Awaited<
      ReturnType<ICustomerTicketRepository["getCustomerNotificationSummary"]>
    >,
    storedNotifications: StoredNotification[],
  ) {
    const ticketNotifications = buildTicketReplyNotifications(
      notificationSummary.ticketsWithNewReplies,
    );
    const unreadStoredCount = storedNotifications.filter(
      (notification) => !notification.isRead,
    ).length;

    return {
      notifications: [
        ...ticketNotifications,
        ...storedNotifications.map(mapStoredNotification),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
      announcements: notificationSummary.announcements,
      unreadTicketCount: notificationSummary.unreadTicketCount,
      unreadAnnouncementCount: notificationSummary.unreadAnnouncementCount,
      unreadCount:
        notificationSummary.unreadTicketCount +
        notificationSummary.unreadAnnouncementCount +
        unreadStoredCount,
    };
  }
}

/** Samakan bentuk notifikasi tersimpan dengan notifikasi balasan tiket. */
function mapStoredNotification(notification: StoredNotification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    preview: notification.message,
    link: notification.link ?? undefined,
    createdAt: notification.createdAt,
    isRead: notification.isRead,
    sender: STORED_NOTIFICATION_SENDER,
  };
}

let customerNotificationServiceInstance: CustomerNotificationService | null =
  null;

export function getCustomerNotificationService(): CustomerNotificationService {
  if (!customerNotificationServiceInstance) {
    customerNotificationServiceInstance = new CustomerNotificationService();
  }

  return customerNotificationServiceInstance;
}
