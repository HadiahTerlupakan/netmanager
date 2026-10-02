import { calculateMonthlySubscribers } from "./monthly-subscribers";
import type {
  RabTrackingAchievement,
  RABOpexBufferFundingMode,
  RabTrackingProject,
} from "./types";

export interface RABTrackingRow {
  month: number;
  targetSubscribers: number;
  billingSubscribers: number;
  grossTargetRevenue: number;
  projectedRevenue: number;
  actualRevenue: number | null;
  displayRevenue: number;
  nplAmount: number;
  opexGap: number;
  /** OPEX yang dipakai bulan ini: OPEX aktual bila diisi, selain itu OPEX rencana. */
  opex: number;
  grossProfit: number;
  recoveryInstallment: number;
  remainingInvestment: number;
  netProfit: number;
  investorProfitSharePercent: number;
  investorShare: number;
  companyShare: number;
  isAutoAssumed: boolean;
  /**
   * Bulan lampau tanpa capaian (ada capaian di bulan sesudahnya). Tidak
   * dihitung sama sekali — tidak mengurangi modal dan tidak menghasilkan
   * bagi hasil — sampai admin mengisinya.
   */
  isBelumDiisi: boolean;
  hasManualRecoveryInstallment: boolean;
  hasManualInvestorShare: boolean;
  hasManualCompanyShare: boolean;
  hasManualInvestorProfitSharePercent: boolean;
  cumulativeRevenue: number;
  cumulativeNplAmount: number;
  cumulativeGrossProfit: number;
  cumulativeRecoveryInstallment: number;
  cumulativeInvestorShare: number;
  cumulativeCompanyShare: number;
}

export interface RABTrackingTotals {
  grossRevenue: number;
  revenue: number;
  nplAmount: number;
  opex: number;
  grossProfit: number;
  recoveryInstallment: number;
  investorShare: number;
  companyShare: number;
  remainingInvestment: number;
  opexBufferBase: number;
  opexBufferSafety: number;
  opexBufferTotal: number;
  opexBufferInvestorShare: number;
  opexBufferCompanyShare: number;
  opexBufferDurationMonths: number;
  opexBufferCoveredMonths: number[];
  opexBufferDurationLabel: string;
  initialFundingNeed: number;
  investorDepositTotal: number;
  investorTotalReceived: number;
  companyTotalReceived: number;
  /** Bulan ke-n saat modal investor lunas menurut hitungan ini; null bila belum/tidak tercapai. */
  bepMonth: number | null;
}

export interface RABTrackingDataset {
  rows: RABTrackingRow[];
  totals: RABTrackingTotals;
}

/**
 * Capaian per bulan ke-n. Bila ada lebih dari satu baris untuk bulan yang sama
 * (data lama), yang terakhir diperbarui dipakai — deterministik.
 */
function toAchievementMap(
  actualAchievements: RabTrackingAchievement[] = [],
): Map<number, RabTrackingAchievement> {
  const peta = new Map<number, RabTrackingAchievement>();
  for (const capaian of actualAchievements) {
    const lama = peta.get(capaian.month);
    if (!lama || waktuUbah(capaian) >= waktuUbah(lama)) peta.set(capaian.month, capaian);
  }
  return peta;
}

function waktuUbah(capaian: RabTrackingAchievement): number {
  return capaian.updatedAt ? new Date(capaian.updatedAt).getTime() : 0;
}

const PERSEN_PENUH = 100;
const DURASI_BAWAAN_BULAN = 12;
const PERSEN_BAGI_HASIL_BAWAAN = 50;
const PERSEN_SEBELUM_BEP_BAWAAN = 80;
const PERSEN_SESUDAH_BEP_BAWAAN = 60;
const NILAI_PENGEMBALIAN_BAWAAN = 50;

/** Angka dari field opsional; 0 adalah nilai sah (bukan "kosong"). */
function angkaAtau(nilai: number | string | null | undefined, bawaan: number): number {
  if (nilai === null || nilai === undefined || nilai === "") return bawaan;
  const angka = Number(nilai);
  return Number.isFinite(angka) ? angka : bawaan;
}

function batasi(nilai: number, minimum: number, maksimum: number): number {
  return Math.min(Math.max(nilai, minimum), Math.max(minimum, maksimum));
}

function getCapexTotal(project: RabTrackingProject): number {
  return project.items
    .filter((item) => !item.expenseType || item.expenseType === "CAPEX")
    .reduce((sum, item) => sum + Number(item.totalPrice), 0);
}

