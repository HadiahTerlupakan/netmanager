import { describe, expect, it } from "vitest";

import {
  awalBulanKalender,
  bagianInvestor,
  barisDalamPeriode,
} from "@/modules/investor/domain/bagi-hasil-proyek";

const MULAI = new Date("2026-06-15T00:00:00.000Z");
const baris = (month: number, isAutoAssumed = false) => ({
  month,
  isAutoAssumed,
  netProfit: 2_000_000,
  investorShare: 1_000_000,
  recoveryInstallment: 2_000_000,
});

describe("bagi hasil per proyek", () => {
  it("bulan ke-n dihitung dari bulan tanggal mulai proyek", () => {
    expect(awalBulanKalender(MULAI, 1).toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(awalBulanKalender(MULAI, 8).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("hanya bulan aktual (bukan proyeksi) di dalam periode yang diambil", () => {
    const hasil = barisDalamPeriode(
      [baris(2), baris(3), baris(4, true), baris(5)],
      MULAI,
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-09-30T00:00:00.000Z"),
    );
    // bulan ke-2 (Jul) & ke-3 (Agu) aktual; ke-4 (Sep) proyeksi; ke-5 (Okt) di luar periode
    expect(hasil.map((b) => b.month)).toEqual([2, 3]);
  });

  it("bagian investor mengikuti porsi modal, dibulatkan per bulan, mencatat bulan yang tercakup", () => {
    const bagian = bagianInvestor([baris(2), baris(3)], 0.6);
    expect(bagian).toEqual({
      bulan: [2, 3],
      labaBersih: 4_000_000,
      bagiHasil: 1_200_000,
      pengembalianModal: 2_400_000,
      persenDariLaba: 30,
    });
    const pecahan = bagianInvestor(
      [{ ...baris(1), investorShare: 0.005 }, { ...baris(2), investorShare: 0.005 }],
      1,
    );
    // 0,005 dibulatkan per bulan → 0,01 + 0,01 (sama dengan portal investor)
    expect(pecahan.bagiHasil).toBe(0.02);
    expect(bagianInvestor([{ ...baris(1), netProfit: 0 }], 0.5).persenDariLaba).toBe(0);
  });
});
