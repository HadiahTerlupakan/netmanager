import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IPemasukanRepository,
  PemasukanCreateData,
  PemasukanUpdateData,
  PemasukanPublic,
} from "./IPemasukanRepository";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { createInsensitiveContainsFilter } from "../utils/prisma-search-filters";

// Define a generic delegate interface for the missing model
interface GenericDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  findFirst(args?: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
  aggregate(args: unknown): Promise<{ _sum: { jumlah: bigint | null } }>;
}

export class PemasukanRepository implements IPemasukanRepository {
  constructor(private client: PrismaClient = prisma) {}

  private get delegate(): GenericDelegate {
    return (this.client as unknown as Record<string, GenericDelegate>)
      .pemasukan;
  }

  /**
   * Helper to get tenant isolation filter based on current context.
   */
  private async getTenantWhere(): Promise<Record<string, unknown>> {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (isSuperAdmin) return {};
    if (!tenantId) return { tenantId: "___MISSING_TENANT_ID___" };
    return { tenantId };
  }

  async findAll(): Promise<PemasukanPublic[]> {
    try {
      if (!("pemasukan" in this.client)) return [];
      const tenantWhere = await this.getTenantWhere();
      const items = await this.delegate.findMany({
        where: tenantWhere,
        orderBy: { tanggal: "desc" },
        include: {
          createdByuser: { select: { id: true, name: true, email: true } },
          updatedByuser: { select: { id: true, name: true, email: true } },
        },
      });
      return (items as Array<Record<string, unknown>>).map((item) => ({
        ...item,
        jumlah:
          typeof item.jumlah === "bigint"
            ? item.jumlah.toString()
            : (item.jumlah as string | number),
      })) as unknown as PemasukanPublic[];
    } catch (_error: unknown) {
      return [];
    }
  }

  async findById(id: string): Promise<PemasukanPublic | null> {
    try {
      if (!("pemasukan" in this.client)) return null;
      const tenantWhere = await this.getTenantWhere();
      const item = await this.delegate.findFirst({
        where: { id, ...tenantWhere },
        include: {
          createdByuser: { select: { id: true, name: true, email: true } },
          updatedByuser: { select: { id: true, name: true, email: true } },
        },
      });
      if (!item) return null;
      const typedItem = item as Record<string, unknown>;
      return {
        ...typedItem,
        jumlah:
          typeof typedItem.jumlah === "bigint"
            ? typedItem.jumlah.toString()
            : (typedItem.jumlah as string | number),
      } as unknown as PemasukanPublic;
    } catch (_error: unknown) {
      return null;
    }
  }

  async create(data: PemasukanCreateData): Promise<{ id: string }> {
    if (!("pemasukan" in this.client))
      throw new Error("Model Pemasukan belum tersedia");

    const context = await getTenantIdFromContext();
    const tenantId =
      (data as unknown as { tenantId?: string }).tenantId || context.tenantId;

    const jumlahBigInt =
      typeof data.jumlah === "bigint"
        ? data.jumlah
        : BigInt(data.jumlah as string | number);

    const created = (await this.delegate.create({
      data: {
        tanggal:
          typeof data.tanggal === "string"
            ? new Date(data.tanggal)
            : data.tanggal,
        nomorBukti: data.nomorBukti,
        kategori: data.kategori,
        deskripsi: data.deskripsi,
        jumlah: jumlahBigInt,
        metodeBayar: data.metodeBayar ?? null,
        catatan: data.catatan ?? null,
        createdBy: data.createdBy ?? null,
        tenantId: tenantId as string,
      },
      select: { id: true },
    })) as { id: string };
    return created;
  }

  async update(id: string, data: PemasukanUpdateData): Promise<void> {
    if (!("pemasukan" in this.client))
      throw new Error("Model Pemasukan belum tersedia");
    const tenantWhere = await this.getTenantWhere();

    const updateData: Record<string, unknown> = {
      ...(data.tanggal !== undefined && {
        tanggal:
          typeof data.tanggal === "string"
            ? new Date(data.tanggal)
            : data.tanggal,
      }),
      ...(data.nomorBukti !== undefined && { nomorBukti: data.nomorBukti }),
      ...(data.kategori !== undefined && { kategori: data.kategori }),
      ...(data.deskripsi !== undefined && { deskripsi: data.deskripsi }),
      ...(data.metodeBayar !== undefined && { metodeBayar: data.metodeBayar }),
      ...(data.catatan !== undefined && { catatan: data.catatan }),
      ...(data.updatedBy !== undefined && { updatedBy: data.updatedBy }),
    };

    if (data.jumlah !== undefined) {
      updateData.jumlah =
        typeof data.jumlah === "bigint"
          ? data.jumlah
          : BigInt(data.jumlah as string | number);
    }

    const result = await this.delegate.updateMany({
      where: { id, ...tenantWhere },
      data: updateData,
    });
    if (result.count === 0)
      throw new Error("Record not found or access denied");
  }

  async delete(id: string): Promise<void> {
    if (!("pemasukan" in this.client))
      throw new Error("Model Pemasukan belum tersedia");
    const tenantWhere = await this.getTenantWhere();
    const result = await this.delegate.deleteMany({
      where: { id, ...tenantWhere },
    });
    if (result.count === 0)
      throw new Error("Record not found or access denied");
  }

