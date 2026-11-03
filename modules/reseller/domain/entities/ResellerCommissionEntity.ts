import type { ResellerStatusValue } from "./ResellerEntity";

export type ResellerCommissionTypeValue = "PERCENTAGE" | "FIXED";
/**
 * REVERSED: komisi yang sudah dibayar lalu ditagih balik (clawback) karena
 * invoice-nya di-void atau pelunasannya ditarik.
 */
export type ResellerCommissionStatusValue =
  | "ACCRUED"
  | "SETTLED"
  | "PAID"
  | "REVERSED";
export type ResellerSettlementStatusValue = "PENDING" | "APPROVED" | "PAID";

export interface ResellerCommissionRuleEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly hargaPaketId: string | null;
  readonly type: ResellerCommissionTypeValue;
  readonly rate: number | null;
  readonly fixedAmount: number | null;
  /** Kolom memakai enum `ResellerStatus`; aturan hanya memakai ACTIVE/INACTIVE. */
  readonly status: ResellerStatusValue;
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
  readonly approvedById: string | null;
  readonly paidById: string | null;
  readonly paymentMethod: string | null;
  readonly paymentReference: string | null;
  /** Rekening Kas & Bank (FinancialAccount) sumber pembayaran. */
  readonly paymentAccountId: string | null;
  /**
   * Koreksi (clawback) yang dipotongkan dari settlement ini. `totalAmount`
   * adalah yang dibayarkan: jumlah komisi dikurangi `adjustmentAmount`.
   */
  readonly adjustmentAmount: number;
  readonly deletedAt: Date | null;
}

/**
 * Koreksi (clawback) satu komisi yang sudah dibayar: reseller berutang
 * `amount`, dipotongkan dari settlement berikutnya. Sisanya
 * (`remainingAmount`) terbawa ke settlement sesudahnya.
 */
export interface ResellerCommissionAdjustmentEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly pelangganId: string;
  readonly invoiceId: string;
  readonly sourceCommissionId: string;
  readonly amount: number;
  readonly reason: string;
  readonly createdAt: Date;
  /** Bagian yang belum dipotongkan dari settlement mana pun. */
  readonly remainingAmount: number;
}

/** Aturan komisi beserta nama paketnya untuk daftar admin. */
export interface ResellerCommissionRuleListItem extends ResellerCommissionRuleEntity {
  readonly hargaPaketName: string | null;
}

export interface ResellerCustomerCommissionContext {
  readonly tenantId: string | null;
  readonly pelangganId: string;
  readonly resellerId: string | null;
  /** Status kemitraan reseller pelanggan; null bila tanpa reseller. */
  readonly resellerStatus: ResellerStatusValue | null;
  /** Kapan status kemitraan terakhir berubah; null bila tak tercatat. */
  readonly resellerStatusChangedAt: Date | null;
  readonly hargaPaketId: string | null;
}

export interface ResellerCommissionSummaryEntity {
  readonly accruedAmount: number;
  readonly settledAmount: number;
  readonly paidAmount: number;
  /** Komisi yang sudah dibayar lalu ditagih balik (REVERSED). */
  readonly reversedAmount: number;
  readonly commissionCount: number;
}
