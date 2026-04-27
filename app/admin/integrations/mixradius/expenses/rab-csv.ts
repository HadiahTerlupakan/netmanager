import {
  calculateRabUnitCosts,
  getRabTargetBasisLabel,
  type RabTargetBasis,
} from "@/modules/finance/client";
import { escapeCsvCell } from "@/lib/csv";
import { formatCurrency } from "@/lib/utils";

import { calculateRealisticBEP } from "./rabCalculations";
import { buildRABTrackingDataset } from "./rabTracking";
import {
  formatRabGrowthModelDescription,
  formatRabItemCategory,
  formatRabProfitShareCsvRows,
} from "./rab-formatters";
import type { RABProject } from "./rabTypes";

export function buildRABCsvContent(project: RABProject): string {
  const itemHeaders = [
    "Nama Item",
    "Kategori",
    "Tipe",
    "Kuantitas",
    "Harga Satuan",
    "Total Harga",
  ];
  const itemRows = project.items.map((item) =>
    [
      escapeCsvCell(item.name),
      escapeCsvCell(formatRabItemCategory(item)),
      escapeCsvCell(item.expenseType || "CAPEX"),
      escapeCsvCell(item.quantity),
      escapeCsvCell(item.unitPrice),
      escapeCsvCell(item.totalPrice),
    ].join(","),
  );

  const { bepMonth, monthsToFullCapacity } = calculateRealisticBEP(project);
  const trackingDataset = buildRABTrackingDataset(
    project,
    project.actualAchievements || [],
  );
  const { totals } = trackingDataset;
  const monthlyOpex = Number(project.projectedOpex || 0);
  const targetBasis = project.targetBasis || "HOMECONNECT";
  const capexTotal = project.items
    .filter((item) => item.expenseType !== "OPEX")
    .reduce((total, item) => total + Number(item.totalPrice || 0), 0);
  const unitCosts = calculateRabUnitCosts({
    totalCapex: capexTotal,
    targetHomepass: project.targetHomepass,
    targetSubscribers: project.targetSubscribers,
  });

  const rows = [
    [`Proyek: ${project.name}`],
    [`Status: ${project.status}`],
    ["Basis Target", getRabTargetBasisLabel(targetBasis as RabTargetBasis)],
    ...(targetBasis === "HOMEPASS"
      ? [
          ["Target Homepass", project.targetHomepass || 0],
          ["Estimasi Take-up Rate (%)", project.targetTakeUpRatePercent || 0],
          ["Target Homeconnect Revenue", project.targetSubscribers || 0],
          ["Biaya per Homepass", unitCosts.costPerHomepass],
          [
            "Biaya per Homeconnect Revenue",
            unitCosts.costPerHomeconnectRevenue,
          ],
        ]
      : [["Target Pelanggan", project.targetSubscribers || 0]]),
    [`Model Pertumbuhan: ${formatRabGrowthModelDescription(project)}`],
    [`ARPU: ${project.arpu || 0}`],
    [`Kapasitas Penuh (Bulan Ke-): ${monthsToFullCapacity || "T/A"}`],
    [
      `Estimasi Pengembalian CAPEX Keseluruhan: ${bepMonth === Infinity ? "Tidak Terhingga" : `${bepMonth} Bulan`}`,
    ],
    [
      `Recovery: ${project.investmentRecoveryType === "PERCENTAGE" ? `${project.investmentRecoveryValue}% dari Profit/Bulan` : `${formatCurrency(project.investmentRecoveryValue || 0)}/Bulan`}`,
    ],
    [`Durasi Kontrak: ${project.investmentDurationMonths || 12} Bulan`],
    ...formatRabProfitShareCsvRows(project),
    ["Total Setoran Investor", totals.investorDepositTotal],
    [],
    ["BUFFER OPEX RAMP-UP"],
    ["Gap OPEX Dasar", totals.opexBufferBase],
    ["Safety Margin Buffer", totals.opexBufferSafety],
    ["Total Buffer OPEX", totals.opexBufferTotal],
    ["Durasi Buffer Otomatis", totals.opexBufferDurationLabel],
    ["Porsi Investor", totals.opexBufferInvestorShare],
    ["Porsi Perusahaan", totals.opexBufferCompanyShare],
    ["Total Dana Investor Direcovery", totals.initialFundingNeed],
    [],
    [
      "Bulan ke",
      "Gross Revenue",
      "Potensi NPL",
      "Net Revenue",
      "OPEX",
      "Profit Kotor",
      "Angsuran Modal",
      "Sisa Investasi",
      "Investor Share",
      "Company Share",
    ],
    ...trackingDataset.rows.map((row) => [
      row.month,
      row.grossTargetRevenue,
      row.nplAmount,
      row.displayRevenue,
      monthlyOpex,
      row.grossProfit,
      row.recoveryInstallment,
      Math.max(0, row.remainingInvestment),
      row.investorShare,
      row.companyShare,
    ]),
    [
      "TOTAL AKUMULASI",
      totals.grossRevenue,
      totals.nplAmount,
      totals.revenue,
      totals.opex,
      totals.grossProfit,
      totals.recoveryInstallment,
      "",
      totals.investorShare,
      totals.companyShare,
    ],
    [
      "TOTAL DITERIMA INVESTOR (Modal+Profit)",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      totals.investorTotalReceived,
      "",
    ],
    [
      "TOTAL DITERIMA PERUSAHAAN (Profit)",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      totals.companyTotalReceived,
    ],
    [],
    ["DAFTAR ITEM"],
    itemHeaders,
  ];

  return [
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
    ...itemRows,
  ].join("\n");
}
