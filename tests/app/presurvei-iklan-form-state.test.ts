import { describe, expect, it } from "vitest";

/**
 * Konversi antara nilai form dan muatan API. Medan form selalu string karena
 * berasal dari <input>; API menuntut angka, tanggal, dan null. Di konversi
 * inilah kesalahan paling mudah bersembunyi.
 */

import { buatIklanSchema, ubahIklanSchema } from "@/modules/presurvei/client";
import {
  keKesalahanForm,
  keMuatanBuat,
  keMuatanUbah,
  keNilaiForm,
  KUNCI_KESALAHAN_FORM,
  muatanUntukMode,
  opsiSimpanUntukMode,
  schemaUntukMode,
  type ModeFormIklan,
  type NilaiFormIklan,
} from "@/app/admin/presurvei/iklan/iklanFormState";

const MODE_BUAT: ModeFormIklan = { jenis: "buat" };
const MODE_UBAH: ModeFormIklan = { jenis: "ubah", iklanId: "iklan-1" };

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
    expect(schemaUntukMode(MODE_UBAH)).toBe(ubahIklanSchema);
  });

  it("memakai schema buat pada mode buat, yang mewajibkan kode", () => {
    expect(schemaUntukMode(MODE_BUAT)).toBe(buatIklanSchema);
  });

  it("menolak muatan buat tanpa kode, dan menerimanya pada mode ubah", () => {
    // Identitas saja tidak membuktikan kedua schema memang berbeda perlakuan:
    // kalau `buatIklanSchema` dan `ubahIklanSchema` kelak jadi sama, kedua
    // test di atas tetap hijau sementara medan kode diam-diam jadi opsional.
    const tanpaKode = keMuatanUbah(nilaiLengkap);

    expect(schemaUntukMode(MODE_BUAT).safeParse(tanpaKode).success).toBe(false);
    expect(schemaUntukMode(MODE_UBAH).safeParse(tanpaKode).success).toBe(true);
  });
});

describe("muatanUntukMode", () => {
  it("memakai pembentuk ubah pada mode ubah", () => {
    expect(muatanUntukMode(MODE_UBAH, nilaiLengkap)).toEqual(
      keMuatanUbah(nilaiLengkap),
    );
  });

  it("memakai pembentuk buat pada mode buat", () => {
    expect(muatanUntukMode(MODE_BUAT, nilaiLengkap)).toEqual(
      keMuatanBuat(nilaiLengkap),
    );
  });

  it("tidak pernah mengirim kode pada mode ubah", () => {
    // Inilah arah yang senyap. `ubahIklanSchema` men-strip `kode` tanpa error,
    // jadi memakai pembentuk buat di mode ubah lolos validasi dan lolos test
    // identitas apa pun yang cuma membandingkan bentuk.
    expect(muatanUntukMode(MODE_UBAH, nilaiLengkap)).not.toHaveProperty("kode");
  });
});

describe("opsiSimpanUntukMode", () => {
  it("mengirim PATCH ke endpoint detail pada mode ubah", () => {
    expect(opsiSimpanUntukMode(MODE_UBAH)).toEqual({
      url: "/api/admin/presurvei/iklan/iklan-1",
      method: "PATCH",
      pesanSukses: "Kampanye berhasil diperbarui",
      pesanGagal: "Gagal memperbarui kampanye",
    });
  });

  it("mengirim POST ke endpoint daftar pada mode buat", () => {
    expect(opsiSimpanUntukMode(MODE_BUAT)).toEqual({
      url: "/api/admin/presurvei/iklan",
      method: "POST",
      pesanSukses: "Kampanye berhasil dibuat",
      pesanGagal: "Gagal membuat kampanye",
    });
  });

  it("menurunkan schema, muatan, dan tujuan permintaan dari satu mode", () => {
    // Inilah cacat yang ronde ini tutup. Bentuk form dan tujuan permintaannya
    // dulu dua nilai terpisah: mode buat di layar ubah menyertakan `kode` di
    // muatan PATCH, `ubahIklanSchema` men-strip-nya tanpa error, server
    // menjawab 200, dan pemakai yakin kode UTM-nya sudah berubah.
    expect(muatanUntukMode(MODE_UBAH, nilaiLengkap)).not.toHaveProperty("kode");
    expect(schemaUntukMode(MODE_UBAH)).toBe(ubahIklanSchema);
    expect(opsiSimpanUntukMode(MODE_UBAH).method).toBe("PATCH");
  });
});

describe("keKesalahanForm", () => {
  it("memetakan pesan ke medan yang disebut path-nya", () => {
    expect(
      keKesalahanForm([{ path: ["nama"], message: "Terlalu pendek" }]),
    ).toEqual({ nama: "Terlalu pendek" });
  });

  it("mengalihkan issue level-akar ke pesan form, bukan kunci 'undefined'", () => {
    // Aturan lintas-medan seperti "tanggal selesai mendahului mulai" punya
    // path kosong. `String(path[0])` menghasilkan kunci "undefined" yang tidak
    // dibaca medan mana pun: pemakai menekan Simpan, form menolak, dan tidak
    // ada satu pun pesan yang muncul di layar.
    const kesalahan = keKesalahanForm([
      { path: [], message: "Tanggal selesai mendahului tanggal mulai" },
    ]);

    expect(kesalahan).not.toHaveProperty("undefined");
    expect(kesalahan[KUNCI_KESALAHAN_FORM]).toBe(
      "Tanggal selesai mendahului tanggal mulai",
    );
  });

  it("mengalihkan medan tanpa slot pesan ke pesan form", () => {
    // `isAktif` adalah checkbox tanpa tempat menampilkan pesan, dan
    // `penanggungJawabId` ada di schema tapi tidak dirender sama sekali.
    // Keduanya hilang tanpa jejak persis seperti path kosong.
    expect(
      keKesalahanForm([{ path: ["isAktif"], message: "Bukan boolean" }]),
    ).toEqual({ [KUNCI_KESALAHAN_FORM]: "Bukan boolean" });
    expect(
      keKesalahanForm([
        { path: ["penanggungJawabId"], message: "Tidak dikenal" },
      ]),
    ).toEqual({ [KUNCI_KESALAHAN_FORM]: "Tidak dikenal" });
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
