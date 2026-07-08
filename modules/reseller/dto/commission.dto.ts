import type {
  ResellerCommissionEntity,
  ResellerCommissionSummaryEntity,
  ResellerSettlementEntity,
} from "../domain/entities/ResellerCommissionEntity";

export interface ResellerCommissionDTO {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly pelangganId: string;
  readonly invoiceId: string;
  readonly paymentId: string | null;
  readonly commissionRuleId: string;
  readonly type: "PERCENTAGE" | "FIXED";
  readonly rate: number | null;
  readonly baseAmount: number;
  readonly commissionAmount: number;
  readonly status: "ACCRUED" | "SETTLED" | "PAID";
  readonly period: string;
  readonly settlementId: string | null;
  readonly accruedAt: string;
  readonly settledAt: string | null;
  readonly paidAt: string | null;
}

export interface ResellerSettlementDTO {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly totalAmount: number;
  readonly commissionCount: number;
  readonly status: "PENDING" | "APPROVED" | "PAID";
  readonly notes: string | null;
  readonly createdAt: string;
  readonly approvedAt: string | null;
  readonly paidAt: string | null;
}

export type ResellerCommissionSummaryDTO = ResellerCommissionSummaryEntity;

export function toCommissionDTO(
  entity: ResellerCommissionEntity,
): ResellerCommissionDTO {
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    resellerId: entity.resellerId,
    pelangganId: entity.pelangganId,
    invoiceId: entity.invoiceId,
    paymentId: entity.paymentId,
    commissionRuleId: entity.commissionRuleId,
    type: entity.type,
    rate: entity.rate,
    baseAmount: entity.baseAmount,
    commissionAmount: entity.commissionAmount,
    status: entity.status,
    period: entity.period,
    settlementId: entity.settlementId,
    accruedAt: entity.accruedAt.toISOString(),
    settledAt: entity.settledAt?.toISOString() ?? null,
    paidAt: entity.paidAt?.toISOString() ?? null,
  };
}

export function toSettlementDTO(
  entity: ResellerSettlementEntity,
): ResellerSettlementDTO {
  return {
    id: entity.id,
    tenantId: entity.tenantId,
    resellerId: entity.resellerId,
    periodStart: entity.periodStart.toISOString(),
    periodEnd: entity.periodEnd.toISOString(),
    totalAmount: entity.totalAmount,
    commissionCount: entity.commissionCount,
    status: entity.status,
    notes: entity.notes,
    createdAt: entity.createdAt.toISOString(),
    approvedAt: entity.approvedAt?.toISOString() ?? null,
    paidAt: entity.paidAt?.toISOString() ?? null,
  };
}
