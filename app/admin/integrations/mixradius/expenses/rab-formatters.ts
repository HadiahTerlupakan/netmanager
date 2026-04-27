import type {
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABItem,
  RABProject,
} from "./rabTypes";

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
    const investorShare = project.investorProfitSharePercent || 50;
    return [
      ["Skema Bagi Hasil", "Tetap"],
      ["Bagi Hasil Investor", `${investorShare}%`],
      ["Bagi Hasil Perusahaan", `${100 - investorShare}%`],
    ];
  }

  return [
    ["Skema Bagi Hasil", "Bertahap Setelah Balik Modal"],
    [
      "Investor Sebelum Balik Modal",
      `${project.investorProfitShareBeforeBepPercent || 80}%`,
    ],
    [
      "Investor Setelah Balik Modal",
      `${project.investorProfitShareAfterBepPercent || 60}%`,
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
      project.investorProfitShareBeforeBepPercent || 80,
    ],
    [
      "Investor Share Setelah Balik Modal (%)",
      project.investorProfitShareAfterBepPercent || 60,
    ],
  ];
}

/** Returns sentence-form profit-share description for RAB detail. */
export function formatRabProfitShareDescription(project: RABProject) {
  if (project.investorProfitShareMode !== "TIERED_AFTER_BEP") {
    const investorShare = project.investorProfitSharePercent || 50;
    return `${investorShare}% investor / ${100 - investorShare}% perusahaan`;
  }

  return `${project.investorProfitShareBeforeBepPercent || 80}% sebelum balik modal, ${project.investorProfitShareAfterBepPercent || 60}% setelah balik modal`;
}

/** Returns compact profit-share description for comparison tables. */
export function formatRabCompactProfitShare(project: RABProject) {
  if (project.investorProfitShareMode !== "TIERED_AFTER_BEP") {
    const investorShare = project.investorProfitSharePercent || 50;
    return `${investorShare}% : ${100 - investorShare}%`;
  }

  return `${project.investorProfitShareBeforeBepPercent || 80}% pra-BEP, ${project.investorProfitShareAfterBepPercent || 60}% pasca-BEP`;
}