function getOpexBufferSafety(project: RabTrackingProject, baseAmount: number): number {
  return baseAmount * (Number(project.opexBufferSafetyPercent || 0) / 100);
}

function clampBufferAmount(value: number, total: number): number {
  return Math.min(Math.max(0, value), total);
}

function splitOpexBufferFunding(project: RabTrackingProject, total: number) {
  const mode: RABOpexBufferFundingMode =
    project.opexBufferFundingMode || "INVESTOR";

  if (mode === "COMPANY") {
    return { investorShare: 0, companyShare: total };
  }

  if (mode === "SHARED_PERCENTAGE") {
    const investorPercent = Number(project.opexBufferInvestorPercent || 0);
    const investorShare = clampBufferAmount(
      (total * investorPercent) / 100,
      total,
    );
    return { investorShare, companyShare: total - investorShare };
  }

  if (mode === "FIXED") {
    const investorShare = clampBufferAmount(
      Number(project.opexBufferInvestorFixedAmount || 0),
      total,
    );
    return { investorShare, companyShare: total - investorShare };
  }

  return { investorShare: total, companyShare: 0 };
}

function getOpexBufferCoveredMonths(gaps: number[]): number[] {
  return gaps
    .map((gap, index) => (gap > 0 ? index + 1 : null))
    .filter((month): month is number => month !== null);
}

function getOpexBufferDurationLabel(coveredMonths: number[]): string {
  if (coveredMonths.length === 0) {
    return "Tidak ada gap OPEX ramp-up yang perlu ditutup buffer";
  }

  return `Buffer menutup gap OPEX selama ${coveredMonths.length} bulan (bulan ke-${coveredMonths.join(", ")})`;
}

function calculateOpexBuffer(project: RabTrackingProject, gaps: number[]) {
  const base = gaps.reduce((sum, gap) => sum + gap, 0);
  const safety = getOpexBufferSafety(project, base);
  const total = base + safety;
  const funding = splitOpexBufferFunding(project, total);
  const coveredMonths = getOpexBufferCoveredMonths(gaps);

  return {
    base,
    safety,
    total,
    funding,
    coveredMonths,
    durationLabel: getOpexBufferDurationLabel(coveredMonths),
  };
}

function getBillingSubscribers(
  project: RabTrackingProject,
  monthlySubsTargets: number[],
  index: number,
): number {
  return project.paymentType === "POSTPAID"
    ? monthlySubsTargets[index - 1] || 0
    : monthlySubsTargets[index] || 0;
}

function calculateProjectedRevenue(
  billingSubscribers: number,
  arpu: number,
  nplTolerancePercent: number,
): number {
  return billingSubscribers * arpu * (1 - nplTolerancePercent / 100);
}

/**
 * Kekurangan OPEX per bulan ramp-up, dari PROYEKSI saja. Modal investor
 * (yang sudah disetor) tidak boleh berubah karena capaian aktual diisi.
 */
function calculateOpexGaps(
  project: RabTrackingProject,
  monthlySubsTargets: number[],
): number[] {
  const monthlyOpex = angkaAtau(project.projectedOpex, 0);
  const arpu = angkaAtau(project.arpu, 0);
  const nplTolerancePercent = angkaAtau(project.nplTolerancePercent, 0);

  return monthlySubsTargets.map((_, index) => {
    const billingSubscribers = getBillingSubscribers(project, monthlySubsTargets, index);
    const projectedRevenue = calculateProjectedRevenue(billingSubscribers, arpu, nplTolerancePercent);
    return Math.max(0, monthlyOpex - projectedRevenue);
  });
}

/**
 * Persen bagian investor. Mode BEP memakai sisa modal SEBELUM cicilan bulan
 * ini: bulan saat modal lunas masih "sebelum BEP", persen sesudah BEP
 * berlaku mulai bulan berikutnya.
 */
function getInvestorProfitSharePercent(
  project: RabTrackingProject,
  remainingBeforeThisMonth: number,
): number {
  if (project.investorProfitShareMode !== "TIERED_AFTER_BEP") {
    return angkaAtau(project.investorProfitSharePercent, PERSEN_BAGI_HASIL_BAWAAN);
  }
  if (remainingBeforeThisMonth > 0) {
    return angkaAtau(project.investorProfitShareBeforeBepPercent, PERSEN_SEBELUM_BEP_BAWAAN);
  }
  return angkaAtau(project.investorProfitShareAfterBepPercent, PERSEN_SESUDAH_BEP_BAWAAN);
}

