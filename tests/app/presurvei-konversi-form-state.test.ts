import { describe, expect, it } from "vitest";

import {
  buildJadikanCanvasingUrl,
  isPerluTandaiDeal,
  isTawarkanKonversi,
  keMuatanKonversi,
  kunciSetelahKonversi,
  pesanDealTanpaCanvasing,
  validasiFormKonversi,
  type NilaiFormKonversi,
} from "@/app/admin/presurvei/prospek/konversiFormState";
import {
  jadikanCanvasingSchema,
  PROSPEK_STATUSES,
  type ProspekStatus,
} from "@/modules/presurvei/client";

const nilai: NilaiFormKonversi = Object.freeze({
  noKtp: "3201234567890001",
  paket: "20 Mbps",
  kabel: "120",
  odp: "ODP-12",
  sn: "SN-778",
  fotoKtp: "https://cdn.contoh.id/ktp.jpg",
});

describe("keMuatanKonversi", () => {
  it("mengubah kabel menjadi angka", () => {
    expect(keMuatanKonversi(nilai).kabel).toBe(120);
  });

  it("tidak mengirim kabel yang dikosongkan — bukan nol, bukan null", () => {
    // Dikosongkan berarti "pakai estimasi survei", dan server punya
    // fallback-nya (`ProspekKonversiService.ts:176`). Mengirim 0 berarti
    // "kabelnya nol meter". Mengirim null ditolak schema: `kabel` hanya
    // `.optional()`, tidak `.nullable()` (`konversi.validator.ts:19`).
    const muatan = keMuatanKonversi({ ...nilai, kabel: "  " });

    expect(muatan.kabel).toBeUndefined();
    expect(JSON.parse(JSON.stringify(muatan))).not.toHaveProperty("kabel");
    expect(jadikanCanvasingSchema.safeParse(muatan).success).toBe(true);
  });

  it("mempertahankan kabel nol sebagai angka nol", () => {
    // Nol adalah isian, bukan kekosongan; menyaringnya dengan truthiness
    // diam-diam mengganti pernyataan pemakai dengan estimasi survei.
    expect(keMuatanKonversi({ ...nilai, kabel: "0" }).kabel).toBe(0);
  });

  it("mengirim null untuk medan teks opsional yang dikosongkan", () => {
    const muatan = keMuatanKonversi({
      ...nilai,
      odp: "",
      sn: " ",
      fotoKtp: "",
    });

    expect(muatan.odp).toBeNull();
    expect(muatan.sn).toBeNull();
    expect(muatan.fotoKtp).toBeNull();
  });

  it("memakai nilai yang berbeda untuk setiap medan", () => {
    // noKtp/paket dan odp/sn adalah pasangan string bersebelahan; tertukarnya
    // menghasilkan canvasing dengan paket bernama nomor KTP, dan compiler diam.
    expect(keMuatanKonversi(nilai)).toEqual({
      noKtp: "3201234567890001",
      paket: "20 Mbps",
      kabel: 120,
      odp: "ODP-12",
      sn: "SN-778",
      fotoKtp: "https://cdn.contoh.id/ktp.jpg",
    });
  });

  it("merapikan spasi di tepi isian", () => {
    const muatan = keMuatanKonversi({
      ...nilai,
      noKtp: " 3201234567890001 ",
      paket: " 20 Mbps ",
    });

    expect(muatan.noKtp).toBe("3201234567890001");
    expect(muatan.paket).toBe("20 Mbps");
  });

  it("lolos validasi schema konversi", () => {
    expect(
      jadikanCanvasingSchema.safeParse(keMuatanKonversi(nilai)).success,
    ).toBe(true);
  });
});

