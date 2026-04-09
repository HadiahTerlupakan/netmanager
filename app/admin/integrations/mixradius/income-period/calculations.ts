import {
  DUITKU_DEFAULT_FEES,
  normalizePaymentMethod,
} from "@/modules/integrations/constants/DuitkuDefaults";

export type IncomePeriodCalculationRecord = {
  total: string | number;
  seller_fee: string | number;
  payment_method?: string | null;
  payment_type?: string | null;
  method?: string | null;
};

export type IncomePeriodCalculationFeeConfig = Record<
  string,
  {
    type: "FIXED" | "PERCENT";
    value: number;
  }
>;

export type IncomePeriodExpenseItem = {
  amount: string | number;
  depreciation?: string | number;
  category?: string | null;
};

export type IncomePeriodRabItem = {
  totalPrice: string | number;
  expenseType?: "CAPEX" | "OPEX" | null;
};

export type IncomePeriodCumulativeRoiInput = {
  summaryProfit: string | number;
  summarySellerFee: string | number;
  records: IncomePeriodCalculationRecord[];
  feeConfig: IncomePeriodCalculationFeeConfig;
  specificExpenses: IncomePeriodExpenseItem[];
  generalExpenses: IncomePeriodExpenseItem[];
  rabItems: IncomePeriodRabItem[];
  months: number;
  totalGroups: number;
};

export type IncomePeriodCumulativeRoiResult = {
  revenue: number;
  sellerFee: number;
  gatewayFee: number;
  capexFromRab: number;
  capexUmum: number;
  opexAktual: number;
  opexUmum: number;
  opexProyeksi: number;
  depreciation: number;
  totalExpenses: number;
  operatingProfit: number;
};

export type IncomePeriodRoiDisplayMetricsInput = {
  rabItems: IncomePeriodRabItem[];
  totalExpenses: number;
  projectedRevenue: number;
  projectedOpex: number;
  currentProfit: number;
  cumulativeNetIncome: number;
  cumCapexFromRab: number;
  cumCapexUmum: number;
  projectMonthsElapsed: number;
};

export type IncomePeriodRoiDisplayMetricsResult = {
  totalOpexItems: number;
  totalCapex: number;
  roiPercent: number;
  bepReached: boolean;
  bepProgress: number;
  revenueProgressPercent: number;
  revenueProgressWidth: number;
  opexStatus: "under" | "over";
  opexVariancePercent: number;
  estimatedBepMonthsRemaining: number | null;
};

export type IncomePeriodSelectedPeriodMetricsInput = {
  summaryProfit: string | number;
  totalRecords: number;
  targetSubscribers?: number | null;
  rabItems: IncomePeriodRabItem[];
};

export type IncomePeriodSelectedPeriodMetricsResult = {
  currentProfit: number;
  capexItemCount: number;
  targetSubscribersProgressPercent: number;
  targetSubscribersProgressWidth: number;
  targetSubscribersProgressTone: "low" | "mid" | "full";
};

export type IncomePeriodExpenseAllocationInput = {
  specificExpenses: IncomePeriodExpenseItem[];
  generalExpenses: IncomePeriodExpenseItem[];
  siteTransactions: string | number | null;
  globalTransactions: string | number | null;
  siteRevenue: string | number | null;
  globalRevenue: string | number | null;
  totalGroups: number;
};

export const parseIncomePeriodNumber = (val: string | number): number => {
  if (typeof val === "number") return val;
  if (!val) return 0;

  let str = String(val).trim();
  str = str.replace(/Rp\.?\s?/i, "");

  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
    str = str.replace(/\./g, "");
  }

  return parseFloat(str) || 0;
};

const sumExpenseItems = (items: IncomePeriodExpenseItem[]) => {
  return items.reduce((sum, item) => {
    return sum + Number(item.amount) + Number(item.depreciation || 0);
  }, 0);
};

const calculateConfiguredFee = (
  rawTotal: number,
  config: { type: "FIXED" | "PERCENT"; value: number },
) => {
  if (config.type === "FIXED") return config.value;
  return Number((rawTotal * (config.value / 100)).toFixed(2));
};

const isOnlinePaymentMethod = (method: string, paymentType?: string | null) =>
  method.toLowerCase().includes("dtk") ||
  method.toLowerCase().includes("tripay") ||
  method.toLowerCase().includes("midtrans") ||
  method.toLowerCase().includes("xendit") ||
  paymentType?.toLowerCase() === "online";