/** Cicilan pengembalian modal bulan ini (manual dibatasi ke laba & sisa modal). */
function hitungCicilanModal(
  project: RabTrackingProject,
  grossProfit: number,
  remaining: number,
  manual: number | null,
): number {
  const batasAtas = Math.min(Math.max(0, grossProfit), Math.max(0, remaining));
  if (manual !== null) return batasi(manual, 0, batasAtas);
  if (batasAtas <= 0) return 0;
  const nilai = angkaAtau(project.investmentRecoveryValue, NILAI_PENGEMBALIAN_BAWAAN);
  const cicilan =
    (project.investmentRecoveryType ?? "PERCENTAGE") === "PERCENTAGE"
      ? (batasi(nilai, 0, PERSEN_PENUH) / PERSEN_PENUH) * grossProfit
      : Math.max(0, nilai);
  return Math.min(cicilan, batasAtas);
}

const angkaManual = (nilai: number | null | undefined): number | null =>
  nilai === null || nilai === undefined ? null : Number(nilai);

/** Pembagian laba bersih bulan ini; isian manual dibatasi agar total tak melebihi laba. */
function bagiLabaBersih(
  netProfit: number,
  persenOtomatis: number,
  capaian: RabTrackingAchievement | undefined,
) {
  const persenManual = angkaManual(capaian?.manualInvestorProfitSharePercent);
  const persen = batasi(persenManual ?? persenOtomatis, 0, PERSEN_PENUH);
  const investorManual = angkaManual(capaian?.manualInvestorShare);
  const investorShare =
    investorManual !== null ? batasi(investorManual, 0, netProfit) : (persen / PERSEN_PENUH) * netProfit;
  const perusahaanManual = angkaManual(capaian?.manualCompanyShare);
  const companyShare =
    perusahaanManual !== null
      ? batasi(perusahaanManual, 0, netProfit - investorShare)
      : netProfit - investorShare;
  return {
    investorProfitSharePercent: persen,
    investorShare,
    companyShare,
    hasManualInvestorShare: investorManual !== null,
    hasManualCompanyShare: perusahaanManual !== null,
    hasManualInvestorProfitSharePercent: persenManual !== null,
  };
}

/** Bulan ke-n terakhir yang punya capaian aktual (0 bila belum ada). */
function bulanCapaianTerakhir(achievementByMonth: Map<number, RabTrackingAchievement>): number {
  return Math.max(0, ...achievementByMonth.keys());
}

