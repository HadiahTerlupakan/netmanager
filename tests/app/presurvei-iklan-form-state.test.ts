import { describe, expect, it } from "vitest";

/**
 * Konversi antara nilai form dan muatan API. Medan form selalu string karena
 * berasal dari <input>; API menuntut angka, tanggal, dan null. Di konversi
 * inilah kesalahan paling mudah bersembunyi.
 */

import {
  keMuatanBuat,
  keMuatanUbah,
  keNilaiForm,
  type NilaiFormIklan,
} from "@/app/admin/presurvei/iklan/iklanFormState";

const nilaiLengkap: NilaiFormIklan = {
  nama: "Promo Ramadan",
  kode: "promo-ramadan",
  channel: "META",
  tanggalMulai: "2026-03-01",
  tanggalSelesai: "2026-04-01",
  biaya: "1500000",
  isAktif: true,
};

describe("keMuatanBuat", () => {
  it("mengubah biaya menjadi angka", () => {
    expect(keMuatanBuat(nilaiLengkap).biaya).toBe(1500000);
  });

  it("mempertahankan biaya nol, bukan mengubahnya jadi null", () => {
    // Kampanye organik berbiaya nol itu sah. Penyaringan berbasis truthiness
    // akan mengubahnya jadi "belum diisi" — dua hal yang berbeda artinya.
    expect(keMuatanBuat({ ...nilaiLengkap, biaya: "0" }).biaya).toBe(0);
  });

  it("mengirim null untuk biaya yang dikosongkan", () => {
    expect(keMuatanBuat({ ...nilaiLengkap, biaya: "" }).biaya).toBeNull();
  });

  it("mengirim null untuk tanggal selesai yang dikosongkan", () => {
    // Kampanye tanpa tanggal selesai berjalan sampai dimatikan manual.
    expect(
      keMuatanBuat({ ...nilaiLengkap, tanggalSelesai: "" }).tanggalSelesai,
    ).toBeNull();
  });

  it("lolos validasi schema buat", async () => {
    const { buatIklanSchema } = await import("@/modules/presurvei/client");

    expect(buatIklanSchema.safeParse(keMuatanBuat(nilaiLengkap)).success).toBe(
      true,
    );
  });
});

describe("keMuatanUbah", () => {
  it("tidak pernah mengirim kode", () => {
    // Kode UTM tidak bisa diubah: mengubahnya memutus atribusi seluruh
    // prospek yang sudah tertaut lewat tautan kampanye lama.
    expect(keMuatanUbah(nilaiLengkap)).not.toHaveProperty("kode");
  });

  it("lolos validasi schema ubah", async () => {
    const { ubahIklanSchema } = await import("@/modules/presurvei/client");

    expect(ubahIklanSchema.safeParse(keMuatanUbah(nilaiLengkap)).success).toBe(
      true,
    );
  });
});

describe("keNilaiForm", () => {
  it("mengisi medan dari iklan yang sudah ada", () => {
    // Nilai sengaja berbeda-beda: nama, kode, dan channel semuanya string
    // bersebelahan, dan tertukarnya tidak akan ditolak compiler.
    const nilai = keNilaiForm({
      id: "iklan-1",
      nama: "Promo Ramadan",
      kode: "promo-ramadan",
      channel: "GOOGLE",
      tanggalMulai: "2026-03-01T00:00:00.000Z",
      tanggalSelesai: null,
      biaya: 0,
      isAktif: false,
      isBerjalan: false,
    } as never);

    expect(nilai.nama).toBe("Promo Ramadan");
    expect(nilai.kode).toBe("promo-ramadan");
    expect(nilai.channel).toBe("GOOGLE");
    expect(nilai.tanggalMulai).toBe("2026-03-01");
    expect(nilai.tanggalSelesai).toBe("");
    // Biaya nol harus tampil sebagai "0" di medan, bukan kosong — kalau
    // kosong, menyimpan ulang akan mengubahnya jadi null tanpa disadari.
    expect(nilai.biaya).toBe("0");
    expect(nilai.isAktif).toBe(false);
  });
});
