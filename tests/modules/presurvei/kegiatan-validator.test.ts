import { describe, expect, it } from "vitest";

/**
 * Pemeriksaan konsistensi jenis-kolom tidak boleh memakai truthiness. Angka 0
 * adalah nilai yang sah — koordinat di khatulistiwa atau meridian, dan estimasi
 * kabel nol meter — sedangkan `!0` bernilai true dan akan salah menganggapnya
 * kosong. Berkas ini yang menjaga agar jebakan itu tidak kembali.
 */

import {
  catatKegiatanSchema,
  ubahKegiatanSchema,
} from "@/modules/presurvei/validators/kegiatan.validator";
import { TOLERANSI_SKEW_JAM_MENIT } from "@/modules/presurvei/client";

const MENIT_KE_MS = 60 * 1000;
const JAM_KE_MS = 60 * MENIT_KE_MS;

// Relatif terhadap sekarang, bukan tanggal tetap: `waktuMulai` sekarang punya
// batas atas, jadi tanggal yang dipaku di berkas ini akan menjadi bom waktu
// begitu ia jatuh di sisi lain batas itu.
const WAKTU = new Date(Date.now() - JAM_KE_MS);

const kunjungan = (over: Record<string, unknown> = {}) => ({
  jenis: "KUNJUNGAN",
  waktuMulai: WAKTU,
  latitude: -6.2,
  longitude: 106.8,
  hasil: "PERLU_FOLLOWUP",
  ...over,
});

describe("catatKegiatanSchema — koordinat", () => {
  it("menerima kunjungan berkoordinat nol", () => {
    const hasil = catatKegiatanSchema.safeParse(
      kunjungan({ latitude: 0, longitude: 0 }),
    );

    expect(hasil.success).toBe(true);
  });

  it("menolak kunjungan tanpa koordinat", () => {
    const hasil = catatKegiatanSchema.safeParse(
      kunjungan({ latitude: undefined, longitude: undefined }),
    );

    expect(hasil.success).toBe(false);
  });

  it("tidak menuntut koordinat untuk kegiatan telepon", () => {
    const hasil = catatKegiatanSchema.safeParse({
      jenis: "TELEPON",
      waktuMulai: WAKTU,
      hasil: "PERLU_FOLLOWUP",
    });

    expect(hasil.success).toBe(true);
  });
});

describe("catatKegiatanSchema — data teknis", () => {
  it("menolak estimasi kabel nol pada kegiatan bukan survei", () => {
    const hasil = catatKegiatanSchema.safeParse(
      kunjungan({ estimasiKabelMeter: 0 }),
    );

    expect(hasil.success).toBe(false);
  });

  it("menolak data teknis lain pada kegiatan bukan survei", () => {
    expect(
      catatKegiatanSchema.safeParse(kunjungan({ odpTerdekat: "ODP-12" }))
        .success,
    ).toBe(false);
    expect(
      catatKegiatanSchema.safeParse(kunjungan({ catatanTeknis: "perlu tiang" }))
        .success,
    ).toBe(false);
  });

  it("menerima estimasi kabel nol pada survei lokasi", () => {
    const hasil = catatKegiatanSchema.safeParse(
      kunjungan({ jenis: "SURVEI_LOKASI", estimasiKabelMeter: 0 }),
    );

    expect(hasil.success).toBe(true);
  });
});

