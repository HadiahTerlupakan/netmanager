import type {
  GrowthSettings,
  RabTrackingAchievement,
  RabTrackingProject,
} from "@/modules/finance/client";
import type { Prisma, RabActualAchievement, RabExpenseType } from "@prisma/client";

/** Proyek RAB dari Prisma dengan item & capaian — cukup untuk mesin tracking. */
export type ProyekRabUntukTracking = Prisma.RabProjectGetPayload<object> & {
  items: { totalPrice: bigint; expenseType: RabExpenseType }[];
  actualAchievements: RabActualAchievement[];
};

/**
 * Data RAB dari Prisma → masukan mesin tracking RAB (sama dengan yang dipakai
 * halaman admin RAB, sehingga angka bagi hasil investor sama dengan tabel
 * tracking di admin).
 */
export function keInputTracking(proyek: ProyekRabUntukTracking): RabTrackingProject {
  return {
    projectedOpex: Number(proyek.projectedOpex),
    targetSubscribers: proyek.targetSubscribers,
    arpu: proyek.arpu === null ? null : Number(proyek.arpu),
    growthType: proyek.growthType,
    paymentType: proyek.paymentType,
    // Json bebas di DB; bentuknya divalidasi saat RAB disimpan.
    growthSettings: (proyek.growthSettings as unknown as GrowthSettings | null) ?? null,
    investmentDurationMonths: proyek.investmentDurationMonths,
    investmentRecoveryType: proyek.investmentRecoveryType,
    investmentRecoveryValue: proyek.investmentRecoveryValue,
    investorProfitSharePercent: proyek.investorProfitSharePercent,
    investorProfitShareMode: proyek.investorProfitShareMode,
    investorProfitShareBeforeBepPercent: proyek.investorProfitShareBeforeBepPercent,
    investorProfitShareAfterBepPercent: proyek.investorProfitShareAfterBepPercent,
    nplTolerancePercent: proyek.nplTolerancePercent,
    opexBufferFundingMode: proyek.opexBufferFundingMode,
    opexBufferInvestorPercent: proyek.opexBufferInvestorPercent,
    opexBufferInvestorFixedAmount: Number(proyek.opexBufferInvestorFixedAmount),
    opexBufferSafetyPercent: proyek.opexBufferSafetyPercent,
    items: proyek.items.map((item) => ({
      totalPrice: Number(item.totalPrice),
      expenseType: item.expenseType,
    })),
  };
}

const keAngkaAtauNull = (nilai: bigint | number | null) =>
  nilai === null ? null : Number(nilai);

/** Capaian aktual bulanan proyek untuk mesin tracking. */
export function keCapaianTracking(proyek: ProyekRabUntukTracking): RabTrackingAchievement[] {
  return proyek.actualAchievements.map((capaian) => ({
    month: capaian.month,
    actualRevenue: Number(capaian.actualRevenue),
    manualRecoveryInstallment: keAngkaAtauNull(capaian.manualRecoveryInstallment),
    manualInvestorShare: keAngkaAtauNull(capaian.manualInvestorShare),
    manualCompanyShare: keAngkaAtauNull(capaian.manualCompanyShare),
    manualInvestorProfitSharePercent: capaian.manualInvestorProfitSharePercent,
  }));
}
