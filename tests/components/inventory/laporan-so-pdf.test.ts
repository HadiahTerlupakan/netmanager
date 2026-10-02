import { describe, expect, it } from "vitest";

import type { LaporanKepatuhanSo } from "@/components/inventory/opname/jadwal/jadwalSoTypes";
import { susunIsiLaporanSoPdf } from "@/components/inventory/opname/jadwal/laporanSoPdf";

const LAPORAN: LaporanKepatuhanSo = {
  periode: "2026-10",
  jumlahPerStatus: { LENGKAP: 1, SEBAGIAN: 0, DI_LUAR_JADWAL: 0, BELUM: 1, TANPA_STOK: 1 },
  site: [
    {
      siteId: "site-a",
      namaSite: "Site A",
      jendela: { periode: "2026-10", mulai: "2026-10-25", selesai: "2026-10-31", sumber: "BAWAAN" },
      keadaan: "TERBUKA",
      isPengingatAktif: false,
      gudang: [
        {
          id: "g1",
          kode: "GD-01",
          nama: "Gudang Utama",
          status: "LENGKAP",
          jumlahBarangBerstok: 4,
          jumlahDihitungDalamJadwal: 4,
          soTerakhir: { tanggal: "2026-10-26T03:00:00.000Z", pic: "Budi" },
        },
        {
          id: "g2",
          kode: "GD-02",
          nama: "Gudang Cabang",
          status: "BELUM",
          jumlahBarangBerstok: 3,
          jumlahDihitungDalamJadwal: 0,
          soTerakhir: null,
        },
      ],
    },
    {
      siteId: null,
      namaSite: "Tanpa site",
      jendela: { periode: "2026-10", mulai: "2026-10-01", selesai: "2026-10-31", sumber: "TANPA_JADWAL" },
      keadaan: "TERBUKA",
      isPengingatAktif: false,
      gudang: [
        {
          id: "g3",
          kode: "GD-03",
          nama: "Gudang Kosong",
          status: "TANPA_STOK",
          jumlahBarangBerstok: 0,
          jumlahDihitungDalamJadwal: 0,
          soTerakhir: null,
        },
      ],
    },
  ],
};

describe("susunIsiLaporanSoPdf", () => {
  const isi = susunIsiLaporanSoPdf(LAPORAN, new Date("2026-10-28T18:00:00.000Z"));

  it("memberi judul bulan, ringkasan status, dan nama file per periode", () => {
    expect(isi.judul).toBe("Laporan Stock Opname Oktober 2026");
    expect(isi.subjudul).toBe("Dicetak 29 Okt 2026");
    expect(isi.ringkasan).toContain("Lengkap: 1");
    expect(isi.ringkasan).toContain("Belum SO: 1");
    expect(isi.namaFile).toBe("laporan-so_2026-10.pdf");
  });

  it("membuat satu bagian per site dengan jadwal dan keadaannya", () => {
    expect(isi.bagian.map((bagian) => bagian.judul)).toEqual(["Site A", "Tanpa site"]);
    expect(isi.bagian[0].keterangan).toContain("Sedang berjalan");
    expect(isi.bagian[0].keterangan).toContain("Pengingat mati");
    expect(isi.bagian[1].keterangan).not.toContain("Pengingat mati");
  });

  it("mengisi baris gudang: status, hitungan, dan SO terakhir", () => {
    expect(isi.bagian[0].baris).toEqual([
      ["Gudang Utama", "GD-01", "Lengkap", "4/4", "26 Okt 2026 · Budi"],
      ["Gudang Cabang", "GD-02", "Belum SO", "0/3", "-"],
    ]);
    expect(isi.bagian[1].baris[0][3]).toBe("-");
  });
});
