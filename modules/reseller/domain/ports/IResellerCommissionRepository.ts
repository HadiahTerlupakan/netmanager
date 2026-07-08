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

export interface IResellerCommissionRepository {
  /** Find customer reseller context for commission accrual. */
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
  /** Find commission by invoice id for idempotency. */
  findCommissionByInvoiceId(
    tenantId: string | null,
    invoiceId: string,
  ): Promise<ResellerCommissionEntity | null>;
  /** Create accrued commission. */
  createCommission(
    data: CreateCommissionData,
  ): Promise<ResellerCommissionEntity>;
  /** List commissions for reseller. */
  findCommissions(params: CommissionListParams): Promise<{
    readonly items: readonly ResellerCommissionEntity[];
    readonly total: number;
  }>;
  /** Create settlement and attach accrued commissions in one transaction. */
  createSettlement(
    data: CreateSettlementData,
  ): Promise<ResellerSettlementEntity>;
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
