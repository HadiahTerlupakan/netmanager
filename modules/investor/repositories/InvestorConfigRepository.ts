import { prisma } from "@/lib/prisma";
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

export class InvestorConfigRepository {
  /** Mengambil config berdasarkan investorId. */
  async findByInvestorId(investorId: string) {
    return prisma.investorConfig.findUnique({ where: { investorId } });
  }

  /** Upsert config investor. */
  async upsert(investorId: string, data: UpsertConfigInput) {
    return prisma.investorConfig.upsert({
      where: { investorId },
      create: {
        investorId,
        shareMode: data.shareMode,
        fixedSharePercent: data.fixedSharePercent,
        periodType: data.periodType,
        isActive: data.isActive,
        tenantId: data.tenantId,
      },
      update: {
        shareMode: data.shareMode,
        fixedSharePercent: data.fixedSharePercent,
        periodType: data.periodType,
        isActive: data.isActive,
      },
    });
  }

  /** Mengambil semua config aktif dalam tenant. */
  async listActive(tenantId: string) {
    return prisma.investorConfig.findMany({
      where: { tenantId, isActive: true },
      include: {
        investor: { select: { id: true, namaLengkap: true, perusahaan: true } },
      },
    });
  }
}
