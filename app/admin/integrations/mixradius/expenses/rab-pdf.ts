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
  };
}

export function buildRABPdfTrackingTable(
  project: RABProject,
): RABPdfTrackingTable {
  const trackingDataset = buildRABTrackingDataset(
    project,
    project.actualAchievements || [],
  );
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
        formatCurrency(trackingDataset.totals.grossRevenue),
        formatCurrency(trackingDataset.totals.nplAmount),
        formatCurrency(trackingDataset.totals.revenue),
        formatCurrency(trackingDataset.totals.opex),
        formatCurrency(trackingDataset.totals.grossProfit),
        formatCurrency(trackingDataset.totals.recoveryInstallment),
        "",
        formatCurrency(trackingDataset.totals.investorShare),
        formatCurrency(trackingDataset.totals.companyShare),
      ],
    ],
    totals: {
      grossRevenue: trackingDataset.totals.grossRevenue,
      nplAmount: trackingDataset.totals.nplAmount,
      netRevenue: trackingDataset.totals.revenue,
      opex: trackingDataset.totals.opex,
      grossProfit: trackingDataset.totals.grossProfit,
      recoveryInstallment: trackingDataset.totals.recoveryInstallment,
      investorShare: trackingDataset.totals.investorShare,
      companyShare: trackingDataset.totals.companyShare,
    },
  };
}
