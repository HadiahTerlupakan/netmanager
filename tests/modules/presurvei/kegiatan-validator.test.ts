import { describe, expect, it } from "vitest";

/**
 * Pemeriksaan konsistensi jenis-kolom tidak boleh memakai truthiness. Angka 0
 * adalah nilai yang sah — koordinat di khatulistiwa atau meridian, dan estimasi
 * kabel nol meter — sedangkan `!0` bernilai true dan akan salah menganggapnya
 * kosong. Berkas ini yang menjaga agar jebakan itu tidak kembali.
 */

import { catatKegiatanSchema } from "@/modules/presurvei/validators/kegiatan.validator";

const WAKTU = new Date("2026-09-22T01:00:00.000Z");

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
