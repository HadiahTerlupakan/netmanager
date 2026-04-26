import { formatCurrency } from "@/lib/utils";

import { calculateRealisticBEP } from "./rabCalculations";
import { buildRABTrackingDataset } from "./rabTracking";
import type {
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABProject,
} from "./rabTypes";

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

function sanitizeCsvString(value: string): string {
  const sanitized = value.replace(/\r?\n/g, " ").trim();

  if (!sanitized) {
    return "";
  }

  if (FORMULA_PREFIXES.includes(sanitized[0])) {
    return `'${sanitized}`;
  }

  return sanitized;
}

function escapeCsvCell(value: string | number): string {
  const serializedValue =
    typeof value === "number" ? String(value) : sanitizeCsvString(value);

  return `"${serializedValue.replace(/"/g, '""')}"`;
}

function getGrowthModelDescription(project: RABProject): string {
  if (project.growthType === "LINEAR") {
    const settings = project.growthSettings as LinearGrowthSettings;
    return `Linear (${settings?.subscribersPerMonth || 0} plg/Bulan)`;
  }

  if (project.growthType === "PERCENTAGE") {
    const settings = project.growthSettings as PercentageGrowthSettings;
    return `Persentase (Awal: ${settings?.initialPercent || 0}%, Naik: ${settings?.monthlyGrowthPercent || 0}%/Bulan)`;
  }

  if (project.growthType === "CUSTOM") {
    return "Kustom (Berdasarkan Target Spesifik Bulan)";
  }

  return "-";
}

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
      escapeCsvCell(
        item.expenseCategory && typeof item.expenseCategory === "object"
          ? item.expenseCategory.parent
            ? `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}`
            : item.expenseCategory.name
          : item.category || "-",
      ),
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

  const rows = [
    [`Proyek: ${project.name}`],
    [`Status: ${project.status}`],
    [`Target Pelanggan: ${project.targetSubscribers || 0}`],
    [`Model Pertumbuhan: ${getGrowthModelDescription(project)}`],
    [`ARPU: ${project.arpu || 0}`],
    [`Kapasitas Penuh (Bulan Ke-): ${monthsToFullCapacity || "T/A"}`],
    [
      `Estimasi Pengembalian CAPEX Keseluruhan: ${bepMonth === Infinity ? "Tidak Terhingga" : `${bepMonth} Bulan`}`,
    ],
    [
      `Recovery: ${project.investmentRecoveryType === "PERCENTAGE" ? `${project.investmentRecoveryValue}% dari Profit/Bulan` : `${formatCurrency(project.investmentRecoveryValue || 0)}/Bulan`}`,
    ],
    [`Durasi Kontrak: ${project.investmentDurationMonths || 12} Bulan`],
    [`Investor Profit Share: ${project.investorProfitSharePercent}%`],
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
