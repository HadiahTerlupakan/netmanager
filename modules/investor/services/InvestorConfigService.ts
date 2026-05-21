import { InvestorConfigRepository } from "../repositories/InvestorConfigRepository";
import type {
  InvestorShareMode,
  InvestorProfitPeriodType,
} from "@prisma/client";

export interface UpsertConfigInput {
  shareMode: InvestorShareMode;
  fixedSharePercent?: number | null;
  periodType: InvestorProfitPeriodType;
  isActive: boolean;
  tenantId?: string;
}

export class InvestorConfigService {
  constructor(
    private readonly configRepo: InvestorConfigRepository = new InvestorConfigRepository(),
  ) {}

  /** Mengambil config investor. */
  async getConfig(investorId: string) {
    return this.configRepo.findByInvestorId(investorId);
  }

  /** Upsert config investor. */
  async upsertConfig(investorId: string, data: UpsertConfigInput) {
    if (data.shareMode === "FIXED" && !data.fixedSharePercent) {
      throw new Error("fixedSharePercent wajib diisi untuk mode FIXED");
    }
    return this.configRepo.upsert(investorId, data);
  }

  /** Mengambil semua config aktif dalam tenant. */
  async listActive(tenantId: string) {
    return this.configRepo.listActive(tenantId);
  }
}
