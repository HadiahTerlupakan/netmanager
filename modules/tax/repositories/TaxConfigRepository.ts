import { prisma } from "@/lib/prisma";
import type { TaxConfig } from "../domain/entities/TaxConfig";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";

/** Maps Prisma TaxConfig row to domain entity (Decimal → number) */
function toDomain(row: {
  id: string;
  tenantId: string;
  npwp: string | null;
  companyName: string | null;
  isPkp: boolean;
  ppnRate: unknown;
  ppnIncluded: boolean;
  pph23RateJasa: unknown;
  pph23RateSewa: unknown;
  pph4Rate: unknown;
  bhpRate: unknown;
  usoRate: unknown;
  ksoRate: unknown;
  ppnDueDay: number;
  pph21DueDay: number;
  pph23DueDay: number;
  bhpDueMonth: number;
  createdAt: Date;
  updatedAt: Date;
}): TaxConfig {
  return {
    id: row.id,
    tenantId: row.tenantId,
    npwp: row.npwp,
    companyName: row.companyName,
    isPkp: row.isPkp,
    ppnRate: Number(row.ppnRate),
    ppnIncluded: row.ppnIncluded,
    pph23RateJasa: Number(row.pph23RateJasa),
    pph23RateSewa: Number(row.pph23RateSewa),
    pph4Rate: Number(row.pph4Rate),
    bhpRate: Number(row.bhpRate),
    usoRate: Number(row.usoRate),
    ksoRate: Number(row.ksoRate),
    ppnDueDay: row.ppnDueDay,
    pph21DueDay: row.pph21DueDay,
    pph23DueDay: row.pph23DueDay,
    bhpDueMonth: row.bhpDueMonth,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TaxConfigRepository implements ITaxConfigRepository {
  async findByTenantId(tenantId: string): Promise<TaxConfig | null> {
    const row = await prisma.taxConfig.findUnique({ where: { tenantId } });
    return row ? toDomain(row) : null;
  }

  async findAllTenantIds(): Promise<string[]> {
    const rows = await prisma.taxConfig.findMany({
      select: { tenantId: true },
    });
    return rows.map((r) => r.tenantId);
  }

  async upsert(
    tenantId: string,
    data: Partial<
      Omit<TaxConfig, "id" | "tenantId" | "createdAt" | "updatedAt">
    >,
  ): Promise<TaxConfig> {
    const row = await prisma.taxConfig.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });
    return toDomain(row);
  }
}