describe("validasiFormKonversi", () => {
  it("tidak melaporkan apa pun untuk isian yang sah", () => {
    expect(validasiFormKonversi(nilai)).toEqual({});
  });

  it("menolak kabel nol sebelum ada permintaan apa pun", () => {
    // Schema presurvei menerima 0, tapi validator marketing menuntut minimal
    // 1 (`modules/marketing/validators/canvasingValidation.ts:62-65`). Tanpa
    // penolakan di klien, kartu NEGOSIASI sudah dipindah ke DEAL sebelum
    // server menolak kabelnya.
    expect(validasiFormKonversi({ ...nilai, kabel: "0" })).toEqual({
      kabel: "Panjang kabel minimal 1 meter",
    });
  });

  it("menerima kabel yang dikosongkan", () => {
    expect(validasiFormKonversi({ ...nilai, kabel: "" })).toEqual({});
  });

  it("menolak kabel yang bukan bilangan bulat", () => {
    expect(validasiFormKonversi({ ...nilai, kabel: "12.5" })).toHaveProperty(
      "kabel",
    );
    expect(validasiFormKonversi({ ...nilai, kabel: "dua" })).toHaveProperty(
      "kabel",
    );
  });

  it("menempelkan pesan ke medan yang salah", () => {
    const kesalahan = validasiFormKonversi({
      ...nilai,
      noKtp: "123",
      paket: "",
    });

    expect(Object.keys(kesalahan).sort()).toEqual(["noKtp", "paket"]);
  });
});

describe("isPerluTandaiDeal", () => {
  it("menandai DEAL lebih dulu untuk prospek yang belum DEAL", () => {
    // Arah berisik: tanpa PATCH, `jadikanCanvasing` menolak 409
    // (`ProspekKonversiService.ts:73-81`).
    expect(isPerluTandaiDeal("NEGOSIASI")).toBe(true);
  });

  it("tidak mengirim PATCH untuk prospek yang sudah DEAL", () => {
    // Arah senyap: PATCH DEAL→DEAL lolos tanpa error karena
    // `ProspekService.ubah` melewati pemeriksaan transisi bila status sama.
    expect(isPerluTandaiDeal("DEAL")).toBe(false);
  });
});

describe("isTawarkanKonversi", () => {
  it("hanya menawarkan konversi pada kartu DEAL bagi pemakai yang boleh mengubah", () => {
    const ditawarkan = PROSPEK_STATUSES.filter((status: ProspekStatus) =>
      isTawarkanKonversi({ status, canvasingId: null }, true),
    );

    expect(ditawarkan).toEqual(["DEAL"]);
    expect(
      isTawarkanKonversi({ status: "DEAL", canvasingId: null }, false),
    ).toBe(false);
  });

  it("tidak menawarkan konversi pada kartu DEAL yang sudah punya canvasing", () => {
    // Tanpa `canvasingId` di daftar, tombol tampil di setiap kartu DEAL dan
    // modal baru bisa bilang "sudah dijadikan canvasing" setelah dibuka.
    expect(
      isTawarkanKonversi({ status: "DEAL", canvasingId: "cv-lama" }, true),
    ).toBe(false);
  });

  it("tetap menawarkan konversi saat canvasingId tidak terbawa sama sekali", () => {
    // `undefined` lolos kompilasi karena `strictNullChecks: false`; ia berarti
    // "tidak diketahui punya canvasing", bukan "sudah punya".
    expect(
      isTawarkanKonversi({ status: "DEAL", canvasingId: undefined }, true),
    ).toBe(true);
  });
});

describe("kunciSetelahKonversi", () => {
  it("membuang kolom asal, kolom DEAL, dan salinan rincian prospek", () => {
    expect(kunciSetelahKonversi("p-9", "NEGOSIASI")).toEqual([
      ["presurvei-prospek-kolom", "NEGOSIASI"],
      ["presurvei-prospek-kolom", "DEAL"],
      ["/api/presurvei/prospek/p-9"],
    ]);
  });

  it("tidak menggandakan kolom DEAL bila prospeknya sudah DEAL", () => {
    expect(kunciSetelahKonversi("p-9", "DEAL")).toEqual([
      ["presurvei-prospek-kolom", "DEAL"],
      ["/api/presurvei/prospek/p-9"],
    ]);
  });
});

describe("buildJadikanCanvasingUrl", () => {
  it("menunjuk ke endpoint promosi prospek", () => {
    expect(buildJadikanCanvasingUrl("p/9")).toBe(
      "/api/presurvei/prospek/p%2F9/jadikan-canvasing",
    );
  });
});

describe("pesanDealTanpaCanvasing", () => {
  it("mengatakan bahwa status sudah Deal dan konversinya bisa diulang", () => {
    expect(pesanDealTanpaCanvasing("Nomor KTP tidak valid")).toBe(
      'Status prospek sudah menjadi Deal, tetapi canvasing belum dibuat: Nomor KTP tidak valid. Perbaiki isian lalu simpan lagi, atau ulangi nanti lewat tombol "Jadikan canvasing" di kartunya.',
    );
  });
});
