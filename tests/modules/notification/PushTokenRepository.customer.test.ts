import { beforeEach, describe, expect, it } from "vitest";

import { prismaMock } from "../../setup";
import { PushTokenRepository } from "@/modules/notification/repositories/PushTokenRepository";

/**
 * Sesi pelanggan dulu jatuh ke cabang karyawan dan dicari di tabel `User`,
 * sehingga token FCM pelanggan selalu ditolak "Pengguna mobile tidak
 * ditemukan". Token pelanggan kini disimpan di `Pelanggan.fcmTokens`, dalam
 * tenant sesinya.
 */

const SESI_PELANGGAN = {
  userId: "cust-1",
  role: "CUSTOMER",
  tenantId: "tenant-1",
};
const DI_TENANT = { id: "cust-1", tenantId: "tenant-1" };

describe("PushTokenRepository untuk sesi pelanggan", () => {
  const repository = new PushTokenRepository();

  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof prismaMock) => unknown) =>
        callback(prismaMock),
    );
  });

  it("mencari pemilik token di tabel pelanggan, dalam tenant sesinya", async () => {
    prismaMock.pelanggan.findFirst.mockResolvedValue({
      id: "cust-1",
      fcmTokens: ["fcm-a"],
    });

    await expect(
      repository.findOwnerTokens(SESI_PELANGGAN, "cust-1"),
    ).resolves.toEqual({ id: "cust-1", fcmTokens: ["fcm-a"] });

    expect(prismaMock.pelanggan.findFirst).toHaveBeenCalledWith({
      where: DI_TENANT,
      select: { id: true, fcmTokens: true },
    });
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("menambah token baru ke daftar pelanggan dalam satu transaksi", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValue({ fcmTokens: ["fcm-a"] });

    await repository.appendOwnerToken(SESI_PELANGGAN, "cust-1", "fcm-b");

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.pelanggan.findUnique).toHaveBeenCalledWith({
      where: DI_TENANT,
      select: { fcmTokens: true },
    });
    expect(prismaMock.pelanggan.update).toHaveBeenCalledWith({
      where: DI_TENANT,
      data: { fcmTokens: { set: ["fcm-a", "fcm-b"] } },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("tidak menggandakan token yang sudah tersimpan saat permintaan berlomba", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValue({ fcmTokens: ["fcm-a"] });

    await repository.appendOwnerToken(SESI_PELANGGAN, "cust-1", "fcm-a");

    expect(prismaMock.pelanggan.update).toHaveBeenCalledWith({
      where: DI_TENANT,
      data: { fcmTokens: { set: ["fcm-a"] } },
    });
  });

  it("menulis ulang daftar token pelanggan saat logout", async () => {
    await repository.replaceOwnerTokens(SESI_PELANGGAN, "cust-1", ["fcm-b"]);

    expect(prismaMock.pelanggan.update).toHaveBeenCalledWith({
      where: DI_TENANT,
      data: { fcmTokens: { set: ["fcm-b"] } },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
