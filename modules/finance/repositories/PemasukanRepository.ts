import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IPemasukanRepository,
  PemasukanCreateData,
  PemasukanUpdateData,
} from "../domain/ports/IPemasukanRepository";
import type { PemasukanEntity as PemasukanPublic } from "../domain/entities/PemasukanEntity";
import {
  getFinanceTenantWhere,
  runSafeRepositoryOperation,
  type FinanceMutationDelegate,
} from "./shared/financeMutationRepository";
import {
  aggregateMutationTotal,
  buildMutationPeriodWhere,
  buildMutationWhere,
} from "./shared/financeMutationFilters";
import {
  findMutationByIdWithAudit,
  findMutationIdsAndDates,
  findMutationManyWithAudit,
  findMutationPeriodSummaries,
} from "./shared/mutationAuditQueries";
import {
  buildPemasukanCreatePayload,
  buildPemasukanUpdatePayload,
  mapPemasukanIdsAndDates,
  mapPemasukanToPublicRecord,
} from "./pemasukan.repository.helpers";

type MutationFilterOptions = {
  startDate?: Date;
  endDate?: Date;
  category?: string;
  paymentMethod?: string;
  searchDescription?: string;
};

export class PemasukanRepository implements IPemasukanRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  private get delegate(): FinanceMutationDelegate {
    return (this.client as unknown as Record<string, FinanceMutationDelegate>)
      .pemasukan;
  }

  private hasModel(): boolean {
    return "pemasukan" in this.client;
  }

  private assertModelExists(): void {
    if (!this.hasModel()) {
      throw new Error("Model Pemasukan belum tersedia");
    }
  }

  private async getTenantWhere(): Promise<Record<string, unknown>> {
    return getFinanceTenantWhere();
  }

  private async buildFilterWhere(
    options: MutationFilterOptions,
  ): Promise<Record<string, unknown>> {
    return buildMutationWhere(await this.getTenantWhere(), options);
  }

  private async buildPeriodWhere(
    month?: number,
    year?: number,
  ): Promise<Record<string, unknown>> {
    return buildMutationPeriodWhere(await this.getTenantWhere(), {
      month,
      year,
    });
  }

  private runSafe<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    return runSafeRepositoryOperation(operation, fallback);
  }

  private async findPublicMany(
    where: Record<string, unknown>,
  ): Promise<PemasukanPublic[]> {
    const items = await findMutationManyWithAudit({
      delegate: this.delegate,
      where,
    });
    return (items as Record<string, unknown>[]).map(mapPemasukanToPublicRecord);
  }

  private async findPublicById(id: string): Promise<PemasukanPublic | null> {
    const item = await findMutationByIdWithAudit({
      delegate: this.delegate,
      id,
      where: await this.getTenantWhere(),
    });

    return item
      ? mapPemasukanToPublicRecord(item as Record<string, unknown>)
      : null;
  }

  private async mutateById(
    id: string,
    operation: "update" | "delete",
    data?: Record<string, unknown>,
  ): Promise<void> {
    const where = { id, ...(await this.getTenantWhere()) };

    if (operation === "update") {
      const result = await this.delegate.updateMany({
        where,
        data: data ?? {},
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
    const items = await findMutationIdsAndDates({
      delegate: this.delegate,
      where: await this.buildFilterWhere(options),
    });

    return mapPemasukanIdsAndDates(
      items as Array<{ id: string; tanggal: Date | string }>,
    );
  }

  private async resolveFilteredRecords(
    options: MutationFilterOptions,
  ): Promise<PemasukanPublic[]> {
    return this.findPublicMany(await this.buildFilterWhere(options));
  }

  private async resolvePeriodSummaries(): Promise<
    Array<{ tanggal: Date; jumlah: bigint }>
  > {
    const items = await findMutationPeriodSummaries({
      delegate: this.delegate,
      where: await this.getTenantWhere(),
    });

    return (items as Array<Record<string, unknown>>).map((item) => ({
      tanggal: item.tanggal as Date,
      jumlah: item.jumlah as bigint,
    }));
  }

  async findAll(): Promise<PemasukanPublic[]> {
    if (!this.hasModel()) return [];
    return this.runSafe(
      async () => this.findPublicMany(await this.getTenantWhere()),
      [],
    );
  }

  async findById(id: string): Promise<PemasukanPublic | null> {
    if (!this.hasModel()) return null;
    return this.runSafe(
      () => this.findPublicById(id),
      null as PemasukanPublic | null,
    );
  }

  async create(data: PemasukanCreateData): Promise<{ id: string }> {
    this.assertModelExists();

    return (await this.delegate.create({
      data: await buildPemasukanCreatePayload(data),
      select: { id: true },
    })) as { id: string };
  }

  async update(id: string, data: PemasukanUpdateData): Promise<void> {
    this.assertModelExists();
    await this.mutateById(id, "update", buildPemasukanUpdatePayload(data));
  }

  async delete(id: string): Promise<void> {
    this.assertModelExists();
    await this.mutateById(id, "delete");
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
  ): Promise<PemasukanPublic[]> {
    if (!this.hasModel()) return [];
    return this.runSafe(
      async () =>
        this.findPublicMany(
          await this.buildFilterWhere({ startDate, endDate }),
        ),
      [] as PemasukanPublic[],
    );
  }

  async findByKategori(kategori: string): Promise<PemasukanPublic[]> {
    if (!this.hasModel()) return [];
    return this.runSafe(
      async () =>
        this.findPublicMany(
          await this.buildFilterWhere({ category: kategori }),
        ),
      [] as PemasukanPublic[],
    );
  }

  async aggregateTotal(): Promise<bigint> {
    if (!this.hasModel()) return BigInt(0);

    return this.runSafe(
      async () =>
        aggregateMutationTotal({
          delegate: this.delegate,
          where: await this.getTenantWhere(),
        }),
      BigInt(0),
    );
  }

  async aggregateTotalByPeriod(month?: number, year?: number): Promise<bigint> {
    if (!this.hasModel()) return BigInt(0);
    return this.runSafe(
      async () =>
        aggregateMutationTotal({
          delegate: this.delegate,
          where: await this.buildPeriodWhere(month, year),
        }),
      BigInt(0),
    );
  }

  async groupByPeriode(): Promise<{ tanggal: Date; jumlah: bigint }[]> {
    if (!this.hasModel()) return [];
    return this.runSafe(
      () => this.resolvePeriodSummaries(),
      [] as Array<{ tanggal: Date; jumlah: bigint }>,
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
  ): Promise<PemasukanPublic[]> {
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
      [] as PemasukanPublic[],
    );
  }
}
