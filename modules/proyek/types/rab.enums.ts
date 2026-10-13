export const RabExpenseType = {
  CAPEX: "CAPEX",
  OPEX: "OPEX",
} as const;

export type RabExpenseType =
  (typeof RabExpenseType)[keyof typeof RabExpenseType];

export const RabRevisionStatus = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type RabRevisionStatus =
  (typeof RabRevisionStatus)[keyof typeof RabRevisionStatus];

export type RabStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "PENGADAAN"
  | "PENGGELARAN_JARINGAN"
  | "PENJUALAN"
  | "TARGET_TERCAPAI"
  | "SELESAI";
