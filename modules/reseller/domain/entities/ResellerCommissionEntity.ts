export type ResellerCommissionTypeValue = "PERCENTAGE" | "FIXED";
export type ResellerCommissionStatusValue = "ACCRUED" | "SETTLED" | "PAID";
export type ResellerSettlementStatusValue = "PENDING" | "APPROVED" | "PAID";

export interface ResellerCommissionRuleEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly hargaPaketId: string | null;
  readonly type: ResellerCommissionTypeValue;
  readonly rate: number | null;
  readonly fixedAmount: number | null;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface ResellerCommissionEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly pelangganId: string;
  readonly invoiceId: string;
  readonly paymentId: string | null;
  readonly commissionRuleId: string;
  readonly type: ResellerCommissionTypeValue;
  readonly rate: number | null;
  readonly baseAmount: number;
  readonly commissionAmount: number;
  readonly status: ResellerCommissionStatusValue;
  readonly period: string;
  readonly settlementId: string | null;
  readonly accruedAt: Date;
  readonly settledAt: Date | null;
  readonly paidAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface ResellerSettlementEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly totalAmount: number;
  readonly commissionCount: number;
  readonly status: ResellerSettlementStatusValue;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly approvedAt: Date | null;
  readonly paidAt: Date | null;
  readonly deletedAt: Date | null;
}

export interface ResellerCustomerCommissionContext {
  readonly tenantId: string | null;
  readonly pelangganId: string;
  readonly resellerId: string | null;
  readonly hargaPaketId: string | null;
}

export interface ResellerCommissionSummaryEntity {
  readonly accruedAmount: number;
  readonly settledAmount: number;
  readonly paidAmount: number;
  readonly commissionCount: number;
}
