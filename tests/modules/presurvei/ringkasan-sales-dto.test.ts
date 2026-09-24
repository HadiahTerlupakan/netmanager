import { describe, expect, it } from "vitest";

import type { RingkasanSales } from "@/modules/presurvei";
import { toRingkasanSalesDto } from "@/modules/presurvei/dto/ringkasan-sales.dto";

// Anotasi eksplisit wajib: `target: null` tanpa tipe kontekstual memicu
// TS7018 karena strictNullChecks mati (lihat Global Constraints).
const dasar: RingkasanSales = {
  tanggal: new Date("2026-09-24T00:00:00.000Z"),
  kegiatanHariIni: {
    KUNJUNGAN: 3,
    SURVEI_LOKASI: 1,
    TELEPON: 4,
    CHAT: 2,
    IKLAN: 0,
  },
  target: null,
  perluFollowUp: [
    {
      id: "p-1",
      nama: "Budi",
      noTelp: "081200",
      status: "TERTARIK",
      sentuhanTerakhir: new Date("2026-09-20T08:15:00.000Z"),
    },
  ],
};

describe("toRingkasanSalesDto", () => {
  it("menulis tanggal sebagai YYYY-MM-DD dan sentuhan sebagai ISO", () => {
    const dto = toRingkasanSalesDto(dasar);

    expect(dto.tanggal).toBe("2026-09-24");
    expect(dto.perluFollowUp).toEqual([
      {
        id: "p-1",
        nama: "Budi",
        noTelp: "081200",
        status: "TERTARIK",
        sentuhanTerakhir: "2026-09-20T08:15:00.000Z",
      },
    ]);
  });

  it("target belum ditetapkan tetap null", () => {
    expect(toRingkasanSalesDto(dasar).target).toBeNull();
  });

  it("meratakan pencapaian target tanpa menukar barisnya", () => {
    const dto = toRingkasanSalesDto({
      ...dasar,
      target: {
        periodeTahun: 2026,
        periodeBulan: 9,
        pencapaian: {
          kunjungan: { target: 20, tercapai: 10, persen: 50 },
          prospek: { target: 10, tercapai: 3, persen: 30 },
          konversi: { target: 5, tercapai: 1, persen: 20 },
        },
      },
    });

    expect(dto.target).toEqual({
      periodeTahun: 2026,
      periodeBulan: 9,
      kunjungan: { target: 20, tercapai: 10, persen: 50 },
      prospek: { target: 10, tercapai: 3, persen: 30 },
      konversi: { target: 5, tercapai: 1, persen: 20 },
    });
  });

  it("menyalin hitungan per jenis, bukan meneruskan referensinya", () => {
    const hitungan = Object.freeze({ ...dasar.kegiatanHariIni });

    const dto = toRingkasanSalesDto({ ...dasar, kegiatanHariIni: hitungan });

    expect(dto.kegiatanHariIni).toEqual({
      KUNJUNGAN: 3,
      SURVEI_LOKASI: 1,
      TELEPON: 4,
      CHAT: 2,
      IKLAN: 0,
    });
    expect(dto.kegiatanHariIni).not.toBe(hitungan);
  });
});
