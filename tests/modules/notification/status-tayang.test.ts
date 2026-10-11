import { describe, expect, it } from "vitest";

import {
  hitungStatusTayang,
  LABEL_STATUS_TAYANG,
  STATUS_TAYANG,
} from "@/modules/notification/domain/status-tayang";

const SEKARANG = new Date("2026-10-11T12:00:00.000Z");
const KEMARIN = "2026-10-10T12:00:00.000Z";
const BESOK = "2026-10-12T12:00:00.000Z";

describe("hitungStatusTayang", () => {
  it("menyatakan non-aktif saat saklar isActive mati, berapa pun periodenya", () => {
    expect(
      hitungStatusTayang(
        { isActive: false, startDate: KEMARIN, endDate: BESOK },
        SEKARANG,
      ),
    ).toBe(STATUS_TAYANG.NONAKTIF);
  });

  it("menyatakan tayang saat sekarang berada di dalam periode", () => {
    expect(
      hitungStatusTayang(
        { isActive: true, startDate: KEMARIN, endDate: BESOK },
        SEKARANG,
      ),
    ).toBe(STATUS_TAYANG.TAYANG);
  });

  it("menyatakan kedaluwarsa saat tanggal berakhir sudah lewat", () => {
    expect(
      hitungStatusTayang(
        { isActive: true, startDate: "2026-05-18T00:00:00.000Z", endDate: "2026-05-20T00:00:00.000Z" },
        SEKARANG,
      ),
    ).toBe(STATUS_TAYANG.KEDALUWARSA);
  });

  it("menyatakan terjadwal saat tanggal mulai masih di depan", () => {
    expect(
      hitungStatusTayang(
        { isActive: true, startDate: BESOK, endDate: null },
        SEKARANG,
      ),
    ).toBe(STATUS_TAYANG.TERJADWAL);
  });

  it("memperlakukan tanggal mulai kosong sebagai berlaku sejak awal", () => {
    expect(
      hitungStatusTayang(
        { isActive: true, startDate: null, endDate: BESOK },
        SEKARANG,
      ),
    ).toBe(STATUS_TAYANG.TAYANG);
  });

  it("memperlakukan tanggal berakhir kosong sebagai tanpa batas", () => {
    expect(
      hitungStatusTayang(
        { isActive: true, startDate: KEMARIN, endDate: null },
        SEKARANG,
      ),
    ).toBe(STATUS_TAYANG.TAYANG);
  });

  it("menerima objek Date, bukan hanya string ISO", () => {
    expect(
      hitungStatusTayang(
        { isActive: true, startDate: new Date(KEMARIN), endDate: new Date(BESOK) },
        SEKARANG,
      ),
    ).toBe(STATUS_TAYANG.TAYANG);
  });

  it("tidak menyatakan kedaluwarsa saat tanggalnya tidak bisa diurai", () => {
    expect(
      hitungStatusTayang(
        { isActive: true, startDate: "bukan tanggal", endDate: "juga bukan" },
        SEKARANG,
      ),
    ).toBe(STATUS_TAYANG.TAYANG);
  });

  it("memakai label Indonesia yang dipakai tabel admin", () => {
    expect(LABEL_STATUS_TAYANG[STATUS_TAYANG.TAYANG]).toBe("Aktif");
    expect(LABEL_STATUS_TAYANG[STATUS_TAYANG.KEDALUWARSA]).toBe("Kedaluwarsa");
  });
});
