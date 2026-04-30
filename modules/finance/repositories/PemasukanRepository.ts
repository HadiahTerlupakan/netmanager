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
  mapMutationAmountToPublic,
  resolveTenantId,
  runSafeRepositoryOperation,
  toBigIntAmount,
  toDateValue,
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

export class PemasukanRepository implements IPemasukanRepository {
  constructor(private client: PrismaClient = prisma) {}

  private get delegate(): FinanceMutationDelegate {
    return (this.client as unknown as Record<string, FinanceMutationDelegate>)
      .pemasukan;
  }

  /** Mengambil filter tenant aktif untuk query pemasukan. */
  private async getTenantWhere() {
    return getFinanceTenantWhere();
  }

  /** Memetakan record database ke entity publik pemasukan. */
  private mapToPublicRecord(record: Record<string, unknown>) {
    return mapMutationAmountToPublic(record) as unknown as PemasukanPublic;
  }

  /** Mengambil daftar pemasukan dengan include user audit. */
  private async findManyWithAudit(where: Record<string, unknown>) {
    const items = await findMutationManyWithAudit({
      delegate: this.delegate,
      where,
    });

    return (items as Record<string, unknown>[]).map((item) =>
      this.mapToPublicRecord(item),
    );
  }

  /** Memetakan daftar id dan tanggal ke bentuk publik yang konsisten. */
  private mapIdsAndDates(items: Array<{ id: string; tanggal: Date | string }>) {
    return items.map((item) => ({
      id: item.id,
      tanggal:
        typeof item.tanggal === "string"
          ? new Date(item.tanggal)
          : item.tanggal,
    }));
  }

  /** Membangun payload create pemasukan. */
  private async buildCreatePayload(data: PemasukanCreateData) {
    const tenantId = await resolveTenantId(data as { tenantId?: string });

    return {
      tanggal: toDateValue(data.tanggal),
      nomorBukti: data.nomorBukti,
      kategori: data.kategori,
      deskripsi: data.deskripsi,
      jumlah: toBigIntAmount(data.jumlah),
      metodeBayar: data.metodeBayar ?? null,
      catatan: data.catatan ?? null,
      createdBy: data.createdBy ?? null,
      tenantId: tenantId as string,
    };
  }

  /** Membangun payload update pemasukan. */
  private buildUpdatePayload(data: PemasukanUpdateData) {
    const updateData: Record<string, unknown> = {
      ...(data.tanggal !== undefined && { tanggal: toDateValue(data.tanggal) }),
      ...(data.nomorBukti !== undefined && { nomorBukti: data.nomorBukti }),
      ...(data.kategori !== undefined && { kategori: data.kategori }),
      ...(data.deskripsi !== undefined && { deskripsi: data.deskripsi }),
      ...(data.metodeBayar !== undefined && { metodeBayar: data.metodeBayar }),
      ...(data.catatan !== undefined && { catatan: data.catatan }),
      ...(data.updatedBy !== undefined && { updatedBy: data.updatedBy }),
    };

    if (data.jumlah !== undefined) {
      updateData.jumlah = toBigIntAmount(data.jumlah);
    }

    return updateData;
  }

