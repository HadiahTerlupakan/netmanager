import type { IResellerRepository } from "../domain/ports/IResellerRepository";
import type { IResellerStatusHistoryRepository } from "../domain/ports/IResellerStatusHistoryRepository";
import type { ResellerStatusHistoryDTO } from "../dto/reseller.dto";
import { ResellerMapper } from "../mappers/ResellerMapper";
import { ResellerRepository } from "../repositories/ResellerRepository";
import { ResellerStatusHistoryRepository } from "../repositories/ResellerStatusHistoryRepository";

/** Riwayat status kemitraan reseller untuk audit kepatuhan. */
export class ResellerStatusHistoryService {
  constructor(
    private readonly resellers: IResellerRepository = new ResellerRepository(),
    private readonly history: IResellerStatusHistoryRepository = new ResellerStatusHistoryRepository(),
  ) {}

  /**
   * Riwayat status satu reseller, terbaru lebih dulu. `null` bila reseller
   * tidak ada di tenant ini, agar route menjawab 404 alih-alih daftar kosong.
   */
  async listStatusHistory(params: {
    readonly tenantId: string;
    readonly resellerId: string;
    readonly page: number;
    readonly limit: number;
  }): Promise<{
    readonly items: readonly ResellerStatusHistoryDTO[];
    readonly total: number;
  } | null> {
    const reseller = await this.resellers.findById(
      params.tenantId,
      params.resellerId,
    );
    if (!reseller) return null;
    const result = await this.history.findByResellerId({
      tenantId: params.tenantId,
      resellerId: params.resellerId,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    });
    return {
      items: result.items.map((item) =>
        ResellerMapper.toStatusHistoryDTO(item),
      ),
      total: result.total,
    };
  }
}

let resellerStatusHistoryService: ResellerStatusHistoryService | null = null;

/** Get singleton reseller status history service. */
export function getResellerStatusHistoryService(): ResellerStatusHistoryService {
  if (!resellerStatusHistoryService) {
    resellerStatusHistoryService = new ResellerStatusHistoryService();
  }
  return resellerStatusHistoryService;
}
