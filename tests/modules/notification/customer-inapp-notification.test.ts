import { beforeEach, describe, expect, it } from "vitest";

import { prismaMock } from "../../setup";
import {
  createCustomerNotification,
  getCustomerStoredNotifications,
} from "@/modules/notification/services/CustomerInAppNotificationService";

/**
 * Notifikasi tagihan pelanggan dulu hanya punya penerima userId (akun User)
 * dan lewat jalur yang menyiarkan prioritas tinggi ke admin.
 */
describe("notifikasi in-app pelanggan", () => {
  beforeEach(() => {
    prismaMock.notifications.create.mockResolvedValue({});
    prismaMock.notifications.findMany.mockResolvedValue([]);
  });

  it("disimpan per pelanggan", async () => {
    await createCustomerNotification({
      pelangganId: "cust-1",
      tenantId: "t1",
      title: "Pembayaran berhasil",
      message: "Pembayaran INV/1 berhasil",
      link: "/tagihan",
    });

    expect(prismaMock.notifications.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pelangganId: "cust-1",
        userId: null,
        tenantId: "t1",
        link: "/tagihan",
      }),
    });
  });

  it("dibaca per pelanggan, ditambah baris lama milik akun User-nya", async () => {
    await getCustomerStoredNotifications({
      pelangganId: "cust-1",
      userId: "user-1",
      limit: 5,
    });

    expect(prismaMock.notifications.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ pelangganId: "cust-1" }, { userId: "user-1" }] },
        take: 5,
      }),
    );
  });

  it("tanpa akun User hanya mencari per pelanggan", async () => {
    await getCustomerStoredNotifications({ pelangganId: "cust-1" });

    expect(prismaMock.notifications.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ pelangganId: "cust-1" }] } }),
    );
  });
});
