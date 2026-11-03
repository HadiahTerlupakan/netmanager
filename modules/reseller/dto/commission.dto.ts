import type {
  ResellerCommissionAdjustmentEntity,
  ResellerCommissionEntity,
  ResellerCommissionRuleEntity,
  ResellerCommissionRuleListItem,
  ResellerCommissionSummaryEntity,
  ResellerSettlementEntity,
} from "../domain/entities/ResellerCommissionEntity";
import type { ResellerMonthlyReport } from "../domain/entities/ResellerReportEntity";

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
  readonly status: "ACCRUED" | "SETTLED" | "PAID" | "REVERSED";
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
  /** Yang dibayarkan: `grossAmount - adjustmentAmount`. */
  readonly totalAmount: number;
  /** Jumlah komisi di settlement sebelum koreksi. */
  readonly grossAmount: number;
  /** Koreksi (clawback) yang dipotongkan. */
  readonly adjustmentAmount: number;
  readonly commissionCount: number;
  readonly status: "PENDING" | "APPROVED" | "PAID";
  readonly notes: string | null;
  readonly createdAt: string;
  readonly approvedAt: string | null;
  readonly paidAt: string | null;
  readonly approvedById: string | null;
  readonly paidById: string | null;
  readonly paymentMethod: string | null;
  readonly paymentReference: string | null;
  readonly paymentAccountId: string | null;
}

/** Koreksi (clawback) komisi yang sudah dibayar. */
export interface ResellerCommissionAdjustmentDTO {
  readonly id: string;
  readonly resellerId: string;
  readonly pelangganId: string;
  readonly invoiceId: string;
  readonly sourceCommissionId: string;
  readonly amount: number;
  /** Bagian yang belum dipotongkan dari settlement. */
  readonly remainingAmount: number;
  readonly reason: string;
  readonly createdAt: string;
}

export interface ResellerCommissionRuleDTO {
  readonly id: string;
  readonly resellerId: string;
  readonly hargaPaketId: string | null;
  /** Nama paket; null untuk aturan semua paket atau respons simpan. */
  readonly hargaPaketName: string | null;
  readonly type: "PERCENTAGE" | "FIXED";
  /** Persen bulat; null untuk aturan nominal. */
  readonly rate: number | null;
  /** Rupiah per invoice lunas; null untuk aturan persen. */
  readonly fixedAmount: number | null;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly startsAt: string;
  readonly endsAt: string | null;
}

export type ResellerCommissionSummaryDTO = ResellerCommissionSummaryEntity;
export type ResellerMonthlyReportDTO = ResellerMonthlyReport;

/** Map aturan komisi ke DTO API. */
export function toCommissionRuleDTO(
  entity: ResellerCommissionRuleEntity | ResellerCommissionRuleListItem,
): ResellerCommissionRuleDTO {
  return {
    id: entity.id,
    resellerId: entity.resellerId,
    hargaPaketId: entity.hargaPaketId,
    hargaPaketName: "hargaPaketName" in entity ? entity.hargaPaketName : null,
    type: entity.type,
    rate: entity.rate,
    fixedAmount: entity.fixedAmount,
    status: entity.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    startsAt: entity.startsAt.toISOString(),
    endsAt: entity.endsAt?.toISOString() ?? null,
  };
}

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
    grossAmount: entity.totalAmount + entity.adjustmentAmount,
    adjustmentAmount: entity.adjustmentAmount,
    commissionCount: entity.commissionCount,
    status: entity.status,
    notes: entity.notes,
    createdAt: entity.createdAt.toISOString(),
    approvedAt: entity.approvedAt?.toISOString() ?? null,
    paidAt: entity.paidAt?.toISOString() ?? null,
    approvedById: entity.approvedById,
    paidById: entity.paidById,
    paymentMethod: entity.paymentMethod,
    paymentReference: entity.paymentReference,
    paymentAccountId: entity.paymentAccountId,
  };
}

/** Map koreksi komisi ke DTO API. */
export function toCommissionAdjustmentDTO(
  entity: ResellerCommissionAdjustmentEntity,
): ResellerCommissionAdjustmentDTO {
  return {
    id: entity.id,
    resellerId: entity.resellerId,
    pelangganId: entity.pelangganId,
    invoiceId: entity.invoiceId,
    sourceCommissionId: entity.sourceCommissionId,
    amount: entity.amount,
    remainingAmount: entity.remainingAmount,
    reason: entity.reason,
    createdAt: entity.createdAt.toISOString(),
  };
}
