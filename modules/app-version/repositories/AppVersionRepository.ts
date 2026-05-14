import { prismaAuth as prisma } from "@/lib/prisma";
import { prismaMitra } from "@/modules/database";
import type { Prisma } from "@prisma/client";
import type {
  AppVersion,
  AppVersionRolloutStats,
  AppVersionWithUser,
  CreateAppVersionDTO,
  UpdateAppVersionDTO,
} from "../domain/entities/AppVersionEntity";
import type { IAppVersionRepository } from "../domain/ports/IAppVersionRepository";

/** In-memory cache for latest version (rarely changes, queried on every mobile request) */
let versionCache: { data: AppVersion | null; expiresAt: number } | null = null;
const VERSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Clear the cached latest version (call when app versions are created/updated/deleted) */
export function clearVersionCache(): void {
  versionCache = null;
}

export class AppVersionRepository implements IAppVersionRepository {
  /**
   * Find all app versions with pagination
   */
  async findAll(options?: {
    page?: number;
    limit?: number;
    platform?: string;
    isActive?: boolean;
  }): Promise<{ data: AppVersionWithUser[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.AppVersionWhereInput = {};

    if (options?.platform) {
      where.platform = options.platform;
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const [data, total] = await Promise.all([
      prisma.appVersion.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { versionCode: "desc" },
        skip,
        take: limit,
      }),
      prisma.appVersion.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Find by ID
   */
  async findById(id: string): Promise<AppVersionWithUser | null> {
    return prisma.appVersion.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Find by version string
   */
  async findByVersion(version: string): Promise<AppVersion | null> {
    return prisma.appVersion.findUnique({
      where: { version },
    });
  }

  /**
   * Find by version code
   */
  async findByVersionCode(versionCode: number): Promise<AppVersion | null> {
    return prisma.appVersion.findUnique({
      where: { versionCode },
    });
  }

  /**
   * Get latest active version for a platform (cached, 5-min TTL)
   */
  async getLatestVersion(
    platform: string = "android",
  ): Promise<AppVersion | null> {
    if (versionCache && Date.now() < versionCache.expiresAt) {
      return versionCache.data;
    }

    const result = await prisma.appVersion.findFirst({
      where: {
        isActive: true,
        OR: [{ platform }, { platform: "all" }],
      },
      orderBy: { versionCode: "desc" },
    });

    versionCache = { data: result, expiresAt: Date.now() + VERSION_CACHE_TTL };
    return result;
  }

  async getRolloutStatsByVersionCode(
    versionCode: number,
  ): Promise<AppVersionRolloutStats> {
    const [
      updatedUsers,
      updatedCustomers,
      updatedMitra,
      outdatedUsers,
      outdatedCustomers,
      outdatedMitra,
      unknownUsers,
      unknownCustomers,
      unknownMitra,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          isActive: true,
          lastVersionCode: { gte: versionCode },
        },
      }),
      prisma.pelanggan.count({
        where: {
          status: "AKTIF",
          lastVersionCode: { gte: versionCode },
        },
      }),
      prismaMitra.mitra.count({
        where: {
          isActive: true,
          lastVersionCode: { gte: versionCode },
        },
      }),
      prisma.user.count({
        where: {
          isActive: true,
          lastVersionCode: { lt: versionCode },
        },
      }),
      prisma.pelanggan.count({
        where: {
          status: "AKTIF",
          lastVersionCode: { lt: versionCode },
        },
      }),
      prismaMitra.mitra.count({
        where: {
          isActive: true,
          lastVersionCode: { lt: versionCode },
        },
      }),
      prisma.user.count({
        where: {
          isActive: true,
          lastVersionCode: null,
        },
      }),
      prisma.pelanggan.count({
        where: {
          status: "AKTIF",
          lastVersionCode: null,
        },
      }),
      prismaMitra.mitra.count({
        where: {
          isActive: true,
          lastVersionCode: null,
        },
      }),
    ]);

    return {
      updatedCount: updatedUsers + updatedCustomers + updatedMitra,
      outdatedCount: outdatedUsers + outdatedCustomers + outdatedMitra,
      unknownCount: unknownUsers + unknownCustomers + unknownMitra,
    };
  }

  /**
   * Create new app version
   */
  async create(data: CreateAppVersionDTO): Promise<AppVersion> {
    return prisma.appVersion.create({
      data: this.toCreateInput(data),
    });
  }

  /** Build Prisma create payload from module DTO. */
  private toCreateInput(
    data: CreateAppVersionDTO,
  ): Prisma.AppVersionUncheckedCreateInput {
    return {
      version: data.version,
      buildNumber: data.buildNumber,
      versionCode: data.versionCode,
      platform: data.platform || "android",
      apkUrl: data.apkUrl ?? null,
      apkSize: data.apkSize ?? null,
      releaseNotes: data.releaseNotes ?? null,
      isForceUpdate: data.isForceUpdate || false,
      minVersion: data.minVersion ?? null,
      isActive: data.isActive ?? true,
      publishedAt: data.publishedAt || new Date(),
      ...(data.createdBy ? { createdBy: data.createdBy } : {}),
    };
  }

  /**
   * Update app version
   */
  async update(id: string, data: UpdateAppVersionDTO): Promise<AppVersion> {
    return prisma.appVersion.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete (set isActive to false)
   */
  async softDelete(id: string): Promise<AppVersion> {
    return prisma.appVersion.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete
   */
  async delete(id: string): Promise<void> {
    await prisma.appVersion.delete({
      where: { id },
    });
  }

  /**
   * Check if version or versionCode already exists
   */
  async exists(
    version: string,
    versionCode: number,
  ): Promise<{
    versionExists: boolean;
    versionCodeExists: boolean;
  }> {
    const [versionRecord, versionCodeRecord] = await Promise.all([
      prisma.appVersion.findUnique({ where: { version } }),
      prisma.appVersion.findUnique({ where: { versionCode } }),
    ]);

    return {
      versionExists: !!versionRecord,
      versionCodeExists: !!versionCodeRecord,
    };
  }
}
