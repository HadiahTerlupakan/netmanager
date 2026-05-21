export const TaxMethod = {
  NET: "NET",
  GROSS_UP: "GROSS_UP",
  NETT: "NETT",
} as const;

export type TaxMethod = (typeof TaxMethod)[keyof typeof TaxMethod];
