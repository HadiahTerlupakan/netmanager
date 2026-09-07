import { describe, expect, it } from "vitest";
import {
  buildEndorsementNumber,
  buildEndorsementPeriod,
  buildNextEndorsementNumber,
  parseEndorsementSequence,
} from "@/modules/endorsement/services/endorsement-number";

/** Nomor surat dipakai manusia untuk merujuk dokumen, jadi bentuknya harus stabil. */

const SEPTEMBER = new Date("2026-09-07T00:00:00.000Z");

describe("buildEndorsementPeriod", () => {
  it("memakai tahun dan bulan berdigit dua", () => {
    expect(buildEndorsementPeriod(SEPTEMBER)).toBe("202609");
    expect(buildEndorsementPeriod(new Date("2026-12-31T00:00:00.000Z"))).toBe(
      "202612",
    );
  });
});

describe("buildEndorsementNumber", () => {
  it("memberi bantalan nol pada nomor urut", () => {
    expect(buildEndorsementNumber(7, "202609")).toBe("PGS/202609/0007");
  });

  it("tidak memotong nomor urut yang melewati empat digit", () => {
    expect(buildEndorsementNumber(12345, "202609")).toBe("PGS/202609/12345");
  });
});

describe("buildNextEndorsementNumber", () => {
  it("mulai dari satu saat belum ada surat", () => {
    expect(buildNextEndorsementNumber(null, SEPTEMBER)).toBe("PGS/202609/0001");
  });

  it("melanjutkan nomor terakhir pada periode yang sama", () => {
    expect(buildNextEndorsementNumber("PGS/202609/0009", SEPTEMBER)).toBe(
      "PGS/202609/0010",
    );
  });

  // Urutan direset tiap bulan; nomor bulan lalu tidak boleh ikut terbawa.
  it("mengulang dari satu saat berganti periode", () => {
    expect(buildNextEndorsementNumber("PGS/202608/0042", SEPTEMBER)).toBe(
      "PGS/202609/0001",
    );
  });

  it("tidak terpengaruh nomor berbentuk asing", () => {
    expect(buildNextEndorsementNumber("SURAT-LAMA-1", SEPTEMBER)).toBe(
      "PGS/202609/0001",
    );
  });
});

describe("parseEndorsementSequence", () => {
  it("mengambil nomor urut", () => {
    expect(parseEndorsementSequence("PGS/202609/0042")).toBe(42);
  });

  it("mengembalikan nol untuk bentuk yang tidak dikenali", () => {
    expect(parseEndorsementSequence("bukan-nomor")).toBe(0);
  });
});