const allocateGeneralExpenses = (
  generalTotal: number,
  totalGroups: number,
  siteTransactions: string | number | null,
  globalTransactions: string | number | null,
  siteRevenue: string | number | null,
  globalRevenue: string | number | null,
) => {
  const parsedGlobalTransactions = parseIncomePeriodNumber(
    globalTransactions ?? 0,
  );
  const parsedSiteTransactions = parseIncomePeriodNumber(siteTransactions ?? 0);
  const parsedGlobalRevenue = parseIncomePeriodNumber(globalRevenue ?? 0);
  const parsedSiteRevenue = parseIncomePeriodNumber(siteRevenue ?? 0);

  if (parsedGlobalTransactions > 0 || parsedGlobalRevenue > 0) {
    const trxRatio =
      parsedGlobalTransactions > 0
        ? parsedSiteTransactions / parsedGlobalTransactions
        : 0;
    const revRatio =
      parsedGlobalRevenue > 0 ? parsedSiteRevenue / parsedGlobalRevenue : 0;
    const weight = (trxRatio + revRatio) / 2;
    return Number((generalTotal * weight).toFixed(2));
  }

  return generalTotal / (totalGroups || 1);
};

export const calculateIncomePeriodExpenseAllocation = ({
  specificExpenses,
  generalExpenses,
  siteTransactions,
  globalTransactions,
  siteRevenue,
  globalRevenue,
  totalGroups,
}: IncomePeriodExpenseAllocationInput) => {
  const specificTotal = sumExpenseItems(specificExpenses);
  const generalTotal = sumExpenseItems(generalExpenses);
  const allocatedExpenses = allocateGeneralExpenses(
    generalTotal,
    totalGroups,
    siteTransactions,
    globalTransactions,
    siteRevenue,
    globalRevenue,
  );

  return {
    specificExpenses: specificTotal,
    allocatedExpenses,
    totalExpenses: specificTotal + allocatedExpenses,
  };
};

export const calculateAllSiteExpenses = (
  expenses: IncomePeriodExpenseItem[],
) => {
  const totalExpenses = sumExpenseItems(expenses);
  return {
    specificExpenses: totalExpenses,
    allocatedExpenses: 0,
    totalExpenses,
  };
};

const splitExpensesByCategory = (items: IncomePeriodExpenseItem[]) => {
  return items.reduce(
    (acc, item) => {
      const amount = Number(item.amount);
      const depreciation = Number(item.depreciation || 0);

      if (item.category === "CAPEX") {
        acc.capex += amount;
      } else {
        acc.opex += amount;
      }

      acc.depreciation += depreciation;
      return acc;
    },
    {
      opex: 0,
      capex: 0,
      depreciation: 0,
    },
  );
};

export const calculateIncomePeriodCumulativeRoi = ({
  summaryProfit,
  summarySellerFee,
  records,
  feeConfig,
  specificExpenses,
  generalExpenses,
  rabItems,
  months,
  totalGroups,
}: IncomePeriodCumulativeRoiInput): IncomePeriodCumulativeRoiResult => {
  const revenue = parseIncomePeriodNumber(summaryProfit);
  const sellerFee = parseIncomePeriodNumber(summarySellerFee);
  const { fee: gatewayFee } = calculateIncomePeriodNet(records, feeConfig);

  const specific = splitExpensesByCategory(specificExpenses);
  const general = splitExpensesByCategory(generalExpenses);
  const safeTotalGroups = totalGroups || 1;

  const allocatedGeneralOpex = general.opex / safeTotalGroups;
  const allocatedGeneralCapex = general.capex / safeTotalGroups;
  const allocatedGeneralDepreciation = general.depreciation / safeTotalGroups;

  const capexFromRab = rabItems
    .filter((item) => !item.expenseType || item.expenseType === "CAPEX")
    .reduce((sum, item) => sum + Number(item.totalPrice), 0);

  const capexUmum = specific.capex + allocatedGeneralCapex;

  const monthsForOpex = Math.max(1, months);
  const opexRabPerMonth = rabItems
    .filter((item) => item.expenseType === "OPEX")
    .reduce((sum, item) => sum + Number(item.totalPrice), 0);
  const opexProyeksi = opexRabPerMonth * monthsForOpex;

  const opexAktual = specific.opex + allocatedGeneralOpex;
  const depreciation = specific.depreciation + allocatedGeneralDepreciation;
  const totalExpenses = opexProyeksi + opexAktual + depreciation;
  const operatingProfit = revenue - gatewayFee - totalExpenses;

  return {
    revenue,
    sellerFee,
    gatewayFee,
    capexFromRab,
    capexUmum,
    opexAktual,
    opexUmum: allocatedGeneralOpex,
    opexProyeksi,
    depreciation,
    totalExpenses,
    operatingProfit,
  };
};

