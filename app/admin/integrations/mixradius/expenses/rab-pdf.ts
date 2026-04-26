import { formatCurrency } from "@/lib/utils";

import { buildRABTrackingDataset } from "./rabTracking";
import type { RABProject } from "./rabTypes";

export function getRABPdfDocumentOptions() {
  return {
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  } as const;
}

export interface RABPdfTrackingTable {
  head: string[][];
  body: string[][];
  foot: string[][];
  totals: {
    grossRevenue: number;
    nplAmount: number;
    netRevenue: number;
    opex: number;
    grossProfit: number;
    recoveryInstallment: number;
    investorShare: number;
    companyShare: number;
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
  };
  fundingSummary: string[][];
}

export function buildRABPdfTrackingTable(
  project: RABProject,
): RABPdfTrackingTable {
  const trackingDataset = buildRABTrackingDataset(
    project,
    project.actualAchievements || [],
  );
  const { totals } = trackingDataset;
  const monthlyOpex = Number(project.projectedOpex || 0);

  return {
    head: [
      [
        "Bulan",
        "Gross Revenue",
        "Potensi NPL",
        "Net Revenue",
        "OPEX",
        "Profit Kotor",
        "Angsuran Modal",
        "Sisa Investasi",
        "Investor",
        "Company",
      ],
    ],
    body: trackingDataset.rows.map((row) => [
      row.month.toString(),
      formatCurrency(row.grossTargetRevenue),
      formatCurrency(row.nplAmount),
      formatCurrency(row.displayRevenue),
      formatCurrency(monthlyOpex),
      formatCurrency(row.grossProfit),
      formatCurrency(row.recoveryInstallment),
      formatCurrency(Math.max(0, row.remainingInvestment)),
      formatCurrency(row.investorShare),
      formatCurrency(row.companyShare),
    ]),
    foot: [
      [
        "TOTAL",
        formatCurrency(totals.grossRevenue),
        formatCurrency(totals.nplAmount),
        formatCurrency(totals.revenue),
        formatCurrency(totals.opex),
        formatCurrency(totals.grossProfit),
        formatCurrency(totals.recoveryInstallment),
        "",
        formatCurrency(totals.investorShare),
        formatCurrency(totals.companyShare),
      ],
    ],
    totals: {
      grossRevenue: totals.grossRevenue,
      nplAmount: totals.nplAmount,
      netRevenue: totals.revenue,
      opex: totals.opex,
      grossProfit: totals.grossProfit,
      recoveryInstallment: totals.recoveryInstallment,
      investorShare: totals.investorShare,
      companyShare: totals.companyShare,
      opexBufferBase: totals.opexBufferBase,
      opexBufferSafety: totals.opexBufferSafety,
      opexBufferTotal: totals.opexBufferTotal,
      opexBufferInvestorShare: totals.opexBufferInvestorShare,
      opexBufferCompanyShare: totals.opexBufferCompanyShare,
      opexBufferDurationMonths: totals.opexBufferDurationMonths,
      opexBufferCoveredMonths: totals.opexBufferCoveredMonths,
      opexBufferDurationLabel: totals.opexBufferDurationLabel,
      initialFundingNeed: totals.initialFundingNeed,
      investorDepositTotal: totals.investorDepositTotal,
    },
    fundingSummary: [
      ["Gap OPEX Dasar", formatCurrency(totals.opexBufferBase)],
      ["Safety Margin Buffer", formatCurrency(totals.opexBufferSafety)],
      ["Total Buffer OPEX", formatCurrency(totals.opexBufferTotal)],
      ["Durasi Buffer Otomatis", totals.opexBufferDurationLabel],
      ["Porsi Investor", formatCurrency(totals.opexBufferInvestorShare)],
      ["Porsi Perusahaan", formatCurrency(totals.opexBufferCompanyShare)],
      [
        "Total Dana Investor Direcovery",
        formatCurrency(totals.initialFundingNeed),
      ],
    ],
  };
}
