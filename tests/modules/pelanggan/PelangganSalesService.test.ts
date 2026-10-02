import { describe, expect, it, vi } from "vitest";

import {
  PelangganSalesService,
  kelompokkanPerSales,
} from "@/modules/pelanggan/services/PelangganSalesService";
import type { PelangganSalesRepository } from "@/modules/pelanggan/repositories/PelangganSalesRepository";

const SEKARANG = new Date("2026-10-02T05:00:00.000Z");

function baris(id: string, salesId: string | null, namaSales: string | null, jatuhTempo: string) {
  return {
    id,
    idPelanggan: `PLG-${id}`,
    nama: `Pelanggan ${id}`,
    username: id,
    alamat: null as string | null,
    noTelp: "0812",
    jatuhTempo: new Date(jatuhTempo),
    latitude: null as number | null,
    longitude: null as number | null,
    siteId: "s1",
    site: { name: "HQ" },
    hargaPaket: { name: "20 Mbps" },
    salesId,
    sales: salesId ? { id: salesId, name: namaSales } : null,
  };
}

function repoPalsu(over: Partial<Record<keyof PelangganSalesRepository, unknown>> = {}) {
  return {
    daftarSalesAktif: vi.fn(),
    cariSalesAktif: vi.fn(async () => ({ id: "sales-1", name: "Ani" })),
    cariPelanggan: vi.fn(async () => ({ id: "p1", siteId: "s1", salesId: null })),
    tetapkanSales: vi.fn(async (id: string, salesId: string | null) => ({ id, salesId, sales: null })),
    daftarIsolir: vi.fn(async () => []),
    ...over,
  } as unknown as PelangganSalesRepository;
}

describe("kelompokkanPerSales", () => {
  it("mengelompokkan per sales, terbanyak dulu, tanpa sales paling akhir, dengan hari lewat", () => {
    const hasil = kelompokkanPerSales(
      [
        baris("a", null, null, "2026-09-01T00:00:00Z"),
        baris("b", "s-ani", "Ani", "2026-09-20T00:00:00Z"),
        baris("c", "s-budi", "Budi", "2026-09-25T00:00:00Z"),
        baris("d", "s-budi", "Budi", "2026-09-30T00:00:00Z"),
      ] as never,
      SEKARANG,
    );

    expect(hasil.map((k) => [k.namaSales, k.pelanggan.length])).toEqual([
      ["Budi", 2],
      ["Ani", 1],
      ["Belum ada sales", 1],
    ]);
    expect(hasil[1].pelanggan[0]).toMatchObject({ paket: "20 Mbps", siteName: "HQ", hariLewat: 12 });
  });
});

describe("PelangganSalesService", () => {
  it("tetapkan sales: pelanggan tak ada → 404, sales tak aktif → 422, null melepas", async () => {
    const tanpaPelanggan = new PelangganSalesService(repoPalsu({ cariPelanggan: vi.fn(async () => null) }));
    await expect(tanpaPelanggan.tetapkanSales("t1", "p1", "sales-1")).rejects.toMatchObject({ status: 404 });

    const salesMati = new PelangganSalesService(repoPalsu({ cariSalesAktif: vi.fn(async () => null) }));
    await expect(salesMati.tetapkanSales("t1", "p1", "x")).rejects.toMatchObject({ status: 422 });

    const repo = repoPalsu();
    await new PelangganSalesService(repo).tetapkanSales("t1", "p1", null);
    expect(repo.cariSalesAktif).not.toHaveBeenCalled();
    expect(repo.tetapkanSales).toHaveBeenCalledWith("p1", null);
  });

  it("daftar tunggakan: saringan kosong tidak menyentuh database; null = seluruh tenant", async () => {
    const repo = repoPalsu();
    const service = new PelangganSalesService(repo);

    expect(await service.daftarTunggakan("t1", { salesIds: [] })).toEqual({ total: 0, kelompok: [] });
    expect(repo.daftarIsolir).not.toHaveBeenCalled();

    await service.daftarTunggakan("t1", null, SEKARANG);
    expect(repo.daftarIsolir).toHaveBeenCalledWith("t1", null);
  });
});

describe("PelangganSalesService.daftarPelangganSaya", () => {
  const FILTER = { page: 2, limit: 10, cari: "budi" };
  const BARIS_SAYA = {
    ...baris("a", "s-ani", "Ani", "2026-10-10T00:00:00Z"),
    status: "AKTIF",
    work_orders: [{ workOrderNumber: "WO-1", status: "ASSIGNED", type: "TROUBLESHOOT" }],
    _count: { support_tickets: 2 },
  };

  it("meneruskan saringan & offset halaman, lalu memetakan WO terbuka dan jumlah keluhan", async () => {
    const daftarPelangganSales = vi.fn(async () => ({ data: [BARIS_SAYA], total: 11 }));
    const service = new PelangganSalesService(repoPalsu({ daftarPelangganSales }));

    const hasil = await service.daftarPelangganSaya("t1", { salesIds: ["s-ani"] }, FILTER);

    expect(daftarPelangganSales).toHaveBeenCalledWith(
      "t1",
      { salesIds: ["s-ani"] },
      { cari: "budi", status: undefined },
      { lewati: 10, ambil: 10 },
    );
    expect(hasil.total).toBe(11);
    expect(hasil.data[0]).toMatchObject({
      namaSales: "Ani",
      woTerbuka: { nomor: "WO-1", status: "ASSIGNED", jenis: "TROUBLESHOOT" },
      jumlahKeluhanTerbuka: 2,
    });
  });

  it("lingkup tanpa sales sama sekali → kosong tanpa query", async () => {
    const daftarPelangganSales = vi.fn();
    const service = new PelangganSalesService(repoPalsu({ daftarPelangganSales }));

    const hasil = await service.daftarPelangganSaya("t1", { salesIds: [] }, FILTER);

    expect(hasil).toEqual({ data: [], total: 0, page: 2, limit: 10 });
    expect(daftarPelangganSales).not.toHaveBeenCalled();
  });
});
