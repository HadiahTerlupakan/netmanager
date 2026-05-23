import { PrismaClient, Prisma, type AccelPppServer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, decryptApiKey } from "@/lib/utils/encryption";
import { logger } from "@/lib/logger";
import type {
  AccelPppServerCreateData,
  AccelPppServerEntity,
  AccelPppServerFilters,
  AccelPppServerStatusUpdate,
  AccelPppServerUpdateData,
} from "../domain/entities/AccelPppServerEntity";
import type { IAccelPppServerRepository } from "../domain/ports/IAccelPppServerRepository";
import { AccelPppDuplicateIpError } from "../domain/errors/AccelPppErrors";

type AccelPppServerRow = AccelPppServer;

/**
 * Repository accel-ppp server.
 * Why: secrets disimpan dalam bentuk cipher (AES via encryptApiKey) supaya
 * lebih kuat dari pola legacy MikroTik yang menyimpan plain text.
 * How to apply: setiap field rahasia (radiusSecret, cliPassword) di-encrypt
 * di sini sebelum tulis ke DB, dan di-decrypt sebelum entity dilempar keluar.
 */
export class AccelPppServerRepository implements IAccelPppServerRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findAll(tenantId: string | null): Promise<AccelPppServerEntity[]> {
    const rows = await this.client.accelPppServer.findMany({
      where: { tenantId: tenantId ?? null },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findWithFilters(
    filters: AccelPppServerFilters,
    tenantId: string | null,
  ): Promise<AccelPppServerEntity[]> {
    const where: Prisma.AccelPppServerWhereInput = {
      tenantId: tenantId ?? null,
    };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { ipAddress: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.siteId) {
      where.siteId = filters.siteId;
    }

    if (filters.pingStatus) {
      where.pingStatus = filters.pingStatus;
    }

    const rows = await this.client.accelPppServer.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findById(
    id: string,
    tenantId: string | null,
  ): Promise<AccelPppServerEntity | null> {
    const row = await this.client.accelPppServer.findFirst({
      where: { id, tenantId: tenantId ?? null },
    });
    return row ? this.toEntity(row) : null;
  }

  async findByIp(
    ipAddress: string,
    tenantId: string | null,
  ): Promise<AccelPppServerEntity | null> {
    const row = await this.client.accelPppServer.findFirst({
      where: { ipAddress, tenantId: tenantId ?? null },
    });
    return row ? this.toEntity(row) : null;
  }

  async findAllForMonitor(): Promise<AccelPppServerEntity[]> {
    const rows = await this.client.accelPppServer.findMany({
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async create(data: AccelPppServerCreateData): Promise<AccelPppServerEntity> {
    const existing = await this.client.accelPppServer.findFirst({
      where: {
        tenantId: data.tenantId ?? null,
        ipAddress: data.ipAddress,
      },
      select: { id: true },
    });

    if (existing) {
      throw new AccelPppDuplicateIpError(
        `Accel-PPP server dengan IP ${data.ipAddress} sudah terdaftar`,
      );
    }

    const row = await this.client.accelPppServer.create({
      data: {
        name: data.name,
        ipAddress: data.ipAddress,
        description: data.description ?? null,
        nasIdentifier: data.nasIdentifier ?? null,
        radiusSecret: encryptApiKey(data.radiusSecret),
        authPort: data.authPort ?? 1812,
        acctPort: data.acctPort ?? 1813,
        coaPort: data.coaPort ?? 3799,
        cliHost: data.cliHost,
        cliPort: data.cliPort ?? 2001,
        cliPassword: data.cliPassword ? encryptApiKey(data.cliPassword) : null,
        siteId: data.siteId ?? null,
        tenantId: data.tenantId ?? null,
      },
    });

    return this.toEntity(row);
  }

  async update(
    id: string,
    data: AccelPppServerUpdateData,
    tenantId: string | null,
  ): Promise<void> {
    const updatePayload: Prisma.AccelPppServerUncheckedUpdateManyInput = {};

    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.ipAddress !== undefined) updatePayload.ipAddress = data.ipAddress;
    if (data.description !== undefined)
      updatePayload.description = data.description;
    if (data.nasIdentifier !== undefined)
      updatePayload.nasIdentifier = data.nasIdentifier;
    if (data.radiusSecret !== undefined)
      updatePayload.radiusSecret = encryptApiKey(data.radiusSecret);
    if (data.authPort !== undefined) updatePayload.authPort = data.authPort;
    if (data.acctPort !== undefined) updatePayload.acctPort = data.acctPort;
    if (data.coaPort !== undefined) updatePayload.coaPort = data.coaPort;
    if (data.cliHost !== undefined) updatePayload.cliHost = data.cliHost;
    if (data.cliPort !== undefined) updatePayload.cliPort = data.cliPort;
    if (data.cliPassword !== undefined) {
      updatePayload.cliPassword = data.cliPassword
        ? encryptApiKey(data.cliPassword)
        : null;
    }
    if (data.pingStatus !== undefined)
      updatePayload.pingStatus = data.pingStatus;
    if (data.userOnline !== undefined)
      updatePayload.userOnline = data.userOnline;
    if (data.lastStatusCheck !== undefined)
      updatePayload.lastStatusCheck = data.lastStatusCheck;
    if (data.siteId !== undefined) updatePayload.siteId = data.siteId;

    await this.client.accelPppServer.updateMany({
      where: { id, tenantId: tenantId ?? null },
      data: updatePayload,
    });
  }

  async updateStatus(
    id: string,
    status: AccelPppServerStatusUpdate,
  ): Promise<void> {
    await this.client.accelPppServer.update({
      where: { id },
      data: {
        pingStatus: status.pingStatus,
        userOnline: status.userOnline,
        lastStatusCheck: status.lastStatusCheck,
      },
    });
  }

  async delete(id: string, tenantId: string | null): Promise<void> {
    await this.client.accelPppServer.deleteMany({
      where: { id, tenantId: tenantId ?? null },
    });
  }

  async count(tenantId: string | null, siteId?: string): Promise<number> {
    return this.client.accelPppServer.count({
      where: {
        tenantId: tenantId ?? null,
        ...(siteId ? { siteId } : {}),
      },
    });
  }

  /** Map row Prisma ke domain entity dengan auto-decrypt secrets. */
  private toEntity(row: AccelPppServerRow): AccelPppServerEntity {
    return {
      id: row.id,
      name: row.name,
      ipAddress: row.ipAddress,
      description: row.description,
      nasIdentifier: row.nasIdentifier,
      radiusSecret: this.safeDecrypt(row.radiusSecret),
      authPort: row.authPort,
      acctPort: row.acctPort,
      coaPort: row.coaPort,
      cliHost: row.cliHost,
      cliPort: row.cliPort,
      cliPassword: row.cliPassword ? this.safeDecrypt(row.cliPassword) : null,
      pingStatus: row.pingStatus,
      userOnline: row.userOnline,
      lastStatusCheck: row.lastStatusCheck,
      siteId: row.siteId,
      tenantId: row.tenantId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private safeDecrypt(value: string): string {
    try {
      return decryptApiKey(value);
    } catch (error) {
      logger.error("Failed to decrypt accel-ppp secret", { error });
      return value;
    }
  }
}
