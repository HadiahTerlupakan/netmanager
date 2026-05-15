import { prismaAuth as prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

import type {
  AppUpdate,
  AppUpdateAsset,
  AppUpdateChannel,
  AppUpdatePlatform,
  CreateAppUpdateDTO,
} from "../domain/entities/AppUpdateEntity";
import type { IAppUpdateRepository } from "../domain/ports/IAppUpdateRepository";

const APP_UPDATE_CACHE_TTL = 30 * 1000;

interface CachedManifest {
  data: AppUpdate | null;
  expiresAt: number;
}

const manifestCache = new Map<string, CachedManifest>();

function buildManifestCacheKey(query: {
  channel: AppUpdateChannel;
  runtimeVersion: string;
  platform: AppUpdatePlatform;
}): string {
  return `${query.channel}:${query.runtimeVersion}:${query.platform}`;
}

export function clearAppUpdateCache(): void {
  manifestCache.clear();
}

export class AppUpdateRepository implements IAppUpdateRepository {
  async findLatestActive(query: {
    channel: AppUpdateChannel;
    runtimeVersion: string;
    platform: AppUpdatePlatform;
  }): Promise<AppUpdate | null> {
    const cacheKey = buildManifestCacheKey(query);
    const cached = manifestCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const result = await prisma.appUpdate.findFirst({
      where: {
        channel: query.channel,
        runtimeVersion: query.runtimeVersion,
        platform: query.platform,
        isActive: true,
      },
      orderBy: { commitTime: "desc" },
    });

    const mapped = result ? mapToAppUpdate(result) : null;
    manifestCache.set(cacheKey, {
      data: mapped,
      expiresAt: Date.now() + APP_UPDATE_CACHE_TTL,
    });
    return mapped;
  }

  async findAll(options?: {
    channel?: AppUpdateChannel;
    platform?: AppUpdatePlatform;
    page?: number;
    limit?: number;
  }): Promise<{ data: AppUpdate[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AppUpdateWhereInput = {};
    if (options?.channel) where.channel = options.channel;
    if (options?.platform) where.platform = options.platform;

    const [rows, total] = await Promise.all([
      prisma.appUpdate.findMany({
        where,
        orderBy: { commitTime: "desc" },
        skip,
        take: limit,
      }),
      prisma.appUpdate.count({ where }),
    ]);

    return { data: rows.map(mapToAppUpdate), total };
  }

  async findById(id: string): Promise<AppUpdate | null> {
    const result = await prisma.appUpdate.findUnique({ where: { id } });
    return result ? mapToAppUpdate(result) : null;
  }

  async create(data: CreateAppUpdateDTO): Promise<AppUpdate> {
    const created = await prisma.appUpdate.create({
      data: {
        manifestId: data.manifestId,
        channel: data.channel,
        runtimeVersion: data.runtimeVersion,
        platform: data.platform,
        bundleHash: data.bundleHash,
        bundlePath: data.bundlePath,
        bundleSize: data.bundleSize,
        assets: data.assets as unknown as Prisma.InputJsonValue,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        signature: data.signature ?? null,
        signatureKeyId: data.signatureKeyId ?? null,
        releaseNotes: data.releaseNotes ?? null,
        commitTime: data.commitTime,
        isActive: data.isActive ?? true,
        tenantId: data.tenantId ?? null,
        createdBy: data.createdBy ?? null,
      },
    });
    clearAppUpdateCache();
    return mapToAppUpdate(created);
  }

  async setActive(id: string, isActive: boolean): Promise<AppUpdate> {
    const updated = await prisma.appUpdate.update({
      where: { id },
      data: { isActive },
    });
    clearAppUpdateCache();
    return mapToAppUpdate(updated);
  }

  async delete(id: string): Promise<void> {
    await prisma.appUpdate.delete({ where: { id } });
    clearAppUpdateCache();
  }
}

type PrismaAppUpdate = Awaited<ReturnType<typeof prisma.appUpdate.findUnique>>;

function mapToAppUpdate(row: NonNullable<PrismaAppUpdate>): AppUpdate {
  return {
    id: row.id,
    manifestId: row.manifestId,
    channel: row.channel,
    runtimeVersion: row.runtimeVersion,
    platform: row.platform,
    bundleHash: row.bundleHash,
    bundlePath: row.bundlePath,
    bundleSize: row.bundleSize,
    assets: row.assets as unknown as AppUpdateAsset[],
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    signature: row.signature,
    signatureKeyId: row.signatureKeyId,
    releaseNotes: row.releaseNotes,
    commitTime: row.commitTime,
    isActive: row.isActive,
    tenantId: row.tenantId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
