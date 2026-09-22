import { describe, expect, it } from "vitest";

/**
 * Konversi antara nilai form dan muatan API. Medan form selalu string karena
 * berasal dari <input>; API menuntut angka, tanggal, dan null. Di konversi
 * inilah kesalahan paling mudah bersembunyi.
 */

import { buatIklanSchema, ubahIklanSchema } from "@/modules/presurvei/client";
import {
  keMuatanBuat,
  keMuatanUbah,
  keNilaiForm,
  muatanUntukMode,
  schemaUntukMode,
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

describe("schemaUntukMode", () => {
  it("memakai schema ubah pada mode ubah, yang tidak menerima kode", () => {
    // Bentuk ubah adalah subset struktural dari bentuk buat, jadi tertukarnya
    // tidak ditolak compiler — hanya test ini yang menahannya.
    expect(schemaUntukMode(true)).toBe(ubahIklanSchema);
  });

  it("memakai schema buat pada mode buat, yang mewajibkan kode", () => {
    expect(schemaUntukMode(false)).toBe(buatIklanSchema);
  });

  it("menolak muatan buat tanpa kode, dan menerimanya pada mode ubah", () => {
    // Identitas saja tidak membuktikan kedua schema memang berbeda perlakuan:
    // kalau `buatIklanSchema` dan `ubahIklanSchema` kelak jadi sama, kedua
    // test di atas tetap hijau sementara medan kode diam-diam jadi opsional.
    const tanpaKode = keMuatanUbah(nilaiLengkap);

    expect(schemaUntukMode(false).safeParse(tanpaKode).success).toBe(false);
    expect(schemaUntukMode(true).safeParse(tanpaKode).success).toBe(true);
  });
});

describe("muatanUntukMode", () => {
  it("memakai pembentuk ubah pada mode ubah", () => {
    expect(muatanUntukMode(true, nilaiLengkap)).toEqual(
      keMuatanUbah(nilaiLengkap),
    );
  });

  it("memakai pembentuk buat pada mode buat", () => {
    expect(muatanUntukMode(false, nilaiLengkap)).toEqual(
      keMuatanBuat(nilaiLengkap),
    );
  });

  it("tidak pernah mengirim kode pada mode ubah", () => {
    // Inilah arah yang senyap. `ubahIklanSchema` men-strip `kode` tanpa error,
    // jadi memakai pembentuk buat di mode ubah lolos validasi dan lolos test
    // identitas apa pun yang cuma membandingkan bentuk.
    expect(muatanUntukMode(true, nilaiLengkap)).not.toHaveProperty("kode");
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
