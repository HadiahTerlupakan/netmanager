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
   * Angka lonceng: tiket, pengumuman, dan notifikasi tersimpan yang belum
   * dibaca — hitungan yang sama dengan `unreadCount` di getNotifications.
   */
  async getUnreadCount(customerId: string) {
    const [summary, stored] = await Promise.all([
      this.customerTicketRepository.getCustomerNotificationSummary({
        pelangganId: customerId,
        limit: 1,
        now: new Date(),
      }),
      this.loadStoredNotifications(customerId, 0),
    ]);
    return (
      summary.unreadTicketCount +
      summary.unreadAnnouncementCount +
      stored.unreadCount
    );
  }

  /**
   * Get customer notifications and unread summaries.
   */
  async getNotifications(
    customerId: string,
    limit: number = DEFAULT_NOTIFICATION_LIMIT,
  ) {
    const [notificationSummary, stored] = await Promise.all([
      this.customerTicketRepository.getCustomerNotificationSummary({
        pelangganId: customerId,
        limit,
        now: new Date(),
      }),
      this.loadStoredNotifications(customerId, limit),
    ]);

    return this.buildNotificationResponse(
      notificationSummary,
      stored.rows,
      stored.unreadCount,
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
   *
   * `unreadCount` dihitung atas semua baris, bukan hanya `limit` yang dimuat;
   * `limit` 0 cukup untuk angka lonceng.
   */
  private async loadStoredNotifications(
    customerId: string,
    limit: number,
  ): Promise<{ rows: StoredNotification[]; unreadCount: number }> {
    const contact = await pelangganContactService.findContactById(customerId);
    const {
      countCustomerUnreadStoredNotifications,
      getCustomerStoredNotifications,
    } = await import("@/modules/notification/api");
    const owner = { pelangganId: customerId, userId: contact?.userId };

    const [rows, unreadCount] = await Promise.all([
      limit > 0
        ? getCustomerStoredNotifications({ ...owner, limit })
        : Promise.resolve([]),
      countCustomerUnreadStoredNotifications(owner),
    ]);
    return { rows, unreadCount };
  }

  /** Map repository summary into customer notification response. */
  private buildNotificationResponse(
    notificationSummary: Awaited<
      ReturnType<ICustomerTicketRepository["getCustomerNotificationSummary"]>
    >,
    storedNotifications: StoredNotification[],
    unreadStoredCount: number,
  ) {
    const ticketNotifications = buildTicketReplyNotifications(
      notificationSummary.ticketsWithNewReplies,
    );

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
