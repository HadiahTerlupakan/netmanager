import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  ISiteRepository,
  SiteCreateRepositoryInput,
  SiteFilterOptions,
  SiteUpdateRepositoryInput,
} from "../domain/ports/ISiteRepository";
import type { SiteEntity } from "../domain/entities/SiteEntity";
import { SiteMapper } from "../mappers/SiteMapper";

const DEFAULT_ATTENDANCE_RADIUS = 100;

/**
 * Repository for Site data access.
 */
export class SiteRepository implements ISiteRepository {
  /** Find all sites with optional filtering. */
  async findAll(filter?: SiteFilterOptions): Promise<SiteEntity[]> {
    const where = this.buildWhereClause(filter);
    const sites = await prisma.sites.findMany({
      where,
      include: {
        _count: { select: { work_orders: true, user: true } },
        gudang: { select: { id: true, nama: true, kode: true } },
      },
      orderBy: { name: "asc" },
    });

    return SiteMapper.toDomains(sites);
  }

  /** Find site by ID with details. */
  async findById(id: string): Promise<SiteEntity | null> {
    const site = await prisma.sites.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            departments: { select: { name: true } },
          },
        },
        _count: { select: { work_orders: true, user: true, pelanggan: true } },
        gudang: { select: { id: true, nama: true, kode: true } },
      },
    });

    return site ? SiteMapper.toDomain(site) : null;
  }

  /** Find site name by ID for lightweight lookups. */
  async findNameById(id: string): Promise<{ name: string } | null> {
    return prisma.sites.findUnique({
      where: { id },
      select: { name: true },
    });
  }

  /** Find site by code. */
  async findByCode(code: string): Promise<SiteEntity | null> {
    const site = await prisma.sites.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        _count: { select: { work_orders: true, user: true, pelanggan: true } },
        gudang: { select: { id: true, nama: true, kode: true } },
      },
    });

    return site ? SiteMapper.toDomain(site) : null;
  }

  /** Create new site entity. */
  async create(data: SiteCreateRepositoryInput): Promise<SiteEntity> {
    const site = await prisma.$transaction(async (tx) => {
      return tx.sites.create({
        data: {
          id: randomUUID(),
          code: data.code.toUpperCase(),
          name: data.name,
          description: data.description,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          attendanceRadius: data.attendanceRadius ?? DEFAULT_ATTENDANCE_RADIUS,
          updatedAt: new Date(),
          gudang: this.buildGudangConnect(data.gudangIds),
        },
        include: {
          _count: {
            select: { work_orders: true, user: true, pelanggan: true },
          },
          gudang: { select: { id: true, nama: true, kode: true } },
        },
      });
    });

    return SiteMapper.toDomain(site);
  }

  /** Update site entity. */
  async update(
    id: string,
    data: SiteUpdateRepositoryInput,
  ): Promise<SiteEntity> {
    const site = await prisma.$transaction(async (tx) => {
      return tx.sites.update({
        where: { id },
        data: {
          ...(data.code && { code: data.code.toUpperCase() }),
          ...(data.name && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.address !== undefined && { address: data.address }),
          ...(data.latitude !== undefined && { latitude: data.latitude }),
          ...(data.longitude !== undefined && { longitude: data.longitude }),
          ...(data.attendanceRadius !== undefined && {
            attendanceRadius: data.attendanceRadius,
          }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.gudangIds !== undefined && {
            gudang: { set: this.mapGudangIds(data.gudangIds) },
          }),
        },
        include: {
          _count: {
            select: { work_orders: true, user: true, pelanggan: true },
          },
          gudang: { select: { id: true, nama: true, kode: true } },
        },
      });
    });

    return SiteMapper.toDomain(site);
  }

  /** Deactivate site entity. */
  async deactivate(id: string): Promise<SiteEntity> {
    const site = await prisma.sites.update({
      where: { id },
      data: { isActive: false },
      include: {
        _count: { select: { work_orders: true, user: true, pelanggan: true } },
        gudang: { select: { id: true, nama: true, kode: true } },
      },
    });

    return SiteMapper.toDomain(site);
  }

  /** Delete site entity by ID. */
  async delete(id: string): Promise<void> {
    await prisma.sites.delete({ where: { id } });
  }

  /** Find site entity for delete checks. */
  async findWithCounts(id: string): Promise<SiteEntity | null> {
    const site = await prisma.sites.findUnique({
      where: { id },
      include: {
        _count: { select: { user: true, work_orders: true, pelanggan: true } },
        gudang: { select: { id: true, nama: true, kode: true } },
      },
    });

    return site ? SiteMapper.toDomain(site) : null;
  }

  private buildWhereClause(filter?: SiteFilterOptions): Prisma.SitesWhereInput {
    const where: Prisma.SitesWhereInput = {};
    if (filter?.activeOnly) {
      where.isActive = true;
    }

    if (filter?.allowedSiteIds && filter.allowedSiteIds.length > 0) {
      where.id = { in: filter.allowedSiteIds };
    }

    if (filter?.search) {
      where.OR = [
        { name: { contains: filter.search, mode: "insensitive" } },
        { code: { contains: filter.search, mode: "insensitive" } },
        { address: { contains: filter.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  private buildGudangConnect(gudangIds?: string[]) {
    if (!gudangIds || gudangIds.length === 0) {
      return undefined;
    }

    return { connect: this.mapGudangIds(gudangIds) };
  }

  private mapGudangIds(gudangIds: string[]) {
    return gudangIds.map((id) => ({ id }));
  }
}
