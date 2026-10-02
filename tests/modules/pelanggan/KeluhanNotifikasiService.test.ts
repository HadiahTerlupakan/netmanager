import { beforeEach, describe, expect, it, vi } from "vitest";

const { createNotification, hasNotificationForSource } = vi.hoisted(() => ({
  createNotification: vi.fn(async () => undefined),
  hasNotificationForSource: vi.fn(async () => false),
}));
vi.mock("@/modules/notification", () => ({ createNotification, hasNotificationForSource }));

import type { KeluhanSalesRepository } from "@/modules/pelanggan/repositories/KeluhanSalesRepository";
import { kabariSalesKeluhan, susunPesanKabar } from "@/modules/pelanggan/services/KeluhanNotifikasiService";

function repo(tiket: unknown) {
  return { cariPenerimaKabar: vi.fn(async () => tiket) } as unknown as KeluhanSalesRepository;
}

const TIKET = {
  id: "tk1",
  tenantId: "t1",
  ticketNumber: "TKT-1",
  dilaporkanOlehId: "sales-1",
  pelanggan: { nama: "Bu Sari", salesId: "sales-2" },
};

describe("kabariSalesKeluhan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengabari pelapor dan sales penanggung jawab dengan tenant tiket & link keluhan", async () => {
    await kabariSalesKeluhan("tk1", { jenis: "WO_SELESAI", nomorWo: "WO-9" }, "teknisi-1", repo(TIKET));
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "sales-1",
        tenantId: "t1",
        link: "/admin/support/tk1",
        sourceType: "KELUHAN",
        sourceId: "tk1",
        priority: "HIGH",
      }),
    );
  });

  it("event WO terkirim ulang (at-least-once) → notifikasi yang sudah ada tidak digandakan", async () => {
    hasNotificationForSource.mockResolvedValue(true);
    await kabariSalesKeluhan("tk1", { jenis: "WO_DIMULAI", nomorWo: "WO-9" }, undefined, repo(TIKET));
    expect(hasNotificationForSource).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: "KELUHAN", sourceId: "tk1", message: "WO-9 mulai dikerjakan." }),
    );
    expect(createNotification).not.toHaveBeenCalled();
    hasNotificationForSource.mockResolvedValue(false);
  });

  it("balasan helpdesk berulang tetap dikabarkan (tanpa cek idempotensi)", async () => {
    await kabariSalesKeluhan("tk1", { jenis: "BALASAN_HELPDESK" }, "admin-1", repo(TIKET));
    expect(hasNotificationForSource).not.toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({ sourceId: "tk1" }));
  });

  it("tidak mengabari pelakunya sendiri dan tidak menduplikasi penerima", async () => {
    const tiket = { ...TIKET, pelanggan: { nama: "Bu Sari", salesId: "sales-1" } };
    await kabariSalesKeluhan("tk1", { jenis: "BALASAN_HELPDESK" }, "sales-1", repo(tiket));
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("tiket tanpa tenant/tidak ada → diam; galat notifikasi tidak dilempar", async () => {
    await kabariSalesKeluhan("tk1", { jenis: "STATUS", status: "RESOLVED" }, undefined, repo(null));
    createNotification.mockRejectedValueOnce(new Error("push gagal"));
    await expect(kabariSalesKeluhan("tk1", { jenis: "STATUS", status: "RESOLVED" }, undefined, repo(TIKET))).resolves.toBeUndefined();
  });
});

describe("susunPesanKabar", () => {
  it("menyebut jadwal WO bila ada", () => {
    const { pesan } = susunPesanKabar({ jenis: "WO_DIBUAT", nomorWo: "WO-9", jadwal: "2026-10-05T03:00:00.000Z" }, "TKT-1", "Bu Sari");
    expect(pesan).toContain("WO-9");
    expect(pesan).toContain("5 Okt");
  });
});