  async count(): Promise<number> {
    try {
      if (!("pemasukan" in this.client)) return 0;
      const tenantWhere = await this.getTenantWhere();
      return await this.delegate.count({ where: tenantWhere });
    } catch (_error: unknown) {
      return 0;
    }
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<PemasukanPublic[]> {
    try {
      if (!("pemasukan" in this.client)) return [];
      const tenantWhere = await this.getTenantWhere();
      const items = await this.delegate.findMany({
        where: { ...tenantWhere, tanggal: { gte: startDate, lte: endDate } },
        orderBy: { tanggal: "desc" },
        include: {
          createdByuser: { select: { id: true, name: true, email: true } },
          updatedByuser: { select: { id: true, name: true, email: true } },
        },
      });
      return (items as Array<Record<string, unknown>>).map(
        (item: Record<string, unknown>) => ({
          ...item,
          jumlah:
            typeof item.jumlah === "bigint"
              ? item.jumlah.toString()
              : (item.jumlah as string | number),
        }),
      ) as unknown as PemasukanPublic[];
    } catch (_error: unknown) {
      return [];
    }
  }

  async findByKategori(kategori: string): Promise<PemasukanPublic[]> {
    try {
      if (!("pemasukan" in this.client)) return [];
      const tenantWhere = await this.getTenantWhere();
      const items = await this.delegate.findMany({
        where: { ...tenantWhere, kategori },
        orderBy: { tanggal: "desc" },
        include: {
          createdByuser: { select: { id: true, name: true, email: true } },
          updatedByuser: { select: { id: true, name: true, email: true } },
        },
      });
      return (items as Array<Record<string, unknown>>).map(
        (item: Record<string, unknown>) => ({
          ...item,
          jumlah:
            typeof item.jumlah === "bigint"
              ? item.jumlah.toString()
              : (item.jumlah as string | number),
        }),
      ) as unknown as PemasukanPublic[];
    } catch (_error: unknown) {
      return [];
    }
  }

  async aggregateTotal(): Promise<bigint> {
    try {
      if (!("pemasukan" in this.client)) return BigInt(0);
      const tenantWhere = await this.getTenantWhere();
      const result = await this.delegate.aggregate({
        where: tenantWhere,
        _sum: { jumlah: true },
      });
      return result._sum.jumlah || BigInt(0);
    } catch (_error: unknown) {
      return BigInt(0);
    }
  }

  async aggregateTotalByPeriod(month?: number, year?: number): Promise<bigint> {
    try {
      if (!("pemasukan" in this.client)) return BigInt(0);
      const tenantWhere = await this.getTenantWhere();
      const where: Record<string, unknown> = { ...tenantWhere };
      if (month !== undefined && year !== undefined) {
        where.tanggal = {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        };
      }
      const result = await this.delegate.aggregate({
        where,
        _sum: { jumlah: true },
      });
      return result._sum.jumlah || BigInt(0);
    } catch (_error: unknown) {
      return BigInt(0);
    }
  }

  async groupByPeriode(): Promise<{ tanggal: Date; jumlah: bigint }[]> {
    try {
      if (!("pemasukan" in this.client)) return [];
      const tenantWhere = await this.getTenantWhere();
      const items = await this.delegate.findMany({
        where: tenantWhere,
        select: { tanggal: true, jumlah: true },
      });
      return (items as Array<Record<string, unknown>>).map((item) => ({
        tanggal: item.tanggal as Date,
        jumlah: item.jumlah as bigint,
      }));
    } catch (_error: unknown) {
      return [];
    }
  }

  async findIdsAndDates(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<{ id: string; tanggal: Date }[]> {
    try {
      if (!("pemasukan" in this.client)) return [];
      const tenantWhere = await this.getTenantWhere();
      const where: Record<string, unknown> = { ...tenantWhere };
      if (startDate && endDate)
        where.tanggal = { gte: startDate, lte: endDate };
      if (category) where.kategori = category;
      if (paymentMethod) where.metodeBayar = paymentMethod;
      if (searchDescription)
        where.deskripsi = createInsensitiveContainsFilter(searchDescription);

      const items = await this.delegate.findMany({
        where,
        select: { id: true, tanggal: true },
        orderBy: { tanggal: "desc" },
      });
      return (items as Array<{ id: string; tanggal: Date | string }>).map(
        (item) => ({
          id: item.id,
          tanggal:
            typeof item.tanggal === "string"
              ? new Date(item.tanggal)
              : item.tanggal,
        }),
      );
    } catch (_error: unknown) {
      return [];
    }
  }

  async findByFilters(
    startDate?: Date,
    endDate?: Date,
    category?: string,
    paymentMethod?: string,
    searchDescription?: string,
  ): Promise<PemasukanPublic[]> {
    try {
      if (!("pemasukan" in this.client)) return [];
      const tenantWhere = await this.getTenantWhere();
      const where: Record<string, unknown> = { ...tenantWhere };
      if (startDate && endDate)
        where.tanggal = { gte: startDate, lte: endDate };
      if (category) where.kategori = category;
      if (paymentMethod) where.metodeBayar = paymentMethod;
      if (searchDescription)
        where.deskripsi = createInsensitiveContainsFilter(searchDescription);

      const items = await this.delegate.findMany({
        where,
        orderBy: { tanggal: "desc" },
        include: {
          createdByuser: { select: { id: true, name: true, email: true } },
          updatedByuser: { select: { id: true, name: true, email: true } },
        },
      });
      return (items as Array<Record<string, unknown>>).map(
        (item: Record<string, unknown>) => ({
          ...item,
          jumlah:
            typeof item.jumlah === "bigint"
              ? item.jumlah.toString()
              : (item.jumlah as string | number),
        }),
      ) as unknown as PemasukanPublic[];
    } catch (_error: unknown) {
      return [];
    }
  }
}
