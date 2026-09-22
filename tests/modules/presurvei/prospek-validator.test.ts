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

import { buatProspekSchema } from "@/modules/presurvei/validators/prospek.validator";

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
