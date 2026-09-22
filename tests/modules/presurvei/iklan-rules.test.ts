import { describe, expect, it } from "vitest";

/**
 * "Iklan sedang berjalan" tidak sama dengan "iklan aktif". Penanda `isAktif`
 * menyatakan niat pemiliknya; tanggal menyatakan kenyataannya. Keduanya harus
 * benar agar prospek yang masuk hari ini boleh diatribusikan ke iklan itu.
 */

import { isIklanBerjalan } from "@/modules/presurvei/domain/iklan-rules";
import type { IklanEntity } from "@/modules/presurvei/domain/entities/Iklan";

const HARI_INI = new Date("2026-09-22T00:00:00.000Z");

const iklan = (over: Partial<IklanEntity> = {}): IklanEntity =>
  ({
    id: "iklan-1",
    nama: "Promo Ramadan",
    kode: "promo-ramadan",
    channel: "META",
    tanggalMulai: new Date("2026-09-01T00:00:00.000Z"),
    tanggalSelesai: null,
    biaya: null,
    penanggungJawabId: null,
    isAktif: true,
    tenantId: "tenant-1",
    createdAt: HARI_INI,
    updatedAt: HARI_INI,
    ...over,
  }) as IklanEntity;

describe("isIklanBerjalan", () => {
  it("menganggap iklan aktif tanpa tanggal selesai sebagai berjalan", () => {
    expect(isIklanBerjalan(iklan(), HARI_INI)).toBe(true);
  });

  it("menolak iklan yang penandanya dimatikan meski tanggalnya masih berlaku", () => {
    expect(isIklanBerjalan(iklan({ isAktif: false }), HARI_INI)).toBe(false);
  });

  it("menolak iklan yang belum mulai", () => {
    expect(
      isIklanBerjalan(
        iklan({ tanggalMulai: new Date("2026-10-01T00:00:00.000Z") }),
        HARI_INI,
      ),
    ).toBe(false);
  });

  it("menolak iklan yang sudah lewat", () => {
    expect(
      isIklanBerjalan(
        iklan({ tanggalSelesai: new Date("2026-09-10T00:00:00.000Z") }),
        HARI_INI,
      ),
    ).toBe(false);
  });

  it("menerima iklan pada hari mulainya", () => {
    expect(isIklanBerjalan(iklan({ tanggalMulai: HARI_INI }), HARI_INI)).toBe(
      true,
    );
  });

  it("menerima iklan pada hari selesainya", () => {
    expect(isIklanBerjalan(iklan({ tanggalSelesai: HARI_INI }), HARI_INI)).toBe(
      true,
    );
  });
});
