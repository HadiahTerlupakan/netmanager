import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `NotificationDispatcher` menulis notifikasi tagihan pelanggan ke tabel
 * `notifications`, tetapi portal pelanggan hanya membaca balasan tiket dan
 * pengumuman — sehingga baris itu tidak pernah terlihat siapa pun.
 */

const getNotificationsForUser = vi.hoisted(() => vi.fn());
const findContactById = vi.hoisted(() => vi.fn());

vi.mock("@/modules/notification/api", () => ({ getNotificationsForUser }));

vi.mock("@/modules/pelanggan/services/PelangganContactService", () => ({
  pelangganContactService: { findContactById },
  PelangganContactService: class {},
}));

const { CustomerNotificationService } =
  await import("@/modules/pelanggan/services/CustomerNotificationService");

const summary = {
  ticketsWithNewReplies: [],
  announcements: [],
  unreadTicketCount: 1,
  unreadAnnouncementCount: 2,
};

const repository = {
  getCustomerNotificationSummary: vi.fn(),
  countUnreadCustomerNotifications: vi.fn(),
};

const buildService = () =>
  new CustomerNotificationService(
    repository as unknown as ConstructorParameters<
      typeof CustomerNotificationService
    >[0],
  );

const storedRow = (over: Record<string, unknown> = {}) => ({
  id: "notif-1",
  type: "SYSTEM",
  title: "Tagihan Baru",
  message: "Tagihan INV/1 telah terbit",
  link: "/tagihan",
  isRead: false,
  createdAt: new Date("2026-09-07T10:00:00.000Z"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  repository.getCustomerNotificationSummary.mockResolvedValue(summary);
  findContactById.mockResolvedValue({ userId: "user-1" });
  getNotificationsForUser.mockResolvedValue({ notifications: [storedRow()] });
});

describe("notifikasi in-app pelanggan", () => {
  it("menyertakan notifikasi tersimpan pada daftar", async () => {
    const result = await buildService().getNotifications("cust-1");

    expect(result.notifications).toContainEqual(
      expect.objectContaining({
        id: "notif-1",
        title: "Tagihan Baru",
        link: "/tagihan",
      }),
    );
  });

  it("menambahkan yang belum dibaca ke hitungan lonceng", async () => {
    const result = await buildService().getNotifications("cust-1");

    // 1 tiket + 2 pengumuman + 1 notifikasi tersimpan
    expect(result.unreadCount).toBe(4);
  });

  it("tidak menghitung notifikasi yang sudah dibaca", async () => {
    getNotificationsForUser.mockResolvedValue({
      notifications: [storedRow({ isRead: true })],
    });

    const result = await buildService().getNotifications("cust-1");

    expect(result.unreadCount).toBe(3);
  });

  // Pelanggan tanpa akun pengguna tidak punya baris notifikasi sama sekali;
  // portal tetap harus menampilkan tiket dan pengumuman.
  it("tetap bekerja saat pelanggan tidak punya userId", async () => {
    findContactById.mockResolvedValue({ userId: null });

    const result = await buildService().getNotifications("cust-1");

    expect(getNotificationsForUser).not.toHaveBeenCalled();
    expect(result.unreadCount).toBe(3);
  });

  it("mengurutkan gabungan dari yang terbaru", async () => {
    getNotificationsForUser.mockResolvedValue({
      notifications: [
        storedRow({ id: "lama", createdAt: new Date("2026-09-01T00:00:00Z") }),
        storedRow({ id: "baru", createdAt: new Date("2026-09-07T00:00:00Z") }),
      ],
    });

    const result = await buildService().getNotifications("cust-1");

    expect(result.notifications.map((n) => n.id)).toEqual(["baru", "lama"]);
  });
});