describe("catatKegiatanSchema — batas waktu mulai", () => {
  // Daftar kegiatan diurutkan `waktuMulai: "desc"`. Satu perangkat dengan jam
  // melenceng jauh, atau satu salah ketik tahun, akan menempel di puncak setiap
  // daftar selamanya — tapi skew beberapa menit adalah kenyataan lapangan dan
  // datanya sah.
  it("menerima kegiatan yang baru saja terjadi", () => {
    const hasil = catatKegiatanSchema.safeParse(
      kunjungan({ waktuMulai: new Date() }),
    );

    expect(hasil.success).toBe(true);
  });

  it("menerima jam perangkat yang melenceng sedikit ke depan", () => {
    const hasil = catatKegiatanSchema.safeParse(
      kunjungan({ waktuMulai: new Date(Date.now() + 5 * MENIT_KE_MS) }),
    );

    expect(hasil.success).toBe(true);
  });

  it("menegakkan batas masa depan persis sebesar toleransi yang diekspor ke klien", () => {
    // Konstanta yang sama dibaca `KegiatanFormModal.tsx` untuk petunjuknya.
    // Test identitas (`toBe(15)`) hanya mengunci angka; yang dijaga di sini
    // adalah bahwa angka itu memang yang ditegakkan schema — satu menit di
    // bawahnya lolos, satu menit di atasnya ditolak.
    const diBawahBatas = catatKegiatanSchema.safeParse(
      kunjungan({
        waktuMulai: new Date(
          Date.now() + (TOLERANSI_SKEW_JAM_MENIT - 1) * MENIT_KE_MS,
        ),
      }),
    );
    const diAtasBatas = catatKegiatanSchema.safeParse(
      kunjungan({
        waktuMulai: new Date(
          Date.now() + (TOLERANSI_SKEW_JAM_MENIT + 1) * MENIT_KE_MS,
        ),
      }),
    );

    expect(diBawahBatas.success).toBe(true);
    expect(diAtasBatas.success).toBe(false);
  });

  it("menolak waktu mulai jauh di masa depan", () => {
    const hasil = catatKegiatanSchema.safeParse(
      kunjungan({ waktuMulai: new Date(Date.now() + 24 * JAM_KE_MS) }),
    );

    expect(hasil.success).toBe(false);
  });

  it("menolak salah ketik tahun yang melompat jauh ke depan", () => {
    const hasil = catatKegiatanSchema.safeParse(
      kunjungan({ waktuMulai: new Date("2126-09-22T01:00:00.000Z") }),
    );

    expect(hasil.success).toBe(false);
  });
});

describe("catatKegiatanSchema — kegiatan iklan", () => {
  it("menolak kegiatan iklan tanpa iklanId", () => {
    const hasil = catatKegiatanSchema.safeParse({
      jenis: "IKLAN",
      waktuMulai: WAKTU,
      hasil: "PERLU_FOLLOWUP",
    });

    expect(hasil.success).toBe(false);
  });

  it("menerima kegiatan iklan yang menunjuk sebuah iklan", () => {
    const hasil = catatKegiatanSchema.safeParse({
      jenis: "IKLAN",
      waktuMulai: WAKTU,
      hasil: "PERLU_FOLLOWUP",
      iklanId: "iklan-1",
    });

    expect(hasil.success).toBe(true);
  });
});

describe("ubahKegiatanSchema — medan yang boleh diubah", () => {
  it("menerima catatan, nama yang ditemui, dan hasil", () => {
    const hasil = ubahKegiatanSchema.safeParse({
      catatan: "Minta dihubungi sore",
      ditemuiNama: "Pak Joko",
      hasil: "DEAL",
    });

    expect(hasil.success).toBe(true);
    expect(hasil.data).toEqual({
      catatan: "Minta dihubungi sore",
      ditemuiNama: "Pak Joko",
      hasil: "DEAL",
    });
  });

  it("menerima null untuk mengosongkan catatan dan nama yang ditemui", () => {
    const hasil = ubahKegiatanSchema.safeParse({
      catatan: null,
      ditemuiNama: null,
    });

    expect(hasil.success).toBe(true);
  });

  it("menolak badan kosong", () => {
    expect(ubahKegiatanSchema.safeParse({}).success).toBe(false);
  });

  it("menolak hasil null — hasil wajib selalu terisi", () => {
    expect(ubahKegiatanSchema.safeParse({ hasil: null }).success).toBe(false);
  });

  it("menolak catatan melebihi batas panjang", () => {
    const hasil = ubahKegiatanSchema.safeParse({ catatan: "x".repeat(1001) });
    expect(hasil.success).toBe(false);
  });
});

