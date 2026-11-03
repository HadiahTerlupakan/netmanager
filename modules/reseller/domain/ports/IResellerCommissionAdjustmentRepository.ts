import type { ResellerCommissionAdjustmentEntity } from "../entities/ResellerCommissionEntity";

export interface AdjustmentListParams {
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly skip?: number;
  readonly take?: number;
}

/** Baca koreksi (clawback) komisi reseller. */
export interface IResellerCommissionAdjustmentRepository {
  /** Koreksi reseller, terbaru dulu, beserta sisanya yang belum dipotongkan. */
  findAdjustments(params: AdjustmentListParams): Promise<{
    readonly items: readonly ResellerCommissionAdjustmentEntity[];
    readonly total: number;
  }>;
}
