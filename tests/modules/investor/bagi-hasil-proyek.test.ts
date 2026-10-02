import { describe, expect, it } from "vitest";

import {
  awalBulanKalender,
  bagianInvestor,
  ringkasPeriodeProyek,
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

  it("hanya bulan aktual (bukan proyeksi) di dalam periode yang dijumlahkan", () => {
    const ringkasan = ringkasPeriodeProyek(
      [baris(2), baris(3), baris(4, true), baris(5)],
      MULAI,
      new Date("2026-07-01T00:00:00.000Z"),
      new Date("2026-09-30T00:00:00.000Z"),
    );
    // bulan ke-2 (Jul) & ke-3 (Agu) aktual; ke-4 (Sep) proyeksi; ke-5 (Okt) di luar periode
    expect(ringkasan).toEqual({
      jumlahBulan: 2,
      labaBersih: 4_000_000,
      bagiHasilInvestor: 2_000_000,
      pengembalianModal: 4_000_000,
    });
  });

  it("bagian investor mengikuti porsi modal; persen dihitung dari laba proyek", () => {
    const ringkasan = { jumlahBulan: 1, labaBersih: 2_000_000, bagiHasilInvestor: 1_000_000, pengembalianModal: 2_000_000 };
    expect(bagianInvestor(ringkasan, 0.6)).toEqual({
      bagiHasil: 600_000,
      pengembalianModal: 1_200_000,
      persenDariLaba: 30,
    });
    expect(bagianInvestor({ ...ringkasan, labaBersih: 0 }, 0.5).persenDariLaba).toBe(0);
  });
});