  /** Membangun where filter query pemasukan. */
  private async buildFilterWhere(options: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
    paymentMethod?: string;
    searchDescription?: string;
  }) {
    return buildMutationWhere(await this.getTenantWhere(), options);
  }

  /** Membangun where filter agregasi pemasukan per periode. */
  private async buildPeriodWhere(month?: number, year?: number) {
    return buildMutationPeriodWhere(await this.getTenantWhere(), {
      month,
      year,
    });
  }

  /** Menjalankan agregasi total pemasukan dengan fallback aman. */
  private aggregateTotalByWhere(where: Record<string, unknown>) {
    return runSafeRepositoryOperation(
      () => aggregateMutationTotal({ delegate: this.delegate, where }),
      BigInt(0),
    );
  }

  /** Mengambil satu pemasukan dengan data audit user. */
  private findByIdWithAudit(id: string, tenantWhere: Record<string, unknown>) {
    return findMutationByIdWithAudit({
      delegate: this.delegate,
      id,
      where: tenantWhere,
    });
  }

  /** Mengambil daftar id dan tanggal pemasukan berdasarkan where filter. */
  private findIdsAndDatesByWhere(where: Record<string, unknown>) {
    return findMutationIdsAndDates({
      delegate: this.delegate,
      where,
    });
  }

  /** Mengambil ringkasan tanggal dan jumlah pemasukan. */
  private findPeriodSummaries(where: Record<string, unknown>) {
    return findMutationPeriodSummaries({
      delegate: this.delegate,
      where,
    });
  }

  /** Mengambil seluruh pemasukan tenant aktif. */
  async findAll(): Promise<PemasukanPublic[]> {
    if (!("pemasukan" in this.client)) return [];

    return runSafeRepositoryOperation(
      async () => this.findManyWithAudit(await this.getTenantWhere()),
      [],
    );
  }

  /** Mengambil satu pemasukan berdasarkan id. */
  async findById(id: string): Promise<PemasukanPublic | null> {
    if (!("pemasukan" in this.client)) return null;

    return runSafeRepositoryOperation(async () => {
      const item = await this.findByIdWithAudit(
        id,
        await this.getTenantWhere(),
      );

      if (!item) {
        return null;
      }

      return this.mapToPublicRecord(item as Record<string, unknown>);
    }, null);
  }

  /** Membuat pemasukan baru. */
  async create(data: PemasukanCreateData): Promise<{ id: string }> {
    if (!("pemasukan" in this.client)) {
      throw new Error("Model Pemasukan belum tersedia");
    }

    const created = (await this.delegate.create({
      data: await this.buildCreatePayload(data),
      select: { id: true },
    })) as { id: string };

    return created;
  }

  /** Memperbarui pemasukan berdasarkan id. */
  async update(id: string, data: PemasukanUpdateData): Promise<void> {
    if (!("pemasukan" in this.client)) {
      throw new Error("Model Pemasukan belum tersedia");
    }

    const result = await this.delegate.updateMany({
      where: { id, ...(await this.getTenantWhere()) },
      data: this.buildUpdatePayload(data),
    });

    if (result.count === 0) {
      throw new Error("Record not found or access denied");
    }
  }

  /** Menghapus pemasukan berdasarkan id. */
  async delete(id: string): Promise<void> {
    if (!("pemasukan" in this.client)) {
      throw new Error("Model Pemasukan belum tersedia");
    }

    const result = await this.delegate.deleteMany({
      where: { id, ...(await this.getTenantWhere()) },
    });

    if (result.count === 0) {
      throw new Error("Record not found or access denied");
    }
  }

  /** Menghitung total record pemasukan tenant aktif. */
  async count(): Promise<number> {
    if (!("pemasukan" in this.client)) return 0;

    return runSafeRepositoryOperation(
      async () => this.delegate.count({ where: await this.getTenantWhere() }),
      0,
    );
  }

  /** Mengambil pemasukan dalam rentang tanggal tertentu. */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<PemasukanPublic[]> {
    if (!("pemasukan" in this.client)) return [];

    return runSafeRepositoryOperation(
      async () =>
        this.findManyWithAudit(
          await this.buildFilterWhere({ startDate, endDate }),
        ),
      [],
    );
  }

  /** Mengambil pemasukan berdasarkan kategori. */
  async findByKategori(kategori: string): Promise<PemasukanPublic[]> {
    if (!("pemasukan" in this.client)) return [];

    return runSafeRepositoryOperation(
      async () =>
        this.findManyWithAudit(
          await this.buildFilterWhere({ category: kategori }),
        ),
      [],
    );
  }

  /** Menjumlahkan seluruh nominal pemasukan tenant aktif. */
  async aggregateTotal(): Promise<bigint> {
    if (!("pemasukan" in this.client)) return BigInt(0);

    return this.aggregateTotalByWhere(await this.getTenantWhere());
  }

  /** Menjumlahkan nominal pemasukan pada periode bulanan tertentu. */
  async aggregateTotalByPeriod(month?: number, year?: number): Promise<bigint> {
    if (!("pemasukan" in this.client)) return BigInt(0);

    return this.aggregateTotalByWhere(await this.buildPeriodWhere(month, year));
  }

  /** Mengambil pemasukan ringkas per tanggal. */
  async groupByPeriode(): Promise<{ tanggal: Date; jumlah: bigint }[]> {
    if (!("pemasukan" in this.client)) return [];

    return runSafeRepositoryOperation(async () => {
      const items = await this.findPeriodSummaries(await this.getTenantWhere());

      return (items as Array<Record<string, unknown>>).map((item) => ({
        tanggal: item.tanggal as Date,
        jumlah: item.jumlah as bigint,
      }));
    }, []);
  }

  /** Mengambil id dan tanggal pemasukan berdasarkan filter. */
  async findIdsAndDates(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<{ id: string; tanggal: Date }[]> {
    if (!("pemasukan" in this.client)) return [];

    return runSafeRepositoryOperation(async () => {
      const items = await this.findIdsAndDatesByWhere(
        await this.buildFilterWhere({
          startDate,
          endDate,
          category,
          paymentMethod,
          searchDescription,
        }),
      );

      return this.mapIdsAndDates(
        items as Array<{ id: string; tanggal: Date | string }>,
      );
    }, []);
  }

  /** Mengambil daftar pemasukan berdasarkan filter komposit. */
  async findByFilters(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<PemasukanPublic[]> {
    if (!("pemasukan" in this.client)) return [];

    return runSafeRepositoryOperation(
      async () =>
        this.findManyWithAudit(
          await this.buildFilterWhere({
            startDate,
            endDate,
            category,
            paymentMethod,
            searchDescription,
          }),
        ),
      [],
    );
  }
}
