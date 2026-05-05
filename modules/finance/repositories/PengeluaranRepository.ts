import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IPengeluaranRepository,
  PengeluaranCreateData,
  PengeluaranUpdateData,
} from "../domain/ports/IPengeluaranRepository";
import type { PengeluaranEntity as PengeluaranPublic } from "../domain/entities/PengeluaranEntity";
import {
  aggregateTotalByWhere,
  buildFilterWhere,
  buildPeriodWhere,
  findBudgetIdForExpense,
  findByIdWithAudit,
  findIdsAndDatesByWhere,
  findManyWithAudit,
  findPeriodSummaries,
  getTenantWhere,
  groupByCategory,
  mapGroupedResults,
  mapIdsAndDates,
  type RawGroupResult,
} from "./pengeluaran.repository-helpers";
import {
  runSafeRepositoryOperation,
  type FinanceMutationDelegate,
} from "./shared/financeMutationRepository";
import {
  assertPengeluaranModelExists,
  buildPengeluaranBudgetLookupWhere,
  buildPengeluaranUpdateData,
  createPengeluaranRecord,
} from "./pengeluaran.repository.helpers";

interface GroupedPengeluaran {
  kategori: string;
  tipePengeluaran: string;
  _sum: { jumlah: number };
  _count: { id: number };
}

type MutationFilterOptions = {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  paymentMethod?: string;
  searchDescription?: string;
};

type GroupedPeriodSummary = { tanggal: Date; jumlah: bigint };

type MutationAction =
  | { type: "update"; data: Record<string, unknown> }
  | { type: "delete" };

