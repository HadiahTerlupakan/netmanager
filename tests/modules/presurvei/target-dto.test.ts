import { describe, expect, it } from "vitest";

/**
 * Enam field number bersebelahan (tiga di TargetDto, tiga di tiap kategori
 * pencapaian) adalah permukaan penukaran terbesar di modul ini. Setiap
 * fixture di sini memakai nilai yang berbeda-beda di semua field terkait —
 * nilai kembar membuat tertukarnya lolos diam-diam, compiler diam, test
 * hijau.
 */

import {
  toBarisLaporanDto,
  toTargetDto,
} from "@/modules/presurvei/dto/target.dto";
import type { TargetEntity } from "@/modules/presurvei/domain/entities/Target";
import type { BarisLaporan } from "@/modules/presurvei/services/TargetService";

const target = (over: Partial<TargetEntity> = {}): TargetEntity =>
  ({
    id: "target-1",
    userId: "sales-1",
    periodeTahun: 2026,
    periodeBulan: 9,
    targetKunjungan: 20,
    targetProspek: 11,
    targetKonversi: 6,
    tenantId: "tenant-1",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-22T10:30:00.000Z"),
    ...over,
  }) as TargetEntity;

const barisLaporan = (over: Partial<BarisLaporan> = {}): BarisLaporan =>
  ({
    userId: "sales-1",
    periodeTahun: 2026,
    periodeBulan: 9,
    pencapaian: {
      kunjungan: { target: 20, tercapai: 14, persen: 70 },
      prospek: { target: 11, tercapai: 8, persen: 73 },
      konversi: { target: 6, tercapai: 3, persen: 50 },
    },
    ...over,
  }) as BarisLaporan;

describe("toTargetDto", () => {
  it("membawa field periode dan target tanpa tertukar", () => {
    // periodeTahun/periodeBulan dan ketiga target* semuanya number
    // bersebelahan — toMatchObject dengan nilai berbeda-beda di sini
    // menangkap penukaran manapun di antara keenamnya.
    expect(toTargetDto(target())).toMatchObject({
      id: "target-1",
      userId: "sales-1",
      periodeTahun: 2026,
      periodeBulan: 9,
      targetKunjungan: 20,
      targetProspek: 11,
      targetKonversi: 6,
    });
  });

  it("mengubah updatedAt menjadi ISO string", () => {
    expect(toTargetDto(target()).updatedAt).toBe("2026-09-22T10:30:00.000Z");
  });

  it("tidak membocorkan tenantId atau createdAt ke klien", () => {
    const hasil = toTargetDto(target()) as unknown as Record<string, unknown>;

    expect(hasil).not.toHaveProperty("tenantId");
    expect(hasil).not.toHaveProperty("createdAt");
  });
});

describe("toBarisLaporanDto", () => {
  it("membawa periode dan tiga kategori pencapaian tanpa tertukar", () => {
    // toEqual (bukan toMatchObject): BarisLaporanDto persis enam key ini,
    // jadi kesetaraan penuh sekaligus menangkap prospek<->konversi tertukar
    // dan periodeTahun<->periodeBulan tertukar dalam satu assertion.
    expect(toBarisLaporanDto(barisLaporan())).toEqual({
      userId: "sales-1",
      periodeTahun: 2026,
      periodeBulan: 9,
      kunjungan: { target: 20, tercapai: 14, persen: 70 },
      prospek: { target: 11, tercapai: 8, persen: 73 },
      konversi: { target: 6, tercapai: 3, persen: 50 },
    });
  });
});
