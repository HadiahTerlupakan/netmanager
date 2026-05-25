import { prisma } from "@/lib/prisma";
import type { TaxConfig } from "../domain/entities/TaxConfig";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";

/** Maps Prisma TaxConfig row to domain entity */
function toDomain(row: {
  id: string;
  tenantId: string;
  npwp: string | null;
  companyName: string | null;
  isPkp: boolean;
  ppnIncluded: boolean;
  createdAt: Date;
  updatedAt: Date;
}): TaxConfig {
  return {
    id: row.id,
    tenantId: row.tenantId,
    npwp: row.npwp,
    companyName: row.companyName,
    isPkp: row.isPkp,
    ppnIncluded: row.ppnIncluded,
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
