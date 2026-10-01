import { describe, expect, it } from "vitest";

/**
 * Atribusi sumber adalah satu-satunya jawaban atas "dapat prospek ini dari
 * mana". Prospek yang tercatat berasal dari iklan tanpa `iklanId`, atau dari
 * referral tanpa nama perujuk, tidak bisa direkonstruksi setelah tersimpan —
 * laporan efektivitas kampanye jadi menghitung prospek tanpa kampanye.
 *
 * Pemeriksaan "terisi" memakai `isTerisi`, bukan truthiness: string berisi
 * spasi harus dianggap kosong dan jebakan `!0` tidak boleh kembali.
 */

import {
  buatProspekSchema,
  daftarProspekSchema,
  ubahProspekSchema,
} from "@/modules/presurvei/validators/prospek.validator";

const prospek = (over: Record<string, unknown> = {}) => ({
  nama: "Budi",
  noTelp: "081234567890",
  alamat: "Jl. Merdeka 10",
  sumber: "LAPANGAN",
  ...over,
});

describe("buatProspekSchema — sumber IKLAN", () => {
  it("menolak prospek dari iklan tanpa iklanId", () => {
    const hasil = buatProspekSchema.safeParse(prospek({ sumber: "IKLAN" }));

    expect(hasil.success).toBe(false);
  });

  it("menolak prospek dari iklan dengan iklanId berisi spasi saja", () => {
    const hasil = buatProspekSchema.safeParse(
      prospek({ sumber: "IKLAN", iklanId: "   " }),
    );

    expect(hasil.success).toBe(false);
  });

  it("menerima prospek dari iklan yang menunjuk sebuah iklan", () => {
    const hasil = buatProspekSchema.safeParse(
      prospek({ sumber: "IKLAN", iklanId: "iklan-1" }),
    );

    expect(hasil.success).toBe(true);
  });
});

describe("buatProspekSchema — sumber REFERRAL", () => {
  it("menolak prospek dari referral tanpa nama perujuk", () => {
    const hasil = buatProspekSchema.safeParse(prospek({ sumber: "REFERRAL" }));

    expect(hasil.success).toBe(false);
  });

  it("menolak prospek dari referral dengan nama perujuk berisi spasi saja", () => {
    const hasil = buatProspekSchema.safeParse(
      prospek({ sumber: "REFERRAL", referralNama: "  " }),
    );

    expect(hasil.success).toBe(false);
  });

  it("menerima prospek dari referral yang mencatat perujuknya", () => {
    const hasil = buatProspekSchema.safeParse(
      prospek({ sumber: "REFERRAL", referralNama: "Pak Slamet" }),
    );

    expect(hasil.success).toBe(true);
  });
});

describe("buatProspekSchema — sumber lain", () => {
  it("tidak menuntut iklan maupun perujuk untuk prospek lapangan", () => {
    const hasil = buatProspekSchema.safeParse(prospek({ sumber: "LAPANGAN" }));

    expect(hasil.success).toBe(true);
  });

  it("tidak menuntut iklan maupun perujuk untuk walk-in dan website", () => {
    expect(
      buatProspekSchema.safeParse(prospek({ sumber: "WALK_IN" })).success,
    ).toBe(true);
    expect(
      buatProspekSchema.safeParse(prospek({ sumber: "WEBSITE" })).success,
    ).toBe(true);
  });
});

describe("daftarProspekSchema — tanpaPemilik", () => {
  // Nilainya datang dari query string, jadi selalu string. `z.coerce.boolean()`
  // mengubah string "false" menjadi true (`Boolean("false")`); test "false" di
  // bawah yang menjaga agar bentuk itu tidak kembali.
  it('membaca "true" sebagai permintaan prospek tak bertuan', () => {
    expect(
      daftarProspekSchema.parse({ tanpaPemilik: "true" }).tanpaPemilik,
    ).toBe(true);
  });

  it('membaca "false" sebagai tidak menyaring, bukan sebaliknya', () => {
    expect(
      daftarProspekSchema.parse({ tanpaPemilik: "false" }).tanpaPemilik,
    ).toBe(false);
  });

  it("tidak menyaring saat param tidak dikirim", () => {
    expect(daftarProspekSchema.parse({}).tanpaPemilik).toBe(false);
  });

  it("menolak nilai selain true/false", () => {
    expect(daftarProspekSchema.safeParse({ tanpaPemilik: "1" }).success).toBe(
      false,
    );
  });
});

describe("buatProspekSchema — jenis & peran", () => {
  it("menganggap prospek tanpa jenis sebagai calon pelanggan", () => {
    // Klien lama (mobile, registrasi) tidak mengirim jenis sama sekali.
    expect(buatProspekSchema.parse(prospek()).jenis).toBe("CALON_PELANGGAN");
  });

  it("menolak perantara tanpa peran, dengan galat pada isian peran", () => {
    const hasil = buatProspekSchema.safeParse(prospek({ jenis: "PERANTARA" }));

    expect(hasil.success).toBe(false);
    expect(hasil.error?.issues[0]?.path).toEqual(["peran"]);
  });

  it("menolak perantara yang perannya hanya spasi", () => {
    const hasil = buatProspekSchema.safeParse(
      prospek({ jenis: "PERANTARA", peran: "   " }),
    );

    expect(hasil.success).toBe(false);
  });

  it("menerima perantara yang menyebut perannya", () => {
    const hasil = buatProspekSchema.safeParse(
      prospek({ jenis: "PERANTARA", peran: "Ketua RT 03" }),
    );

    expect(hasil.success).toBe(true);
  });

  it("menolak jenis di luar daftar", () => {
    expect(
      buatProspekSchema.safeParse(prospek({ jenis: "MAKELAR" })).success,
    ).toBe(false);
  });
});

describe("ubahProspekSchema — jenis & peran", () => {
  it("membiarkan jenis kosong agar keadaan akhir dinilai service", () => {
    // Tanpa default: default di sini akan diam-diam mengubah perantara jadi
    // calon pelanggan setiap kali form mengirim perubahan lain.
    expect(ubahProspekSchema.parse({ nama: "Budi" }).jenis).toBeUndefined();
  });

  it("menerima perubahan peran saja", () => {
    expect(ubahProspekSchema.parse({ peran: "Kepala desa" }).peran).toBe(
      "Kepala desa",
    );
  });
});

describe("daftarProspekSchema — jenis", () => {
  it("meneruskan filter jenis yang sah", () => {
    expect(daftarProspekSchema.parse({ jenis: "PERANTARA" }).jenis).toBe(
      "PERANTARA",
    );
  });

  it("tidak menyaring jenis saat param tidak dikirim", () => {
    expect(daftarProspekSchema.parse({}).jenis).toBeUndefined();
  });

  it("menolak jenis di luar daftar", () => {
    expect(daftarProspekSchema.safeParse({ jenis: "X" }).success).toBe(false);
  });
});
