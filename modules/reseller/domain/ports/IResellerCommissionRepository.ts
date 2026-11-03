import type {
  ResellerCommissionEntity,
  ResellerCommissionRuleEntity,
  ResellerCommissionSummaryEntity,
  ResellerCommissionTypeValue,
  ResellerCustomerCommissionContext,
  ResellerSettlementEntity,
} from "../entities/ResellerCommissionEntity";

export interface CreateCommissionData {
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
  readonly period: string;
  readonly accruedAt: Date;
}

export interface CreateSettlementData {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly notes: string | null;
}

export interface CommissionListParams {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly period?: string;
  readonly skip?: number;
  readonly take?: number;
}

export interface SettlementListParams {
  readonly tenantId: string | null;
  readonly resellerId?: string;
  readonly skip?: number;
  readonly take?: number;
}

/**
 * Hasil upaya settlement. `empty`: tidak ada komisi ACCRUED di periode itu.
 * `conflict`: sebagian komisi sudah diambil settlement lain yang berjalan
 * bersamaan, sehingga transaksi dibatalkan seluruhnya.
 */
export type SettlementOutcome =
  | { readonly kind: "settled"; readonly settlement: ResellerSettlementEntity }
  | { readonly kind: "empty" }
  | { readonly kind: "conflict" };

export interface IResellerCommissionRepository {
  /**
   * Find customer reseller context for commission accrual. `tenantId` null
   * berarti tenant belum diketahui (event tanpa tenantId): pelanggan dicari
   * berdasarkan id saja dan tenant-nya dipakai untuk langkah berikutnya.
   */
  findCustomerContext(
    tenantId: string | null,
    pelangganId: string,
  ): Promise<ResellerCustomerCommissionContext | null>;
  /** Resolve active commission rule for reseller and package. */
  findActiveCommissionRule(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly hargaPaketId: string | null;
    readonly at: Date;
  }): Promise<ResellerCommissionRuleEntity | null>;
  /**
   * Find commission by invoice id for idempotency, termasuk yang sudah
   * di-soft-delete: unique (tenantId, invoiceId) juga mencakup baris itu.
   */
  findCommissionByInvoiceId(
    tenantId: string | null,
    invoiceId: string,
  ): Promise<ResellerCommissionEntity | null>;
  /**
   * Create accrued commission; null bila invoice itu sudah punya komisi.
   * Cek-dan-insert diserialkan per invoice, karena unique (tenantId,
   * invoiceId) tidak menahan duplikat ketika tenantId NULL.
   */
  createCommission(
    data: CreateCommissionData,
  ): Promise<ResellerCommissionEntity | null>;
  /** Cek reseller ada (belum dihapus) di tenant. */
  resellerExists(tenantId: string | null, resellerId: string): Promise<boolean>;
  /**
   * Soft-delete komisi ACCRUED milik invoice yang tidak lagi lunas (di-void
   * atau pelunasannya ditarik). Idempoten; mengembalikan komisi yang baru
   * dibatalkan oleh panggilan ini (replay mengembalikan daftar kosong).
   */
  cancelAccruedByInvoiceId(params: {
    readonly tenantId: string | null;
    readonly invoiceId: string;
  }): Promise<readonly ResellerCommissionEntity[]>;
  /**
   * Pulihkan komisi ACCRUED yang dibatalkan karena invoice-nya sempat tidak
   * lunas, dengan tanggal akru baru. Null bila tidak ada yang bisa dipulihkan.
   */
  restoreCancelledCommission(params: {
    readonly commissionId: string;
    readonly accruedAt: Date;
    readonly period: string;
  }): Promise<ResellerCommissionEntity | null>;
  /** List commissions for reseller. */
  findCommissions(params: CommissionListParams): Promise<{
    readonly items: readonly ResellerCommissionEntity[];
    readonly total: number;
  }>;
  /**
   * Create settlement and claim accrued commissions atomically: komisi yang
   * sudah diambil settlement lain membatalkan seluruh transaksi.
   */
  createSettlement(data: CreateSettlementData): Promise<SettlementOutcome>;
  /** List settlements. */
  findSettlements(params: SettlementListParams): Promise<{
    readonly items: readonly ResellerSettlementEntity[];
    readonly total: number;
  }>;
  /** Get commission totals for reporting. */
  getCommissionSummary(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly periodStart: Date;
    readonly periodEnd: Date;
  }): Promise<ResellerCommissionSummaryEntity>;
}
