import { describe, expect, it } from "vitest";

import {
  buildRABTrackingDataset,
  type RabTrackingAchievement,
  type RabTrackingProject,
} from "@/modules/finance/client";

/** Proyek sederhana: modal 10 jt (CAPEX), OPEX rencana 1 jt/bln, tanpa proyeksi pendapatan. */
function proyek(ubah: Partial<RabTrackingProject> = {}): RabTrackingProject {
  return {
    projectedOpex: 1_000_000,
    targetSubscribers: 0,
    arpu: 0,
    growthType: "LINEAR",
    paymentType: "PREPAID",
    growthSettings: null,
    investmentDurationMonths: 6,
    investmentRecoveryType: "PERCENTAGE",
    investmentRecoveryValue: 50,
    investorProfitSharePercent: 50,
    investorProfitShareMode: "FLAT",
    nplTolerancePercent: 0,
    opexBufferFundingMode: "COMPANY",
    items: [{ totalPrice: 10_000_000, expenseType: "CAPEX" }],
    ...ubah,
  };
}

const capaian = (month: number, actualRevenue: number, ubah: Partial<RabTrackingAchievement> = {}) => ({
  month,
  actualRevenue,
  ...ubah,
});

describe("perbaikan mesin tracking RAB", () => {
  it("persen 0% tetap 0% (sebelumnya jatuh ke bawaan 50%)", () => {
    const { rows } = buildRABTrackingDataset(proyek({ investorProfitSharePercent: 0 }), [capaian(1, 5_000_000)]);
    expect(rows[0].investorProfitSharePercent).toBe(0);
    expect(rows[0].investorShare).toBe(0);
    expect(rows[0].companyShare).toBe(rows[0].netProfit);
  });

  it("modal investor (buffer OPEX) tidak berubah karena capaian aktual diisi", () => {
    const dimodaliInvestor = proyek({ opexBufferFundingMode: "INVESTOR" });
    const tanpaCapaian = buildRABTrackingDataset(dimodaliInvestor, []);
    const denganCapaianNol = buildRABTrackingDataset(dimodaliInvestor, [capaian(1, 0)]);
    expect(denganCapaianNol.totals.initialFundingNeed).toBe(tanpaCapaian.totals.initialFundingNeed);
  });

  it("OPEX aktual dipakai bila diisi; kosong memakai OPEX rencana", () => {
    const { rows } = buildRABTrackingDataset(proyek(), [
      capaian(1, 5_000_000, { actualOpex: 2_500_000 }),
      capaian(2, 5_000_000, { actualOpex: null }),
    ]);
    expect(rows[0].opex).toBe(2_500_000);
    expect(rows[0].grossProfit).toBe(2_500_000);
    expect(rows[1].opex).toBe(1_000_000);
  });

  it("bulan kosong sebelum capaian terakhir tidak mengurangi modal dan tidak dibagi", () => {
    const { rows } = buildRABTrackingDataset(proyek(), [capaian(3, 5_000_000)]);
    for (const bulan of [rows[0], rows[1]]) {
      expect(bulan.isBelumDiisi).toBe(true);
      expect(bulan.recoveryInstallment).toBe(0);
      expect(bulan.investorShare).toBe(0);
      expect(bulan.remainingInvestment).toBe(10_000_000);
    }
    // Bulan ke-3: laba kotor 4 jt → cicilan 50% = 2 jt; sisa modal 8 jt.
    expect(rows[2].recoveryInstallment).toBe(2_000_000);
    expect(rows[2].remainingInvestment).toBe(8_000_000);
    // Bulan sesudah capaian terakhir tetap proyeksi, bukan "belum diisi".
    expect(rows[3].isBelumDiisi).toBe(false);
  });

  it("isian manual dibatasi: cicilan ≤ laba, persen 0–100, bagian tak membuat perusahaan minus", () => {
    const { rows } = buildRABTrackingDataset(proyek(), [
      capaian(1, 5_000_000, { manualRecoveryInstallment: 9_000_000 }),
      capaian(2, 5_000_000, { manualInvestorProfitSharePercent: 150 }),
      capaian(3, 5_000_000, { manualInvestorShare: 99_000_000 }),
    ]);
    expect(rows[0].recoveryInstallment).toBe(4_000_000);
    expect(rows[0].netProfit).toBe(0);
    expect(rows[1].investorProfitSharePercent).toBe(100);
    expect(rows[1].companyShare).toBe(0);
    expect(rows[2].investorShare).toBe(rows[2].netProfit);
    expect(rows[2].companyShare).toBe(0);
    for (const bulan of rows) expect(bulan.companyShare).toBeGreaterThanOrEqual(0);
  });

  it("capaian sesudah durasi tetap dihitung (tidak hilang diam-diam)", () => {
    const { rows } = buildRABTrackingDataset(proyek({ investmentDurationMonths: 3 }), [capaian(5, 5_000_000)]);
    expect(rows).toHaveLength(5);
    expect(rows[4].actualRevenue).toBe(5_000_000);
  });

  it("bulan yang tercatat ganda (data lama) memakai yang terakhir diperbarui", () => {
    const { rows } = buildRABTrackingDataset(proyek(), [
      capaian(1, 9_000_000, { updatedAt: "2026-09-01T00:00:00.000Z" }),
      capaian(1, 3_000_000, { updatedAt: "2026-07-01T00:00:00.000Z" }),
    ]);
    expect(rows[0].actualRevenue).toBe(9_000_000);
  });

  it("bulan BEP diambil dari mesin yang sama", () => {
    const { totals } = buildRABTrackingDataset(
      proyek({ investmentRecoveryValue: 100, investmentDurationMonths: 12 }),
      [capaian(1, 6_000_000), capaian(2, 6_000_000), capaian(3, 6_000_000)],
    );
    // 5 jt laba kotor/bulan, cicilan 100% → modal 10 jt lunas di bulan ke-2.
    expect(totals.bepMonth).toBe(2);
  });
});
