import { prisma } from "@/lib/prisma";
import type {
  CreateTaxRateConfigInput,
  TaxRateCategoryValue,
  TaxRateConfig,
  UpdateTaxRateConfigInput,
} from "../domain/entities/TaxRateConfig";
import type { ITaxRateConfigRepository } from "../domain/ports/ITaxRateConfigRepository";

interface TaxRateConfigRow {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: string;
  rate: unknown;
  dueDay: number | null;
  dueMonth: number | null;
  isActive: boolean;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(row: TaxRateConfigRow): TaxRateConfig {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    category: row.category as TaxRateCategoryValue,
    rate: Number(row.rate),
    dueDay: row.dueDay,
    dueMonth: row.dueMonth,
    isActive: row.isActive,
    description: row.description,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class TaxRateConfigRepository implements ITaxRateConfigRepository {
  async listByTenant(tenantId: string): Promise<TaxRateConfig[]> {
    const rows = await prisma.taxRateConfig.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return rows.map(toDomain);
  }

  async findById(id: string, tenantId: string): Promise<TaxRateConfig | null> {
    const row = await prisma.taxRateConfig.findFirst({
      where: { id, tenantId },
    });
    return row ? toDomain(row) : null;
  }

  async findByCode(
    tenantId: string,
    code: string,
  ): Promise<TaxRateConfig | null> {
    const row = await prisma.taxRateConfig.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    return row ? toDomain(row) : null;
  }

  async create(
    tenantId: string,
    input: CreateTaxRateConfigInput,
  ): Promise<TaxRateConfig> {
    const row = await prisma.taxRateConfig.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        category: input.category,
        rate: input.rate,
        dueDay: input.dueDay ?? null,
        dueMonth: input.dueMonth ?? null,
        isActive: input.isActive ?? true,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return toDomain(row);
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateTaxRateConfigInput,
  ): Promise<TaxRateConfig> {
    const existing = await prisma.taxRateConfig.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error("NOT_FOUND: Tarif pajak tidak ditemukan");
    }

    const row = await prisma.taxRateConfig.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.rate !== undefined && { rate: input.rate }),
        ...(input.dueDay !== undefined && { dueDay: input.dueDay }),
        ...(input.dueMonth !== undefined && { dueMonth: input.dueMonth }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });
    return toDomain(row);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await prisma.taxRateConfig.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new Error("NOT_FOUND: Tarif pajak tidak ditemukan");
    }
    await prisma.taxRateConfig.delete({ where: { id } });
  }
}
