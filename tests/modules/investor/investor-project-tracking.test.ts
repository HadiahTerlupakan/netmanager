import { describe, expect, it } from "vitest";

import { hitungHasilInvestorProyek } from "@/modules/investor/services/investor-project-tracking.helpers";

function capaian(month: number, actualRevenue: bigint) {
  return {
    id: `ach-${month}`,
    rabProjectId: "rab-1",
    month,
    year: 2026,
    actualSubscribers: 0,
    actualRevenue,
    actualOpex: null as bigint | null,
    manualRecoveryInstallment: null as bigint | null,
    manualInvestorShare: null as bigint | null,
    manualCompanyShare: null as bigint | null,
    manualInvestorProfitSharePercent: null as number | null,
    notes: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tenantId: null as string | null,
  };
}

const PROYEK = {
  projectedOpex: 1_000_000n,
  targetSubscribers: 0,
  arpu: null,
  growthType: "LINEAR",
  paymentType: "PREPAID",
  growthSettings: null,
  investmentDurationMonths: 12,
  investmentRecoveryType: "PERCENTAGE",
  investmentRecoveryValue: 50,
  investorProfitSharePercent: 50,
  investorProfitShareMode: "FLAT",
  investorProfitShareBeforeBepPercent: 80,
  investorProfitShareAfterBepPercent: 60,
  nplTolerancePercent: 0,
  opexBufferFundingMode: "COMPANY",
  opexBufferInvestorPercent: 0,
  opexBufferInvestorFixedAmount: 0n,
  opexBufferSafetyPercent: 0,
  items: [{ totalPrice: 10_000_000n, expenseType: "CAPEX" as const }],
  actualAchievements: [capaian(2, 3_000_000n), capaian(3, 5_000_000n)],
  investors: [{ investmentAmount: 6_000_000n }, { investmentAmount: 4_000_000n }],
} as unknown as Parameters<typeof hitungHasilInvestorProyek>[0];

describe("hasil proyek untuk investor (mesin tracking RAB)", () => {
  it("per bulan aktual: biaya operasional RAB, bagi hasil & pengembalian modal sesuai porsi", () => {
    const hasil = hitungHasilInvestorProyek(PROYEK, 6_000_000n);

    // Jul: 3jt − opex 1jt = 2jt; modal kembali 50% = 1jt; laba 1jt; investor 50% = 500rb → 60% = 300rb.
    // Agu: 5jt − 1jt = 4jt; modal kembali 2jt; laba 2jt; investor 1jt → 600rb.
    expect(hasil.bulanan).toEqual([
      { month: 2, revenue: 3_000_000, opex: 1_000_000, myProfitShare: 300_000, myCapitalReturn: 600_000 },
      { month: 3, revenue: 5_000_000, opex: 1_000_000, myProfitShare: 600_000, myCapitalReturn: 1_200_000 },
    ]);
    expect(hasil.totalBagiHasil).toBe(900_000);
    expect(hasil.totalPengembalianModal).toBe(1_800_000);
  });

  it("bulan proyeksi (belum ada capaian) tidak dihitung", () => {
    const hasil = hitungHasilInvestorProyek({ ...PROYEK, actualAchievements: [] }, 6_000_000n);
    expect(hasil).toMatchObject({ bulanan: [], totalBagiHasil: 0, totalPengembalianModal: 0 });
  });

  it("persen berlaku = persen RAB × porsi modal; mode BEP berganti setelah modal lunas", () => {
    expect(hitungHasilInvestorProyek(PROYEK, 6_000_000n).persenBerlaku).toBe(30);

    const bertingkat = {
      ...PROYEK,
      investorProfitShareMode: "TIERED_AFTER_BEP",
      investorProfitShareBeforeBepPercent: 80,
      investorProfitShareAfterBepPercent: 60,
    } as typeof PROYEK;
    // Modal 10 jt belum lunas (baru kembali 3 jt) → sebelum BEP: 80% × 60% = 48%.
    expect(hitungHasilInvestorProyek(bertingkat, 6_000_000n).persenBerlaku).toBe(48);

    const lunas = {
      ...bertingkat,
      investmentRecoveryValue: 100,
      actualAchievements: [capaian(1, 11_000_000n)],
    } as typeof PROYEK;
    // Bulan ke-1 laba kotor 10 jt → cicilan 100% → modal lunas → sesudah BEP: 60% × 60% = 36%.
    expect(hitungHasilInvestorProyek(lunas, 6_000_000n).persenBerlaku).toBe(36);
  });
});
