import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import type {
  NetworkAlertCreateData,
  NetworkAlertEntity,
  NetworkAlertFilters,
  NetworkAlertUpdateData,
} from "../domain/entities/NetworkAlertEntity";
import type { INetworkAlertRepository } from "../domain/ports/INetworkAlertRepository";

export class NetworkAlertRepository implements INetworkAlertRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  /** Buat alert jaringan baru. */
  async create(data: NetworkAlertCreateData): Promise<NetworkAlertEntity> {
    return await this.client.networkAlerts.create({
      data: {
        id: randomUUID(),
        ...data,
        alertType: data.alertType as "CRITICAL" | "WARNING" | "INFO",
        severity: data.severity as "CRITICAL" | "WARNING" | "INFO",
        autoResolve: data.autoResolve || false,
        updatedAt: new Date(),
      },
    });
  }

  /** Ambil alert berdasarkan id. */
  async findById(id: string): Promise<NetworkAlertEntity | null> {
    return await this.client.networkAlerts.findUnique({
      where: { id },
    });
  }

  /** Ambil daftar alert aktif berdasarkan filter. */
  async findMany(filters: NetworkAlertFilters = {}) {
    const where: Prisma.NetworkAlertsWhereInput = { isActive: true };

    if (filters.deviceId) where.deviceId = filters.deviceId;
    if (filters.deviceType) where.deviceType = filters.deviceType;
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.alertType) where.alertType = filters.alertType;
    if (filters.acknowledged !== undefined)
      where.acknowledged = filters.acknowledged;
    if (filters.resolved !== undefined) where.resolved = filters.resolved;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;
    const orderBy: Prisma.NetworkAlertsOrderByWithRelationInput = {};

    if (filters.sortBy) {
      (orderBy as Record<string, unknown>)[filters.sortBy] =
        filters.sortOrder || "desc";
    } else {
      orderBy.createdAt = "desc";
    }

    const [data, total] = await Promise.all([
      this.client.networkAlerts.findMany({ where, orderBy, skip, take: limit }),
      this.client.networkAlerts.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Ubah data alert jaringan. */
  async update(
    id: string,
    data: NetworkAlertUpdateData,
  ): Promise<NetworkAlertEntity> {
    const updateData: Prisma.NetworkAlertsUpdateInput = {
      ...data,
      severity: data.severity as "CRITICAL" | "WARNING" | "INFO" | undefined,
      status: data.status as
        | "ACTIVE"
        | "ACKNOWLEDGED"
        | "RESOLVED"
        | "SUPPRESSED"
        | undefined,
    };

    if (data.acknowledged && !data.acknowledgedBy) {
      updateData.acknowledgedAt = new Date();
    }

    if (data.resolved && !data.resolvedBy) {
      updateData.resolvedAt = new Date();
    }

    return await this.client.networkAlerts.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
  }

  /** Tandai alert sebagai acknowledged. */
  async acknowledge(id: string, userId: string): Promise<NetworkAlertEntity> {
    return await this.client.networkAlerts.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  /** Tandai alert sebagai resolved. */
  async resolve(id: string, userId: string): Promise<NetworkAlertEntity> {
    return await this.client.networkAlerts.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: userId,
        resolvedAt: new Date(),
      },
    });
  }

  /** Hapus alert berdasarkan id. */
  async delete(id: string): Promise<NetworkAlertEntity> {
    return await this.client.networkAlerts.delete({
      where: { id },
    });
  }

  /** Ambil seluruh alert aktif untuk device tertentu. */
  async getActiveAlerts(
    deviceId?: string,
    deviceType?: string,
  ): Promise<NetworkAlertEntity[]> {
    const where: Prisma.NetworkAlertsWhereInput = {
      status: "ACTIVE",
      isActive: true,
    };

    if (deviceId) where.deviceId = deviceId;
    if (deviceType) where.deviceType = deviceType;

    return await this.client.networkAlerts.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Nonaktifkan alert lama yang sudah resolved. */
  async cleanupOldAlerts(
    olderThanDays: number = 90,
  ): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return await this.client.networkAlerts.updateMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: ["RESOLVED"] },
      },
      data: { isActive: false },
    });
  }

  /** Hitung alert aktif berdasarkan filter. */
  async count(filters: NetworkAlertFilters = {}): Promise<number> {
    const where: Prisma.NetworkAlertsWhereInput = { isActive: true };

    if (filters.deviceId) where.deviceId = filters.deviceId;
    if (filters.deviceType) where.deviceType = filters.deviceType;
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.alertType) where.alertType = filters.alertType;
    if (filters.acknowledged !== undefined)
      where.acknowledged = filters.acknowledged;
    if (filters.resolved !== undefined) where.resolved = filters.resolved;

    return await this.client.networkAlerts.count({ where });
  }
}
