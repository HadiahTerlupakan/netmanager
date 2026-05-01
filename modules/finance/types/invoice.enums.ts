export const InvoiceStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  OVERDUE: "OVERDUE",
  PAID: "PAID",
  PARTIAL_PAID: "PARTIAL_PAID",
  CANCELLED: "CANCELLED",
} as const;

export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

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

export const Status = {
  AKTIF: "AKTIF",
  NONAKTIF: "NONAKTIF",
  MAINTENANCE: "MAINTENANCE",
  ISOLIR: "ISOLIR",
  DISMANTLE: "DISMANTLE",
} as const;

export type Status = (typeof Status)[keyof typeof Status];

export const PaymentMethod = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  E_WALLET: "E_WALLET",
  CREDIT_CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  CHECK: "CHECK",
  OTHER: "OTHER",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const GatewayPaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;

export type GatewayPaymentStatus =
  (typeof GatewayPaymentStatus)[keyof typeof GatewayPaymentStatus];

export type Payment = {
  amount: bigint | number | string;
  paymentMethod: string | null;
};
export type PaymentGatewayConfig = Record<string, unknown>;
export type UnmatchedMutation = Record<string, unknown>;
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