export function buildRABTrackingDataset(
  project: RabTrackingProject,
  actualAchievements: RabTrackingAchievement[] = [],
): RABTrackingDataset {
  const durasi = angkaAtau(project.investmentDurationMonths, DURASI_BAWAAN_BULAN) || DURASI_BAWAAN_BULAN;
  const achievementByMonth = toAchievementMap(actualAchievements);
  const capaianTerakhir = bulanCapaianTerakhir(achievementByMonth);
  // Capaian sesudah durasi tetap dihitung (tidak hilang diam-diam).
  const jumlahBulan = Math.max(durasi, capaianTerakhir);
  const nplTolerancePercent = angkaAtau(project.nplTolerancePercent, 0);
  const projectedOpex = angkaAtau(project.projectedOpex, 0);
  const arpu = angkaAtau(project.arpu, 0);

  const monthlySubsTargets = calculateMonthlySubscribers(
    project.targetSubscribers || 0,
    project.growthType || "LINEAR",
    project.growthSettings || null,
    jumlahBulan,
  );

  const opexGaps = calculateOpexGaps(project, monthlySubsTargets.slice(0, durasi));
  const opexBuffer = calculateOpexBuffer(project, opexGaps);
  const capexTotal = getCapexTotal(project);
  const initialFundingNeed = capexTotal + opexBuffer.funding.investorShare;
  const investorDepositTotal = initialFundingNeed;
  let remainingInvestment = initialFundingNeed;
  let bepMonth: number | null = null;

  let cumulativeGrossRevenue = 0;
  let cumulativeRevenue = 0;
  let cumulativeNplAmount = 0;
  let cumulativeOpex = 0;
  let cumulativeGrossProfit = 0;
  let cumulativeRecoveryInstallment = 0;
  let cumulativeInvestorShare = 0;
  let cumulativeCompanyShare = 0;

  const rows: RABTrackingRow[] = Array.from({ length: jumlahBulan }).map((_, index) => {
    const month = index + 1;
    const targetSubscribers = monthlySubsTargets[index] || 0;
    const billingSubscribers = getBillingSubscribers(project, monthlySubsTargets, index);
    const grossTargetRevenue = billingSubscribers * arpu;
    const projectedRevenue = calculateProjectedRevenue(billingSubscribers, arpu, nplTolerancePercent);
    const actualRecord = achievementByMonth.get(month);
    const actualRevenue = actualRecord ? Number(actualRecord.actualRevenue) : null;
    const isBelumDiisi = !actualRecord && month < capaianTerakhir;

    const displayRevenue = isBelumDiisi ? 0 : (actualRevenue ?? projectedRevenue);
    const nplAmount = isBelumDiisi ? 0 : grossTargetRevenue - projectedRevenue;
    const opexAktual = angkaManual(actualRecord?.actualOpex);
    const opex = isBelumDiisi ? 0 : (opexAktual ?? projectedOpex);
    const grossProfit = displayRevenue - opex;
    const opexGap = opexGaps[index] || 0;

    const sisaSebelum = remainingInvestment;
    const manualCicilan = angkaManual(actualRecord?.manualRecoveryInstallment);
    const recoveryInstallment = isBelumDiisi
      ? 0
      : hitungCicilanModal(project, grossProfit, sisaSebelum, manualCicilan);
    remainingInvestment = sisaSebelum - recoveryInstallment;
    if (bepMonth === null && initialFundingNeed > 0 && sisaSebelum > 0 && remainingInvestment <= 0) {
      bepMonth = month;
    }

    const netProfit = Math.max(0, grossProfit - recoveryInstallment);
    const pembagian = bagiLabaBersih(
      netProfit,
      getInvestorProfitSharePercent(project, sisaSebelum),
      actualRecord,
    );

    cumulativeGrossRevenue += isBelumDiisi ? 0 : grossTargetRevenue;
    cumulativeRevenue += displayRevenue;
    cumulativeNplAmount += nplAmount;
    cumulativeOpex += opex;
    cumulativeGrossProfit += grossProfit;
    cumulativeRecoveryInstallment += recoveryInstallment;
    cumulativeInvestorShare += pembagian.investorShare;
    cumulativeCompanyShare += pembagian.companyShare;

    return {
      month,
      targetSubscribers,
      billingSubscribers,
      grossTargetRevenue,
      projectedRevenue,
      actualRevenue,
      displayRevenue,
      nplAmount,
      opexGap,
      opex,
      grossProfit,
      recoveryInstallment,
      remainingInvestment,
      netProfit,
      investorProfitSharePercent: pembagian.investorProfitSharePercent,
      investorShare: pembagian.investorShare,
      companyShare: pembagian.companyShare,
      isAutoAssumed: !actualRecord,
      isBelumDiisi,
      hasManualRecoveryInstallment: manualCicilan !== null,
      hasManualInvestorShare: pembagian.hasManualInvestorShare,
      hasManualCompanyShare: pembagian.hasManualCompanyShare,
      hasManualInvestorProfitSharePercent: pembagian.hasManualInvestorProfitSharePercent,
      cumulativeRevenue,
      cumulativeNplAmount,
      cumulativeGrossProfit,
      cumulativeRecoveryInstallment,
      cumulativeInvestorShare,
      cumulativeCompanyShare,
    };
  });

  return {
    rows,
    totals: {
      grossRevenue: cumulativeGrossRevenue,
      revenue: cumulativeRevenue,
      nplAmount: cumulativeNplAmount,
      opex: cumulativeOpex,
      grossProfit: cumulativeGrossProfit,
      recoveryInstallment: cumulativeRecoveryInstallment,
      investorShare: cumulativeInvestorShare,
      companyShare: cumulativeCompanyShare,
      remainingInvestment,
      opexBufferBase: opexBuffer.base,
      opexBufferSafety: opexBuffer.safety,
      opexBufferTotal: opexBuffer.total,
      opexBufferInvestorShare: opexBuffer.funding.investorShare,
      opexBufferCompanyShare: opexBuffer.funding.companyShare,
      opexBufferDurationMonths: opexBuffer.coveredMonths.length,
      opexBufferCoveredMonths: opexBuffer.coveredMonths,
      opexBufferDurationLabel: opexBuffer.durationLabel,
      initialFundingNeed,
      investorDepositTotal,
      investorTotalReceived: cumulativeRecoveryInstallment + cumulativeInvestorShare,
      companyTotalReceived: cumulativeCompanyShare,
      bepMonth,
    },
  };
}
