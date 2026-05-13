export type OvertimeVariant = "Normal" | "Holiday" | "National";

export type OvertimeCalcType =
  | "PER_HOUR"
  | "DAILY_SALARY"
  | "FIXED"
  | "PERCENTAGE";

export type OvertimeConfig = {
  key: OvertimeVariant;
  label: string;
  color: "indigo" | "amber" | "rose";
  calcTypeKey: `overtimeCalcType${OvertimeVariant}`;
  rateKey: `overtimeRate${OvertimeVariant}`;
};

export const OVERTIME_CONFIGS: readonly OvertimeConfig[] = [
  {
    key: "Normal",
    label: "Hari Kerja",
    color: "indigo",
    calcTypeKey: "overtimeCalcTypeNormal",
    rateKey: "overtimeRateNormal",
  },
  {
    key: "Holiday",
    label: "Hari Libur",
    color: "amber",
    calcTypeKey: "overtimeCalcTypeHoliday",
    rateKey: "overtimeRateHoliday",
  },
  {
    key: "National",
    label: "Libur Nas.",
    color: "rose",
    calcTypeKey: "overtimeCalcTypeNational",
    rateKey: "overtimeRateNational",
  },
] as const;

/**
 * Pemetaan statis kelas Tailwind per varian lembur.
 * Hindari interpolasi kelas runtime agar JIT bisa men-scan kelas dengan benar.
 */
export const OVERTIME_COLOR_CLASSES: Record<
  OvertimeConfig["color"],
  { border: string; text: string; textDark: string }
> = {
  indigo: {
    border: "border-indigo-100 dark:border-indigo-900/20",
    text: "text-indigo-700",
    textDark: "dark:text-indigo-400",
  },
  amber: {
    border: "border-amber-100 dark:border-amber-900/20",
    text: "text-amber-700",
    textDark: "dark:text-amber-400",
  },
  rose: {
    border: "border-rose-100 dark:border-rose-900/20",
    text: "text-rose-700",
    textDark: "dark:text-rose-400",
  },
};

export const OVERTIME_CALC_TYPE_OPTIONS: ReadonlyArray<{
  value: OvertimeCalcType;
  label: string;
}> = [
  { value: "PER_HOUR", label: "Per Jam" },
  { value: "DAILY_SALARY", label: "Gaji Harian" },
  { value: "FIXED", label: "Tetap (Rp)" },
  { value: "PERCENTAGE", label: "% Gaji Pokok" },
];
