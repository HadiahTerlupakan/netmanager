export const PayFrequency = {
  MONTHLY: "MONTHLY",
  BI_WEEKLY: "BI_WEEKLY",
  WEEKLY: "WEEKLY",
  DAILY: "DAILY",
  ON_DEMAND: "ON_DEMAND",
} as const;

export type PayFrequency = (typeof PayFrequency)[keyof typeof PayFrequency];
