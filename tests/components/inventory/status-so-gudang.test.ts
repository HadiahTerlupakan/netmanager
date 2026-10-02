import { describe, expect, it } from "vitest";

import type { KepatuhanGudang, LaporanKepatuhanSo } from "@/components/inventory/opname/jadwal/jadwalSoTypes";
import { labelStatusSoGudang, statusSoPerGudang } from "@/components/inventory/opname/jadwal/statusSoGudang";

function gudang(id: string, status: KepatuhanGudang["status"], dihitung = 0, berstok = 5): KepatuhanGudang {
  return { id, kode: id, nama: id, status, jumlahBarangBerstok: berstok, jumlahDihitungDalamJadwal: dihitung, soTerakhir: null };
}

function laporan(...siteGudang: KepatuhanGudang[][]): LaporanKepatuhanSo {
  return {
    periode: "2026-10",
    jumlahPerStatus: { LENGKAP: 0, SEBAGIAN: 0, DI_LUAR_JADWAL: 0, BELUM: 0, TANPA_STOK: 0 },
    site: siteGudang.map((list, i) => ({
      siteId: `s${i}`,
      namaSite: `Site ${i}`,
      jendela: { periode: "2026-10", mulai: "2026-10-01", selesai: "2026-10-31", sumber: "TANPA_JADWAL" },
      keadaan: "TERBUKA",
      isPengingatAktif: false,
      gudang: list,
    })),
  };
}

describe("statusSoPerGudang", () => {
  it("memetakan status tiap gudang", () => {
    const peta = statusSoPerGudang(laporan([gudang("a", "LENGKAP"), gudang("b", "BELUM")]));
    expect(peta.get("a")?.status).toBe("LENGKAP");
    expect(peta.get("b")?.status).toBe("BELUM");
  });

  it("mengambil status terburuk untuk gudang yang dipakai beberapa site", () => {
    const peta = statusSoPerGudang(laporan([gudang("a", "LENGKAP")], [gudang("a", "DI_LUAR_JADWAL")]));
    expect(peta.get("a")?.status).toBe("DI_LUAR_JADWAL");
  });

  it("kosong bila laporan belum termuat", () => {
    expect(statusSoPerGudang(undefined).size).toBe(0);
  });
});

describe("labelStatusSoGudang", () => {
  it("menampilkan progres untuk status sebagian", () => {
    expect(labelStatusSoGudang(gudang("a", "SEBAGIAN", 2, 5))).toBe("◐ Sebagian 2/5");
    expect(labelStatusSoGudang(gudang("a", "BELUM"))).toBe("✗ Belum SO");
  });
});
