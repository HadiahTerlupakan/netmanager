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
  buildCreatePayload,
  buildFilterWhere,
  buildPeriodWhere,
  buildUpdatePayload,
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

export class PengeluaranRepository implements IPengeluaranRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  private get delegate(): FinanceMutationDelegate {
    return (this.client as unknown as Record<string, FinanceMutationDelegate>)
      .pengeluaran;
  }

  private hasPengeluaranModel() {
    return "pengeluaran" in this.client;
  }

  private assertPengeluaranModelExists() {
    if (!this.hasPengeluaranModel()) {
      throw new Error("Model Pengeluaran belum tersedia");
    }
  }

  private async getScopedTenantWhere() {
    return getTenantWhere();
  }

  private buildBudgetLookupWhere(input: {
    budgetCategory: string;
    expenseDate: Date;
    tenantId: string;
  }) {
    return {
      category: input.budgetCategory,
      month: input.expenseDate.getMonth() + 1,
      year: input.expenseDate.getFullYear(),
      status: { in: ["APPROVED", "ACTIVE"] },
      tenantId: input.tenantId,
    };
  }

  private async resolveBudgetId(data: PengeluaranCreateData) {
    return findBudgetIdForExpense({
      client: this.client as unknown as Record<string, FinanceMutationDelegate>,
      data,
      buildBudgetLookupWhere: (input) => this.buildBudgetLookupWhere(input),
    });
  }

  private async buildCreateData(data: PengeluaranCreateData) {
    return buildCreatePayload(data, await this.resolveBudgetId(data));
  }

  private buildUpdateData(data: PengeluaranUpdateData) {
    return buildUpdatePayload(data);
  }

  private async buildWhere(options: MutationFilterOptions) {
    return buildFilterWhere(options);
  }

  private async buildPeriodScopedWhere(month?: number, year?: number) {
    return buildPeriodWhere(month, year);
  }

  private runSafe<T>(operation: () => Promise<T>, fallback: T) {
    return runSafeRepositoryOperation(operation, fallback);
  }

  private async findPublicMany(where: Record<string, unknown>) {
    return findManyWithAudit(this.delegate, where);
  }

  private async findPublicById(id: string) {
    const item = await findByIdWithAudit(
      this.delegate,
      id,
      await this.getScopedTenantWhere(),
    );

    return item ? (item as PengeluaranPublic) : null;
  }

  private calculateAggregateTotal(where: Record<string, unknown>) {
    return aggregateTotalByWhere(this.delegate, where);
  }

  private async deleteScoped(id: string) {
    const result = await this.delegate.deleteMany({
      where: { id, ...(await this.getScopedTenantWhere()) },
    });

    if (result.count === 0) {
      throw new Error("Record not found or access denied");
    }
  }

  private async updateScoped(id: string, data: PengeluaranUpdateData) {
    const result = await this.delegate.updateMany({
      where: { id, ...(await this.getScopedTenantWhere()) },
      data: this.buildUpdateData(data),
    });

    if (result.count === 0) {
      throw new Error("Record not found or access denied");
    }
  }

  private async createRecord(data: PengeluaranCreateData) {
    return this.delegate.create({
      data: await this.buildCreateData(data),
      select: { id: true },
    }) as Promise<{ id: string }>;
  }

  /** Returns all scoped pengeluaran rows. */
  async findAll(): Promise<PengeluaranPublic[]> {
    if (!this.hasPengeluaranModel()) return [];

    return this.runSafe(
      async () => this.findPublicMany(await this.getScopedTenantWhere()),
      [] as PengeluaranPublic[],
    );
  }

  /** Returns one scoped pengeluaran row by id. */
  async findById(id: string): Promise<PengeluaranPublic | null> {
    if (!this.hasPengeluaranModel()) return null;

    return this.runSafe(
      () => this.findPublicById(id),
      null as PengeluaranPublic | null,
    );
  }

  /** Creates a new pengeluaran row. */
  async create(data: PengeluaranCreateData): Promise<{ id: string }> {
    this.assertPengeluaranModelExists();
    return this.createRecord(data);
  }

  /** Updates an existing scoped pengeluaran row. */
  async update(id: string, data: PengeluaranUpdateData): Promise<void> {
    this.assertPengeluaranModelExists();
    await this.updateScoped(id, data);
  }

  /** Deletes an existing scoped pengeluaran row. */
  async delete(id: string): Promise<void> {
    this.assertPengeluaranModelExists();
    await this.deleteScoped(id);
  }

  /** Counts all scoped pengeluaran rows. */
  async count(): Promise<number> {
    if (!this.hasPengeluaranModel()) return 0;

    return this.runSafe(
      async () =>
        this.delegate.count({ where: await this.getScopedTenantWhere() }),
      0,
    );
  }

  /** Returns scoped pengeluaran rows inside a date range. */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<PengeluaranPublic[]> {
    if (!this.hasPengeluaranModel()) return [];

    return this.runSafe(
      async () =>
        this.findPublicMany(await this.buildWhere({ startDate, endDate })),
      [] as PengeluaranPublic[],
    );
  }

  /** Returns scoped pengeluaran rows filtered by kategori. */
  async findByKategori(kategori: string): Promise<PengeluaranPublic[]> {
    if (!this.hasPengeluaranModel()) return [];

    return this.runSafe(
      async () =>
        this.findPublicMany(await this.buildWhere({ category: kategori })),
      [] as PengeluaranPublic[],
    );
  }

  /** Aggregates the total amount of all scoped pengeluaran rows. */
  async aggregateTotal(): Promise<bigint> {
    if (!this.hasPengeluaranModel()) return 0n;
    return this.calculateAggregateTotal(await this.getScopedTenantWhere());
  }

  /** Aggregates the total amount by pengeluaran type. */
  async aggregateTotalByTipe(
    tipePengeluaran: "CAPEX" | "OPEX",
  ): Promise<bigint> {
    if (!this.hasPengeluaranModel()) return 0n;

    return this.calculateAggregateTotal({
      ...(await this.getScopedTenantWhere()),
      tipePengeluaran,
    });
  }

  /** Returns date-based pengeluaran summary rows. */
  async groupByPeriode(): Promise<{ tanggal: Date; jumlah: bigint }[]> {
    if (!this.hasPengeluaranModel()) return [];

    return this.runSafe(
      async () => {
        const items = await findPeriodSummaries(
          this.delegate,
          await this.getScopedTenantWhere(),
        );

        return (items as Record<string, unknown>[]).map((item) => ({
          tanggal: item.tanggal as Date,
          jumlah: item.jumlah as bigint,
        }));
      },
      [] as Array<{ tanggal: Date; jumlah: bigint }>,
    );
  }

  /** Returns pengeluaran ids and dates filtered by composite criteria. */
  async findIdsAndDates(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<{ id: string; tanggal: Date }[]> {
    if (!this.hasPengeluaranModel()) return [];

    return this.runSafe(
      async () => {
        const items = await findIdsAndDatesByWhere(
          this.delegate,
          await this.buildWhere({
            startDate,
            endDate,
            category,
            paymentMethod,
            searchDescription,
          }),
        );

        return mapIdsAndDates(
          items as Array<{ id: string; tanggal: Date | string }>,
        );
      },
      [] as Array<{ id: string; tanggal: Date }>,
    );
  }

  /** Returns scoped pengeluaran rows filtered by composite criteria. */
  async findByFilters(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<PengeluaranPublic[]> {
    if (!this.hasPengeluaranModel()) return [];

    return this.runSafe(
      async () =>
        this.findPublicMany(
          await this.buildWhere({
            startDate,
            endDate,
            category,
            paymentMethod,
            searchDescription,
          }),
        ),
      [] as PengeluaranPublic[],
    );
  }

  /** Aggregates the total amount for a monthly period. */
  async aggregateTotalByPeriod(month?: number, year?: number): Promise<bigint> {
    if (!this.hasPengeluaranModel()) return 0n;
    return this.calculateAggregateTotal(
      await this.buildPeriodScopedWhere(month, year),
    );
  }

  /** Aggregates the total amount by type for a monthly period. */
  async aggregateTotalByTipeAndPeriod(
    tipePengeluaran: "CAPEX" | "OPEX",
    month?: number,
    year?: number,
  ): Promise<bigint> {
    if (!this.hasPengeluaranModel()) return 0n;

    return this.calculateAggregateTotal({
      ...(await this.buildPeriodScopedWhere(month, year)),
      tipePengeluaran,
    });
  }

  /** Groups pengeluaran totals by category and type for a monthly period. */
  async groupByCategoryAndPeriod(
    month?: number,
    year?: number,
  ): Promise<GroupedPengeluaran[]> {
    if (!this.hasPengeluaranModel() || !this.delegate.groupBy) return [];

    return this.runSafe(async () => {
      const items = await groupByCategory(
        this.delegate,
        await this.buildPeriodScopedWhere(month, year),
      );

      return mapGroupedResults((items ?? []) as RawGroupResult[]);
    }, [] as GroupedPengeluaran[]);
  }
}
