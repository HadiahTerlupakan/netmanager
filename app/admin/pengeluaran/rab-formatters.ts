import { PERSEN_BAGI_HASIL_RAB_BAWAAN } from "@/modules/finance/client";

import type {
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABItem,
  RABProject,
} from "./rabTypes";

const PERSEN_PENUH = 100;

/** Formats RAB item category with parent category when available. */
export function formatRabItemCategory(
  item: Pick<RABItem, "category" | "expenseCategory">,
) {
  if (!item.expenseCategory || typeof item.expenseCategory !== "object") {
    return item.category || "-";
  }

  if (item.expenseCategory.parent) {
    return `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}`;
  }

  return item.expenseCategory.name;
}

/** Returns the short label for RAB growth type. */
export function formatRabGrowthTypeLabel(type?: string) {
  if (type === "LINEAR") return "Linear";
  if (type === "PERCENTAGE") return "Persentase";
  if (type === "CUSTOM") return "Kustom";
  return "-";
}

/** Returns the full growth model description used in exports. */
export function formatRabGrowthModelDescription(project: RABProject) {
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

/** Returns compact growth model description for comparison tables. */
export function formatRabCompactGrowthModel(project: RABProject) {
  if (project.growthType === "LINEAR") {
    const settings = project.growthSettings as LinearGrowthSettings;
    return `Linear (${settings?.subscribersPerMonth || 0}/Bln)`;
  }

  if (project.growthType === "PERCENTAGE") {
    const settings = project.growthSettings as PercentageGrowthSettings;
    return `Persentase (Naik ${settings?.monthlyGrowthPercent || 0}%/Bln)`;
  }

  return "Kustom";
}

/** Returns profit-share rows for RAB PDF output. */
export function formatRabProfitSharePdfRows(project: RABProject): string[][] {
  if (project.investorProfitShareMode !== "TIERED_AFTER_BEP") {
    const investorShare =
      project.investorProfitSharePercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.flat;
    return [
      ["Skema Bagi Hasil", "Tetap"],
      ["Bagi Hasil Investor", `${investorShare}%`],
      ["Bagi Hasil Perusahaan", `${PERSEN_PENUH - investorShare}%`],
    ];
  }

  return [
    ["Skema Bagi Hasil", "Bertahap Setelah Balik Modal"],
    [
      "Investor Sebelum Balik Modal",
      `${project.investorProfitShareBeforeBepPercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.sebelumBep}%`,
    ],
    [
      "Investor Setelah Balik Modal",
      `${project.investorProfitShareAfterBepPercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.sesudahBep}%`,
    ],
  ];
}

/** Returns profit-share rows for RAB CSV output. */
export function formatRabProfitShareCsvRows(
  project: RABProject,
): Array<[string, string | number]> {
  if (project.investorProfitShareMode !== "TIERED_AFTER_BEP") {
    return [
      ["Investor Profit Share", `${project.investorProfitSharePercent}%`],
    ];
  }

  return [
    ["Skema Bagi Hasil", "Bertahap Setelah Balik Modal"],
    [
      "Investor Share Sebelum Balik Modal (%)",
      project.investorProfitShareBeforeBepPercent ??
        PERSEN_BAGI_HASIL_RAB_BAWAAN.sebelumBep,
    ],
    [
      "Investor Share Setelah Balik Modal (%)",
      project.investorProfitShareAfterBepPercent ??
        PERSEN_BAGI_HASIL_RAB_BAWAAN.sesudahBep,
    ],
  ];
}

/** Returns sentence-form profit-share description for RAB detail. */
export function formatRabProfitShareDescription(project: RABProject) {
  if (project.investorProfitShareMode !== "TIERED_AFTER_BEP") {
    const investorShare =
      project.investorProfitSharePercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.flat;
    return `${investorShare}% investor / ${PERSEN_PENUH - investorShare}% perusahaan`;
  }

  return `${project.investorProfitShareBeforeBepPercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.sebelumBep}% sebelum balik modal, ${project.investorProfitShareAfterBepPercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.sesudahBep}% setelah balik modal`;
}

/** Returns compact profit-share description for comparison tables. */
export function formatRabCompactProfitShare(project: RABProject) {
  if (project.investorProfitShareMode !== "TIERED_AFTER_BEP") {
    const investorShare =
      project.investorProfitSharePercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.flat;
    return `${investorShare}% : ${PERSEN_PENUH - investorShare}%`;
  }

  return `${project.investorProfitShareBeforeBepPercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.sebelumBep}% pra-BEP, ${project.investorProfitShareAfterBepPercent ?? PERSEN_BAGI_HASIL_RAB_BAWAAN.sesudahBep}% pasca-BEP`;
}
