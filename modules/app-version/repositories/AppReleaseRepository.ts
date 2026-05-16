import { prisma } from "@/lib/prisma";
import type {
  AppRelease,
  AppReleasePlatform,
} from "../domain/entities/AppReleaseEntity";
import type {
  AppReleaseCreateInput,
  AppReleaseQueryFilters,
  AppReleaseUpdateInput,
  IAppReleaseRepository,
} from "../domain/ports/IAppReleaseRepository";

type PrismaAppRelease = NonNullable<
  Awaited<ReturnType<typeof prisma.appRelease.findFirst>>
>;

/** Map Prisma record ke domain entity dengan cast platform & architecture. */
function toEntity(record: PrismaAppRelease): AppRelease {
  return {
    ...record,
    platform: record.platform as AppReleasePlatform,
    architecture: record.architecture as AppRelease["architecture"],
  };
}

export class AppReleaseRepository implements IAppReleaseRepository {
  /** Ambil rilis aktif terbaru berdasarkan platform (dan opsional tenantId). */
  async findLatestActive(query: {
    platform: AppReleasePlatform;
    tenantId?: string;
  }): Promise<AppRelease | null> {
    const record = await prisma.appRelease.findFirst({
      where: {
        platform: query.platform,
        isActive: true,
        ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      },
      orderBy: { releasedAt: "desc" },
    });
    return record ? toEntity(record) : null;
  }

  /** Cari rilis berdasarkan ID unik. */
  async findById(id: string): Promise<AppRelease | null> {
    const record = await prisma.appRelease.findUnique({ where: { id } });
    return record ? toEntity(record) : null;
  }

  /** Ambil daftar rilis dengan filter opsional dan pagination. */
  async findAll(filters: AppReleaseQueryFilters): Promise<AppRelease[]> {
    const records = await prisma.appRelease.findMany({
      where: this.buildWhere(filters),
      orderBy: { releasedAt: "desc" },
      skip: filters.skip,
      take: filters.take,
    });
    return records.map(toEntity);
  }

  /** Hitung total rilis yang cocok dengan filter. */
  async count(filters: AppReleaseQueryFilters): Promise<number> {
    return prisma.appRelease.count({ where: this.buildWhere(filters) });
  }

  /** Buat entri rilis baru. */
  async create(data: AppReleaseCreateInput): Promise<AppRelease> {
    const record = await prisma.appRelease.create({ data });
    return toEntity(record);
  }

  /** Update field rilis yang diizinkan. */
  async update(id: string, data: AppReleaseUpdateInput): Promise<AppRelease> {
    const record = await prisma.appRelease.update({ where: { id }, data });
    return toEntity(record);
  }

  /** Soft delete: set isActive=false, data tetap tersimpan. */
  async delete(id: string): Promise<void> {
    await prisma.appRelease.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Bangun objek where Prisma dari filter query. */
  private buildWhere(filters: AppReleaseQueryFilters) {
    return {
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
    };
  }
}
