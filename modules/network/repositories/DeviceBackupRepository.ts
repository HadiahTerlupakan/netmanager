import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type {
  ConfigurationRestoreEntity,
  CreateConfigurationRestoreEntityInput,
  CreateDeviceBackupEntityInput,
  DeviceBackupEntity,
  DeviceBackupListFilters,
  DeviceBackupListResultEntity,
} from "../domain/entities/DeviceBackupEntity";
import type { IDeviceBackupRepository } from "../domain/ports/IDeviceBackupRepository";

const EMPTY_PAGINATION_TOTAL = 0;

export class DeviceBackupRepository implements IDeviceBackupRepository {
  /** List device backups with pagination and filters. */
  async findMany(
    filters: DeviceBackupListFilters,
  ): Promise<DeviceBackupListResultEntity> {
    const where = this.createWhereInput(filters);
    const page = filters.page;
    const limit = filters.limit;
    const [data, total] = await Promise.all([
      prisma.deviceBackups.findMany({
        where,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deviceBackups.count({ where }),
    ]);

    return {
      data: data.map((backup) => this.toDeviceBackupEntity(backup)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Find a device backup by id. */
  async findById(id: string): Promise<DeviceBackupEntity | null> {
    const backup = await prisma.deviceBackups.findUnique({ where: { id } });
    return backup ? this.toDeviceBackupEntity(backup) : null;
  }

  /** Create a device backup record. */
  async create(
    input: CreateDeviceBackupEntityInput,
  ): Promise<DeviceBackupEntity> {
    const backup = await prisma.deviceBackups.create({
      data: this.toCreateInput(input),
    });
    return this.toDeviceBackupEntity(backup);
  }

  /** Delete a device backup by id. */
  async delete(id: string): Promise<void> {
    await prisma.deviceBackups.delete({ where: { id } });
  }

  /** Create a configuration restore record. */
  async createRestore(
    input: CreateConfigurationRestoreEntityInput,
  ): Promise<ConfigurationRestoreEntity> {
    const restore = await prisma.configurationRestores.create({
      data: this.toRestoreCreateInput(input),
    });
    return this.toConfigurationRestoreEntity(restore);
  }

  private createWhereInput(
    filters: DeviceBackupListFilters,
  ): Prisma.DeviceBackupsWhereInput {
    return {
      ...(filters.deviceId ? { deviceId: filters.deviceId } : {}),
      ...(filters.deviceType ? { deviceType: filters.deviceType } : {}),
      ...(filters.backupType ? { backupType: filters.backupType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...this.createDateFilter(filters),
    };
  }

  private createDateFilter(
    filters: DeviceBackupListFilters,
  ): Prisma.DeviceBackupsWhereInput {
    if (!filters.startDate && !filters.endDate) {
      return {};
    }

    return {
      createdAt: {
        ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
        ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
      },
    };
  }

  private toCreateInput(
    input: CreateDeviceBackupEntityInput,
  ): Prisma.DeviceBackupsCreateInput {
    return {
      id: randomUUID(),
      deviceId: input.deviceId,
      deviceType: input.deviceType,
      backupName: input.backupName,
      description: input.description ?? null,
      backupType: input.backupType,
      filePath: input.filePath,
      fileSize: input.fileSize,
      fileHash: input.fileHash ?? null,
      compressionType: input.compressionType ?? null,
      isEncrypted: input.isEncrypted,
      encryptionKey: input.encryptionKey ?? null,
      backupMethod: input.backupMethod ?? null,
      status: input.status,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdBy: input.createdBy,
      retentionDays: input.retentionDays ?? null,
      isAutoCleanup: input.isAutoCleanup,
      updatedAt: new Date(),
    };
  }

  private toRestoreCreateInput(
    input: CreateConfigurationRestoreEntityInput,
  ): Prisma.ConfigurationRestoresUncheckedCreateInput {
    return {
      id: randomUUID(),
      deviceId: input.deviceId,
      deviceType: input.deviceType,
      backupId: input.backupId,
      restoreName: input.restoreName,
      description: input.description,
      restoreMethod: input.restoreMethod,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      rollbackEnabled: input.rollbackEnabled || false,
      createdBy: input.createdBy,
      updatedAt: new Date(),
    };
  }

  private toDeviceBackupEntity(
    backup: Prisma.DeviceBackupsGetPayload<object>,
  ): DeviceBackupEntity {
    return { ...backup };
  }

  private toConfigurationRestoreEntity(
    restore: Prisma.ConfigurationRestoresGetPayload<object>,
  ): ConfigurationRestoreEntity {
    return { ...restore };
  }

  static createEmptyList(
    page: number,
    limit: number,
  ): DeviceBackupListResultEntity {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: EMPTY_PAGINATION_TOTAL,
        totalPages: EMPTY_PAGINATION_TOTAL,
      },
      message: "Device backups will be available after database migration",
    };
  }
}
