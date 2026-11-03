import type { ResellerStatusHistoryEntity } from "../entities/ResellerEntity";

/** Baca riwayat status kemitraan; penulisan ikut transaksi IResellerRepository. */
export interface IResellerStatusHistoryRepository {
  /** Riwayat satu reseller dalam scope tenant, terbaru lebih dulu. */
  findByResellerId(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly skip: number;
    readonly take: number;
  }): Promise<{
    readonly items: readonly ResellerStatusHistoryEntity[];
    readonly total: number;
  }>;
}
