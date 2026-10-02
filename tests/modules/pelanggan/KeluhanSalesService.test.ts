import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { onCreated, onReply } = vi.hoisted(() => ({
  onCreated: vi.fn(async () => undefined),
  onReply: vi.fn(async () => undefined),
}));
vi.mock("@/modules/events", () => ({ TicketEventDispatcher: { onCreated, onReply } }));

import type { KeluhanSalesRepository } from "@/modules/pelanggan/repositories/KeluhanSalesRepository";
import { KeluhanSalesService } from "@/modules/pelanggan/services/KeluhanSalesService";
import { bacaLampiran } from "@/modules/pelanggan/services/keluhan-sales.mapper";

const PELAPOR = { id: "sales-1", tenantId: "t1" };
const SENDIRI = { salesIds: ["sales-1"] };
const INPUT = {
  pelangganId: "p1",
  kategori: "TECHNICAL" as const,
  prioritas: "HIGH" as const,
  subjek: "Internet mati",
  deskripsi: "Lampu LOS merah sejak pagi",
};

function repoPalsu(over: Partial<Record<keyof KeluhanSalesRepository, unknown>> = {}) {
  return {
    cariPelangganDalamLingkup: vi.fn(async () => ({ id: "p1", nama: "Bu Sari", siteId: "s1" })),
    hitungTiketHariIni: vi.fn(async () => 4),
    buat: vi.fn(async (data: { ticketNumber: string }) => ({
      id: "tk1",
      ticketNumber: data.ticketNumber,
      subject: "Internet mati",
      priority: "HIGH",
    })),
    daftar: vi.fn(async () => ({ data: [], total: 0 })),
    daftarPenanggungJawabTerbuka: vi.fn(async () => []),
    cariDetail: vi.fn(async () => null),
    tambahBalasan: vi.fn(async () => ({ id: "r1" })),
    ...over,
  } as unknown as KeluhanSalesRepository;
}

const bentrok = () =>
  new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" });

describe("KeluhanSalesService.lapor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencatat tiket atas nama pelanggan dengan pelapor & nomor harian, lalu publish ticket created", async () => {
    const repo = repoPalsu();
    const hasil = await new KeluhanSalesService(repo).lapor(PELAPOR, SENDIRI, INPUT);

    expect(repo.cariPelangganDalamLingkup).toHaveBeenCalledWith("t1", "p1", SENDIRI);
    expect(repo.buat).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "t1", pelangganId: "p1", dilaporkanOlehId: "sales-1", category: "TECHNICAL" }),
    );
    expect(hasil.nomor).toMatch(/^TKT-\d{8}-00005$/);
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ ticketId: "tk1", pelangganNama: "Bu Sari", siteId: "s1" }));
  });

  it("menolak pelanggan di luar lingkup sales (404)", async () => {
    const repo = repoPalsu({ cariPelangganDalamLingkup: vi.fn(async () => null) });
    await expect(new KeluhanSalesService(repo).lapor(PELAPOR, SENDIRI, INPUT)).rejects.toMatchObject({ status: 404 });
    expect(repo.buat).not.toHaveBeenCalled();
  });

  it("mencoba nomor berikutnya bila nomor harian bentrok", async () => {
    const buat = vi
      .fn()
      .mockRejectedValueOnce(bentrok())
      .mockImplementationOnce(async (data: { ticketNumber: string }) => ({ id: "tk1", ticketNumber: data.ticketNumber, subject: "x", priority: "HIGH" }));
    const hasil = await new KeluhanSalesService(repoPalsu({ buat })).lapor(PELAPOR, SENDIRI, INPUT);
    expect(buat).toHaveBeenCalledTimes(2);
    expect(hasil.nomor).toMatch(/-00006$/);
  });
});

describe("KeluhanSalesService.daftar", () => {
  const QUERY = { status: "TERBUKA" as const, page: 1, limit: 20 };

  it("sales biasa tidak mendapat ringkasan per sales", async () => {
    const repo = repoPalsu();
    const hasil = await new KeluhanSalesService(repo).daftar("t1", SENDIRI, QUERY);
    expect(hasil.ringkasanSales).toBeNull();
    expect(repo.daftar).toHaveBeenCalledWith("t1", SENDIRI, ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"], { lewati: 0, ambil: 20 });
  });

  it("head of sales mendapat ringkasan keluhan terbuka per sales, terbanyak dulu", async () => {
    const ani = { id: "s-ani", name: "Ani" };
    const budi = { id: "s-budi", name: "Budi" };
    const repo = repoPalsu({
      daftarPenanggungJawabTerbuka: vi.fn(async () => [
        { pelanggan: { sales: ani }, dilaporkanOleh: null },
        { pelanggan: { sales: null }, dilaporkanOleh: budi },
        { pelanggan: { sales: budi }, dilaporkanOleh: budi },
      ]),
    });
    const hasil = await new KeluhanSalesService(repo).daftar("t1", null, QUERY);
    expect(hasil.ringkasanSales).toEqual([
      { salesId: "s-budi", namaSales: "Budi", jumlahTerbuka: 2 },
      { salesId: "s-ani", namaSales: "Ani", jumlahTerbuka: 1 },
    ]);
  });

  it("saringan salesId di luar lingkup tim → kosong tanpa query", async () => {
    const repo = repoPalsu();
    const hasil = await new KeluhanSalesService(repo).daftar("t1", { salesIds: ["k", "a"] }, { ...QUERY, salesId: "x" });
    expect(hasil.total).toBe(0);
    expect(repo.daftar).not.toHaveBeenCalled();
  });
});

describe("KeluhanSalesService.balas", () => {
  const detail = (status: string) => vi.fn(async () => ({ id: "tk1", ticketNumber: "TKT-1", status }));

  it("membuka lagi tiket yang menunggu jawaban pelanggan", async () => {
    const repo = repoPalsu({ cariDetail: detail("WAITING_CUSTOMER") });
    await new KeluhanSalesService(repo).balas(PELAPOR, SENDIRI, "tk1", "Pelanggan ada di rumah jam 3");
    expect(repo.tambahBalasan).toHaveBeenCalledWith(expect.objectContaining({ statusBaru: "OPEN", senderId: "sales-1" }));
    expect(onReply).toHaveBeenCalled();
  });

  it("menolak balasan pada tiket yang sudah ditutup (422)", async () => {
    const repo = repoPalsu({ cariDetail: detail("CLOSED") });
    await expect(new KeluhanSalesService(repo).balas(PELAPOR, SENDIRI, "tk1", "halo")).rejects.toMatchObject({ status: 422 });
  });

  it("tiket di luar lingkup → 404", async () => {
    await expect(new KeluhanSalesService(repoPalsu()).balas(PELAPOR, SENDIRI, "tk1", "halo")).rejects.toMatchObject({ status: 404 });
  });
});

describe("bacaLampiran", () => {
  it("menerima array JSON maupun string JSON, selain itu kosong", () => {
    expect(bacaLampiran(["/a.jpg", 3])).toEqual(["/a.jpg"]);
    expect(bacaLampiran('["/b.jpg"]')).toEqual(["/b.jpg"]);
    expect(bacaLampiran("bukan json")).toEqual([]);
    expect(bacaLampiran(null)).toEqual([]);
  });
});
