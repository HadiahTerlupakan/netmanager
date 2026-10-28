import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `NotificationDispatcher` menulis notifikasi tagihan pelanggan ke tabel
 * `notifications`, tetapi portal pelanggan hanya membaca balasan tiket dan
 * pengumuman — sehingga baris itu tidak pernah terlihat siapa pun.
 */

const getCustomerStoredNotifications = vi.hoisted(() => vi.fn());
const findContactById = vi.hoisted(() => vi.fn());

vi.mock("@/modules/notification/api", () => ({
  getCustomerStoredNotifications,
}));

vi.mock("@/modules/pelanggan/services/PelangganContactService", () => ({
  pelangganContactService: { findContactById },
  PelangganContactService: class {},
}));

const { CustomerNotificationService } =
  await import("@/modules/pelanggan/services/CustomerNotificationService");

const summary = {
  ticketsWithNewReplies: [] as unknown[],
  announcements: [] as unknown[],
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
  getCustomerStoredNotifications.mockResolvedValue([storedRow()]);
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
    getCustomerStoredNotifications.mockResolvedValue([
      storedRow({ isRead: true }),
    ]);

    const result = await buildService().getNotifications("cust-1");

    expect(result.unreadCount).toBe(3);
  });

  // Pelanggan tanpa akun User dulu tidak pernah melihat notifikasi tagihan:
  // baris dicari lewat userId saja. Kini dicari per pelanggan.
  it("pelanggan tanpa userId tetap mendapat notifikasi tersimpannya", async () => {
    findContactById.mockResolvedValue({ userId: null });

    const result = await buildService().getNotifications("cust-1");

    expect(getCustomerStoredNotifications).toHaveBeenCalledWith({
      pelangganId: "cust-1",
      userId: null,
      limit: expect.any(Number),
    });
    expect(result.unreadCount).toBe(4);
  });

  it("mengurutkan gabungan dari yang terbaru", async () => {
    getCustomerStoredNotifications.mockResolvedValue([
      storedRow({ id: "lama", createdAt: new Date("2026-09-01T00:00:00Z") }),
      storedRow({ id: "baru", createdAt: new Date("2026-09-07T00:00:00Z") }),
    ]);

    const result = await buildService().getNotifications("cust-1");

    expect(result.notifications.map((n) => n.id)).toEqual(["baru", "lama"]);
  });
});
