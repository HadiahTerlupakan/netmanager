import { describe, expect, it } from "vitest";

import {
  angkaAtauNull,
  angkaBulatAtau,
  RADIUS_ABSENSI_BAWAAN,
} from "@/app/admin/workorders/sites/site-form-payload";
import { siteUpdateSchema } from "@/lib/validations/site";

/**
 * Form site menyimpan seluruh isiannya sebagai string, sedangkan skema API
 * meminta angka. Sebelumnya koordinat dikirim apa adanya dan Zod menolaknya
 * dengan "expected number, received string" — pengguna hanya melihat gagal
 * menyimpan, tanpa tahu field mana yang salah.
 */

describe("angkaAtauNull", () => {
  it("membaca angka desimal dan negatif", () => {
    expect(angkaAtauNull("-6.2615")).toBe(-6.2615);
    expect(angkaAtauNull("106.8106")).toBe(106.8106);
  });

  it("kosong berarti tidak diisi, bukan nol", () => {
    expect(angkaAtauNull("")).toBeNull();
    expect(angkaAtauNull("   ")).toBeNull();
  });

  // NaN lolos `typeof === "number"` dan baru meledak di dalam database.
  it("isian tak terbaca menjadi null, bukan NaN", () => {
    expect(angkaAtauNull("abc")).toBeNull();
    expect(angkaAtauNull("-")).toBeNull();
    expect(angkaAtauNull("Infinity")).toBeNull();
  });
});

describe("angkaBulatAtau", () => {
  it("memakai nilai bawaan saat kosong atau tak terbaca", () => {
    expect(angkaBulatAtau("", 100)).toBe(100);
    expect(angkaBulatAtau("abc", 100)).toBe(100);
  });

  it("memotong desimal, tidak membulatkan ke atas", () => {
    expect(angkaBulatAtau("150.9", 100)).toBe(150);
  });

  it("nol tetap nol, bukan jatuh ke bawaan", () => {
    expect(angkaBulatAtau("0", 100)).toBe(0);
  });
});

describe("muatan form site diterima skema API", () => {
  const muatan = (lat: string, lng: string, radius: string) => ({
    name: "Jakarta Selatan",
    code: "JAKSEL",
    latitude: angkaAtauNull(lat),
    longitude: angkaAtauNull(lng),
    attendanceRadius: angkaBulatAtau(radius, RADIUS_ABSENSI_BAWAAN),
    gudangIds: ["gudang-1"],
  });

  it("koordinat terisi lolos validasi", () => {
    const hasil = siteUpdateSchema.safeParse(muatan("-6.2615", "106.8106", ""));
    expect(hasil.success).toBe(true);
  });

  it("koordinat kosong lolos sebagai null", () => {
    const hasil = siteUpdateSchema.safeParse(muatan("", "", "150"));
    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data.latitude).toBeNull();
      expect(hasil.data.attendanceRadius).toBe(150);
    }
  });

  // Regresi: inilah bentuk yang dulu dikirim dan ditolak.
  it("string mentah ditolak skema, membuktikan perubahan memang perlu", () => {
    const hasil = siteUpdateSchema.safeParse({
      name: "Jakarta Selatan",
      latitude: "-6.2615",
    });

    expect(hasil.success).toBe(false);
    if (!hasil.success) {
      expect(hasil.error.issues[0].message).toMatch(/number/i);
    }
  });

  // Regresi: `gudangIds` dulu tidak dideklarasikan, jadi Zod membuangnya diam-diam.
  it("gudangIds ikut terbawa, tidak disaring", () => {
    const hasil = siteUpdateSchema.safeParse(muatan("", "", "100"));
    expect(hasil.success).toBe(true);
    if (hasil.success) expect(hasil.data.gudangIds).toEqual(["gudang-1"]);
  });
});
