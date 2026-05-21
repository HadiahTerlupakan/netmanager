export const EmployeeType = {
  PKWTT: "PKWTT",
  PKWT: "PKWT",
  DAILY: "DAILY",
  FREELANCE: "FREELANCE",
} as const;

export type EmployeeType = (typeof EmployeeType)[keyof typeof EmployeeType];
