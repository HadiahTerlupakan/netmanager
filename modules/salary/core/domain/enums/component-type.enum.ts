export const ComponentCategory = {
  EARNING: "EARNING",
  DEDUCTION: "DEDUCTION",
  TAX: "TAX",
  EMPLOYER_COST: "EMPLOYER_COST",
} as const;

export type ComponentCategory =
  (typeof ComponentCategory)[keyof typeof ComponentCategory];

export const ComponentCalculationType = {
  FIXED: "FIXED",
  PERCENTAGE: "PERCENTAGE",
  FORMULA: "FORMULA",
  PER_HOUR: "PER_HOUR",
  PER_DAY: "PER_DAY",
  PER_UNIT: "PER_UNIT",
} as const;

export type ComponentCalculationType =
  (typeof ComponentCalculationType)[keyof typeof ComponentCalculationType];
