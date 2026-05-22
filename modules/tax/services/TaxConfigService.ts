import { prisma } from "@/lib/prisma";
import type { TaxConfig } from "../domain/entities/TaxConfig";
import { DEFAULT_TAX_CONFIG } from "../domain/entities/TaxConfig";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";

const TRACKED_FIELDS = [
  "ppnRate",
  "ppnIncluded",
  "isPkp",
  "pph23RateJasa",
  "pph23RateSewa",
  "pph4Rate",
  "bhpRate",
  "usoRate",
  "ksoRate",
  "ppnDueDay",
  "pph21DueDay",
  "pph23DueDay",
  "bhpDueMonth",
] as const;

export class TaxConfigService {
  constructor(private readonly configRepo: ITaxConfigRepository) {}

  async getConfig(tenantId: string): Promise<TaxConfig> {
    const existing = await this.configRepo.findByTenantId(tenantId);
    if (existing) return existing;

    return {
      id: "",
      tenantId,
      ...DEFAULT_TAX_CONFIG,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateConfig(
    tenantId: string,
    data: Partial<
      Omit<TaxConfig, "id" | "tenantId" | "createdAt" | "updatedAt">
    >,
    changedById: string,
  ): Promise<TaxConfig> {
    const current = await this.getConfig(tenantId);

    const changes: {
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }[] = [];
    for (const field of TRACKED_FIELDS) {
      if (field in data) {
        const oldVal = String(current[field] ?? "");
        const newVal = String((data as Record<string, unknown>)[field] ?? "");
        if (oldVal !== newVal) {
          changes.push({ field, oldValue: oldVal, newValue: newVal });
        }
      }
    }

    const result = await this.configRepo.upsert(tenantId, data);

    if (changes.length > 0) {
      await prisma.taxConfigHistory.createMany({
        data: changes.map((c) => ({
          tenantId,
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          changedById,
        })),
      });
    }

    return result;
  }

  async getHistory(tenantId: string, limit = 50) {
    return prisma.taxConfigHistory.findMany({
      where: { tenantId },
      orderBy: { changedAt: "desc" },
      take: limit,
    });
  }
}