export class PengeluaranRepository implements IPengeluaranRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  private get delegate(): FinanceMutationDelegate {
    return (this.client as unknown as Record<string, FinanceMutationDelegate>)
      .pengeluaran;
  }

  private hasModel(): boolean {
    return "pengeluaran" in this.client;
  }

  private async getTenantWhere(): Promise<Record<string, unknown>> {
    return getTenantWhere();
  }

  private async resolveBudgetId(
    data: PengeluaranCreateData,
  ): Promise<string | null> {
    return findBudgetIdForExpense({
      client: this.client as unknown as Record<string, FinanceMutationDelegate>,
      data,
      buildBudgetLookupWhere: buildPengeluaranBudgetLookupWhere,
    });
  }

  private async buildFilterWhere(
    options: MutationFilterOptions,
  ): Promise<Record<string, unknown>> {
    return buildFilterWhere(options);
  }

  private async buildPeriodWhere(
    month?: number,
    year?: number,
  ): Promise<Record<string, unknown>> {
    return buildPeriodWhere(month, year);
  }

  private runSafe<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    return runSafeRepositoryOperation(operation, fallback);
  }

  private async findPublicMany(
    where: Record<string, unknown>,
  ): Promise<PengeluaranPublic[]> {
    return findManyWithAudit(this.delegate, where);
  }

  private async findPublicById(id: string): Promise<PengeluaranPublic | null> {
    const item = await findByIdWithAudit(
      this.delegate,
      id,
      await this.getTenantWhere(),
    );
    return item ? (item as PengeluaranPublic) : null;
  }

  private calculateAggregateTotal(
    where: Record<string, unknown>,
  ): Promise<bigint> {
    return aggregateTotalByWhere(this.delegate, where);
  }

  private async mutateById(id: string, action: MutationAction): Promise<void> {
    const where = { id, ...(await this.getTenantWhere()) };

    if (action.type === "update") {
      const result = await this.delegate.updateMany({
        where,
        data: action.data,
      });

      if (result.count === 0) {
        throw new Error("Record not found or access denied");
      }

      return;
    }

    const result = await this.delegate.deleteMany({ where });

    if (result.count === 0) {
      throw new Error("Record not found or access denied");
    }
  }

  private async resolveFilteredIdsAndDates(
    options: MutationFilterOptions,
  ): Promise<Array<{ id: string; tanggal: Date }>> {
    const items = await findIdsAndDatesByWhere(
      this.delegate,
      await this.buildFilterWhere(options),
    );
    return mapIdsAndDates(
      items as Array<{ id: string; tanggal: Date | string }>,
    );
  }

  private async resolveFilteredRecords(
    options: MutationFilterOptions,
  ): Promise<PengeluaranPublic[]> {
    return this.findPublicMany(await this.buildFilterWhere(options));
  }

  private async resolvePeriodSummaries(): Promise<GroupedPeriodSummary[]> {
    const items = await findPeriodSummaries(
      this.delegate,
      await this.getTenantWhere(),
    );
    return (items as Record<string, unknown>[]).map((item) => ({
      tanggal: item.tanggal as Date,
      jumlah: item.jumlah as bigint,
    }));
  }

  private async resolveGroupedCategoryAndPeriod(
    month?: number,
    year?: number,
  ): Promise<GroupedPengeluaran[]> {
    const items = await groupByCategory(
      this.delegate,
      await this.buildPeriodWhere(month, year),
    );
    return mapGroupedResults((items ?? []) as RawGroupResult[]);
  }

  async findAll(): Promise<PengeluaranPublic[]> {
    if (!this.hasModel()) return [];
    return this.runSafe(
      async () => this.findPublicMany(await this.getTenantWhere()),
      [],
    );
  }

  async findById(id: string): Promise<PengeluaranPublic | null> {
    if (!this.hasModel()) return null;
    return this.runSafe(
      () => this.findPublicById(id),
      null as PengeluaranPublic | null,
    );
  }

  async create(data: PengeluaranCreateData): Promise<{ id: string }> {
    assertPengeluaranModelExists(this.hasModel());
    return createPengeluaranRecord({
      delegate: this.delegate,
      data,
      budgetId: await this.resolveBudgetId(data),
    });
  }

  async update(id: string, data: PengeluaranUpdateData): Promise<void> {
    assertPengeluaranModelExists(this.hasModel());
    await this.mutateById(id, {
      type: "update",
      data: buildPengeluaranUpdateData(data),
    });
  }

  async delete(id: string): Promise<void> {
    assertPengeluaranModelExists(this.hasModel());
    await this.mutateById(id, { type: "delete" });
  }

  async count(): Promise<number> {
    if (!this.hasModel()) return 0;
    return this.runSafe(
      async () => this.delegate.count({ where: await this.getTenantWhere() }),
      0,
    );
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<PengeluaranPublic[]> {
    if (!this.hasModel()) return [];
    return this.runSafe(
      () => this.resolveFilteredRecords({ startDate, endDate }),
      [] as PengeluaranPublic[],
    );
  }

  async findByKategori(kategori: string): Promise<PengeluaranPublic[]> {
    if (!this.hasModel()) return [];
    return this.runSafe(
      () => this.resolveFilteredRecords({ category: kategori }),
      [] as PengeluaranPublic[],
    );
  }

  async aggregateTotal(): Promise<bigint> {
    if (!this.hasModel()) return 0n;
    return this.calculateAggregateTotal(await this.getTenantWhere());
  }

  async aggregateTotalByTipe(
    tipePengeluaran: "CAPEX" | "OPEX",
  ): Promise<bigint> {
    if (!this.hasModel()) return 0n;
    return this.calculateAggregateTotal({
      ...(await this.getTenantWhere()),
      tipePengeluaran,
    });
  }

  async groupByPeriode(): Promise<{ tanggal: Date; jumlah: bigint }[]> {
    if (!this.hasModel()) return [];
    return this.runSafe(
      () => this.resolvePeriodSummaries(),
      [] as GroupedPeriodSummary[],
    );
  }

  async findIdsAndDates(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<{ id: string; tanggal: Date }[]> {
    if (!this.hasModel()) return [];

    return this.runSafe(
      () =>
        this.resolveFilteredIdsAndDates({
          startDate,
          endDate,
          category,
          paymentMethod,
          searchDescription,
        }),
      [] as Array<{ id: string; tanggal: Date }>,
    );
  }

  async findByFilters(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<PengeluaranPublic[]> {
    if (!this.hasModel()) return [];

    return this.runSafe(
      () =>
        this.resolveFilteredRecords({
          startDate,
          endDate,
          category,
          paymentMethod,
          searchDescription,
        }),
      [] as PengeluaranPublic[],
    );
  }

  async aggregateTotalByPeriod(month?: number, year?: number): Promise<bigint> {
    if (!this.hasModel()) return 0n;
    return this.calculateAggregateTotal(
      await this.buildPeriodWhere(month, year),
    );
  }

  async aggregateTotalByTipeAndPeriod(
    tipePengeluaran: "CAPEX" | "OPEX",
    month?: number,
    year?: number,
  ): Promise<bigint> {
    if (!this.hasModel()) return 0n;
    return this.calculateAggregateTotal({
      ...(await this.buildPeriodWhere(month, year)),
      tipePengeluaran,
    });
  }

  async groupByCategoryAndPeriod(
    month?: number,
    year?: number,
  ): Promise<GroupedPengeluaran[]> {
    if (!this.hasModel() || !this.delegate.groupBy) return [];
    return this.runSafe(
      () => this.resolveGroupedCategoryAndPeriod(month, year),
      [] as GroupedPengeluaran[],
    );
  }
}
