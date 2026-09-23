import { describe, expect, it } from "vitest";

/**
 * Fungsi murni modal ubah kegiatan. Yang dijaga: muatan hanya membawa medan
 * yang benar-benar berubah (server mencatat setiap medan yang dikirim dan
 * berbeda, jadi spasi tambahan tidak boleh jadi "perubahan"), dan pilihan
 * hasil tidak pernah menawarkan nilai yang pasti ditolak server.
 */

import {
  IZIN_UBAH_KEGIATAN,
  keMuatanUbahKegiatan,
  nilaiFormDariKegiatan,
  periksaFormUbah,
  pilihanHasilUbah,
  PESAN_TANPA_PERUBAHAN,
  urlRincianKegiatan,
} from "@/app/admin/presurvei/kegiatan/[id]/ubahKegiatanState";
import type { KegiatanRincianDto } from "@/modules/presurvei/client";

const kegiatan: KegiatanRincianDto = Object.freeze({
  id: "kg-7",
  jenis: "TELEPON",
  userId: "sales-1",
  namaSales: "Andi",
  prospekId: null,
  waktuMulai: "2026-09-10T02:00:00.000Z",
  waktuSelesai: null,
  alamatDikunjungi: null,
  ditemuiNama: "Bu Rina",
  latitude: null,
  longitude: null,
  hasil: "TERTARIK",
  jumlahFoto: 0,
  iklanId: null,
  catatan: null,
  fotoUrls: [],
  dataTeknis: null,
  createdAt: "2026-09-10T02:05:00.000Z",
  updatedAt: "2026-09-10T02:06:07.089Z",
  riwayat: [],
}) as KegiatanRincianDto;

describe("urlRincianKegiatan", () => {
  it("mengarah ke route rincian kegiatan", () => {
    // Ditulis literal, dicocokkan ke app/api/presurvei/kegiatan/[id]/route.ts.
    expect(urlRincianKegiatan("kg-7")).toBe("/api/presurvei/kegiatan/kg-7");
  });
});

describe("IZIN_UBAH_KEGIATAN", () => {
  it("dicocokkan ke gerbang PATCH route", () => {
    expect(IZIN_UBAH_KEGIATAN).toEqual([
      "presurvei:update",
      "m_presurvei:update",
    ]);
  });
});

describe("nilaiFormDariKegiatan", () => {
  it("mengisi form dari kegiatan, null menjadi string kosong", () => {
    expect(nilaiFormDariKegiatan(kegiatan)).toEqual({
      hasil: "TERTARIK",
      ditemuiNama: "Bu Rina",
      catatan: "",
    });
  });
});

describe("keMuatanUbahKegiatan", () => {
  it("mengirim hanya medan yang berubah", () => {
    expect(
      keMuatanUbahKegiatan(kegiatan, {
        hasil: "TERTARIK",
        ditemuiNama: "Bu Rina",
        catatan: "Minta ditelepon sore",
      }),
    ).toEqual({ catatan: "Minta ditelepon sore" });
  });

  it("menganggap isian kosong sebagai null, dan null yang sama bukan perubahan", () => {
    expect(
      keMuatanUbahKegiatan(kegiatan, {
        hasil: "TERTARIK",
        ditemuiNama: "Bu Rina",
        catatan: "   ",
      }),
    ).toEqual({});
  });

  it("mengirim null saat medan terisi dikosongkan", () => {
    expect(
      keMuatanUbahKegiatan(kegiatan, {
        hasil: "TERTARIK",
        ditemuiNama: "",
        catatan: "",
      }),
    ).toEqual({ ditemuiNama: null });
  });

  it("merapikan spasi sebelum membandingkan", () => {
    expect(
      keMuatanUbahKegiatan(kegiatan, {
        hasil: "DEAL",
        ditemuiNama: "  Bu Rina ",
        catatan: "",
      }),
    ).toEqual({ hasil: "DEAL" });
  });
});

describe("periksaFormUbah", () => {
  it("menolak tanpa perubahan dengan pesan, tanpa perjalanan ke server", () => {
    expect(periksaFormUbah(kegiatan, nilaiFormDariKegiatan(kegiatan))).toEqual({
      success: false,
      pesan: PESAN_TANPA_PERUBAHAN,
    });
  });

  it("menolak catatan yang melampaui batas schema", () => {
    const hasil = periksaFormUbah(kegiatan, {
      ...nilaiFormDariKegiatan(kegiatan),
      catatan: "x".repeat(1001),
    });

    expect(hasil.success).toBe(false);
  });

  it("meloloskan muatan yang berubah", () => {
    expect(
      periksaFormUbah(kegiatan, {
        ...nilaiFormDariKegiatan(kegiatan),
        hasil: "DEAL",
      }),
    ).toEqual({
      success: true,
      muatan: { hasil: "DEAL", versi: "2026-09-10T02:06:07.089Z" },
    });
  });
});

describe("pilihanHasilUbah", () => {
  it("hanya menawarkan hasil sekelompok", () => {
    expect(pilihanHasilUbah("TERTARIK")).toEqual(["TERTARIK", "DEAL"]);
    expect(pilihanHasilUbah("PERLU_FOLLOWUP")).toEqual([
      "PERLU_FOLLOWUP",
      "TIDAK_MINAT",
      "TIDAK_ADA_ORANG",
    ]);
  });
});

describe("periksaFormUbah — versi", () => {
  it("selalu menyertakan updatedAt rincian yang ditampilkan sebagai versi", () => {
    const hasil = periksaFormUbah(kegiatan, {
      ...nilaiFormDariKegiatan(kegiatan),
      catatan: "Baru",
    });

    expect(hasil).toEqual({
      success: true,
      muatan: { catatan: "Baru", versi: "2026-09-10T02:06:07.089Z" },
    });
  });

  it("tidak menghitung versi sebagai perubahan", () => {
    expect(periksaFormUbah(kegiatan, nilaiFormDariKegiatan(kegiatan))).toEqual({
      success: false,
      pesan: PESAN_TANPA_PERUBAHAN,
    });
  });
});