export const calculateIncomePeriodRoiDisplayMetrics = ({
  rabItems,
  totalExpenses,
  projectedRevenue,
  projectedOpex,
  currentProfit,
  cumulativeNetIncome,
  cumCapexFromRab,
  cumCapexUmum,
  projectMonthsElapsed,
}: IncomePeriodRoiDisplayMetricsInput): IncomePeriodRoiDisplayMetricsResult => {
  const totalOpexItems = rabItems
    .filter((item) => item.expenseType === "OPEX")
    .reduce((sum, item) => sum + Number(item.totalPrice), 0);

  const totalCapex = cumCapexFromRab + cumCapexUmum;
  const roiPercent =
    totalCapex > 0
      ? ((cumulativeNetIncome - totalCapex) / totalCapex) * 100
      : 0;
  const bepReached = cumulativeNetIncome >= totalCapex;
  const bepProgress =
    totalCapex > 0
      ? Math.min((cumulativeNetIncome / totalCapex) * 100, 100)
      : 0;
  const revenueProgressPercent =
    projectedRevenue > 0 ? (currentProfit / projectedRevenue) * 100 : 0;
  const revenueProgressWidth = Math.min(revenueProgressPercent, 100);
  const opexStatus = totalExpenses <= projectedOpex ? "under" : "over";
  const opexVariancePercent =
    projectedOpex > 0
      ? Number(
          (opexStatus === "under"
            ? (1 - totalExpenses / projectedOpex) * 100
            : (totalExpenses / projectedOpex - 1) * 100
          ).toFixed(2),
        )
      : 0;

  let estimatedBepMonthsRemaining: number | null = null;
  if (!bepReached && cumulativeNetIncome > 0 && projectMonthsElapsed > 0) {
    estimatedBepMonthsRemaining = Math.ceil(
      totalCapex / (cumulativeNetIncome / projectMonthsElapsed) -
        projectMonthsElapsed,
    );
  }

  return {
    totalOpexItems,
    totalCapex,
    roiPercent,
    bepReached,
    bepProgress: Math.max(bepProgress, 0),
    revenueProgressPercent,
    revenueProgressWidth,
    opexStatus,
    opexVariancePercent,
    estimatedBepMonthsRemaining,
  };
};

export const calculateIncomePeriodSelectedPeriodMetrics = ({
  summaryProfit,
  totalRecords,
  targetSubscribers,
  rabItems,
}: IncomePeriodSelectedPeriodMetricsInput): IncomePeriodSelectedPeriodMetricsResult => {
  const currentProfit = parseIncomePeriodNumber(summaryProfit);
  const capexItemCount = rabItems.filter(
    (item) => !item.expenseType || item.expenseType === "CAPEX",
  ).length;
  const targetSubscribersProgressPercent =
    targetSubscribers && targetSubscribers > 0
      ? (totalRecords / targetSubscribers) * 100
      : 0;
  const targetSubscribersProgressWidth = Math.min(
    targetSubscribersProgressPercent,
    100,
  );

  let targetSubscribersProgressTone: "low" | "mid" | "full" = "low";
  if (targetSubscribersProgressPercent >= 100) {
    targetSubscribersProgressTone = "full";
  } else if (targetSubscribersProgressPercent >= 50) {
    targetSubscribersProgressTone = "mid";
  }

  return {
    currentProfit,
    capexItemCount,
    targetSubscribersProgressPercent,
    targetSubscribersProgressWidth,
    targetSubscribersProgressTone,
  };
};

export const calculateIncomePeriodNet = (
  records: IncomePeriodCalculationRecord[],
  feeConfig: IncomePeriodCalculationFeeConfig,
) => {
  let totalNet = 0;
  let totalFee = 0;

  records.forEach((record) => {
    const rawTotal = parseIncomePeriodNumber(record.total);
    const feeSeller = parseIncomePeriodNumber(record.seller_fee);
    const method = record.payment_method || record.method || "";

    let fee = 0;
    const configKey = Object.keys(feeConfig).find(
      (key) => key.toLowerCase() === method.toLowerCase(),
    );

    if (configKey) {
      fee = calculateConfiguredFee(rawTotal, feeConfig[configKey]);
    } else if (isOnlinePaymentMethod(method, record.payment_type)) {
      const duitkuCode = normalizePaymentMethod(method);
      if (duitkuCode && DUITKU_DEFAULT_FEES[duitkuCode]) {
        fee = calculateConfiguredFee(rawTotal, DUITKU_DEFAULT_FEES[duitkuCode]);
      }
    }

    totalNet += rawTotal - feeSeller - fee;
    totalFee += fee;
  });

  return {
    net: totalNet,
    fee: totalFee,
  };
};