describe("ubahKegiatanSchema — medan terlarang ditolak, bukan dibuang", () => {
  // Satu medan terlarang per kelompok. `.strict()` membuatnya 400; tanpa itu
  // Zod diam-diam membuang medannya dan pemanggil mengira perubahannya
  // tersimpan.
  it.each([
    ["angka laporan: jenis", { jenis: "KUNJUNGAN" }],
    ["angka laporan: waktuMulai", { waktuMulai: "2026-09-01T00:00:00.000Z" }],
    ["angka laporan: userId", { userId: "sales-lain" }],
    ["koordinat", { latitude: -6.1 }],
    ["foto", { fotoUrls: ["https://contoh.id/a.jpg"] }],
    ["data teknis", { odpTerdekat: "ODP-1" }],
    ["tautan: prospekId", { prospekId: "prospek-9" }],
    ["alamat", { alamatDikunjungi: "Jl. Lain" }],
    ["tenant", { tenantId: "tenant-lain" }],
    ["jejak audit", { diubahOlehId: "orang-lain" }],
  ])("menolak %s", (_kelompok, medanTerlarang) => {
    const hasil = ubahKegiatanSchema.safeParse({
      catatan: "sah",
      ...medanTerlarang,
    });

    expect(hasil.success).toBe(false);
  });
});

describe("ubahKegiatanSchema — versi yang dilihat klien", () => {
  it("mengubah versi ISO bermilidetik menjadi Date tanpa kehilangan presisi", () => {
    // `toISOString()` bermilidetik, sama dengan kolom TIMESTAMP(3).
    const updatedAt = new Date("2026-09-22T04:00:00.123Z");

    const hasil = ubahKegiatanSchema.safeParse({
      catatan: "Baru",
      versi: updatedAt.toISOString(),
    });

    expect(hasil.success).toBe(true);
    expect(hasil.data.versi).toBeInstanceOf(Date);
    expect(hasil.data.versi.getTime()).toBe(updatedAt.getTime());
  });

  it("menolak versi yang bukan datetime ISO", () => {
    expect(
      ubahKegiatanSchema.safeParse({ catatan: "Baru", versi: "kemarin" })
        .success,
    ).toBe(false);
  });

  it("menolak badan yang hanya berisi versi — versi bukan perubahan", () => {
    expect(
      ubahKegiatanSchema.safeParse({ versi: "2026-09-22T04:00:00.123Z" })
        .success,
    ).toBe(false);
  });

  it("tetap menerima badan tanpa versi (klien mobile lama)", () => {
    const hasil = ubahKegiatanSchema.safeParse({ catatan: "Baru" });

    expect(hasil.success).toBe(true);
    expect(hasil.data).toEqual({ catatan: "Baru" });
  });
});

describe("ubahKegiatanSchema — perapian teks", () => {
  // Web dan mobile harus menghasilkan nilai yang sama, supaya tidak lahir
  // riwayat `null → ""` atau `"Budi" → " Budi "`.
  it("merapikan spasi di kedua ujung", () => {
    const hasil = ubahKegiatanSchema.safeParse({
      catatan: "  Minta sore  ",
      ditemuiNama: " Pak Joko ",
    });

    expect(hasil.data).toEqual({
      catatan: "Minta sore",
      ditemuiNama: "Pak Joko",
    });
  });

  it("menjadikan isian kosong atau spasi saja sebagai null", () => {
    const hasil = ubahKegiatanSchema.safeParse({
      catatan: "   ",
      ditemuiNama: "",
    });

    expect(hasil.success).toBe(true);
    expect(hasil.data).toEqual({ catatan: null, ditemuiNama: null });
  });

  it("menghitung batas panjang setelah dirapikan", () => {
    const hasil = ubahKegiatanSchema.safeParse({
      catatan: ` ${"x".repeat(1000)} `,
    });

    expect(hasil.success).toBe(true);
  });
});
