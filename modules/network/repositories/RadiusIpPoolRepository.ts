import { prismaRadius } from "@/lib/prisma-radius";
import { parseIpRange } from "@/lib/utils/ip-helpers";
import type { RadIpPoolEntity } from "../domain/entities/RadiusEntity";
import {
  getExpiredPoolTimestamp,
  isAllocatedIpPoolEntry,
} from "./radiusRepository.helpers";
import { toRadIpPoolEntity } from "./radiusRepository.mappers";

export class RadiusIpPoolRepository {
  constructor(
    private readonly radiusClient: typeof prismaRadius = prismaRadius,
  ) {}

  async addToIpPool(
    pool: RadIpPoolEntity,
    tenantId: string,
  ): Promise<RadIpPoolEntity> {
    const created = await this.radiusClient.radippool.create({
      data: {
        pool_name: pool.poolName,
        framedipaddress: pool.framedIpAddress,
        nasipaddress: pool.nasIpAddress || "",
        pool_key: pool.poolKey || "",
        username: "",
        callingstationid: "",
        calledstationid: "",
        tenantId,
      },
    });

    return toRadIpPoolEntity(created);
  }

  async removeFromIpPool(ipAddress: string, tenantId: string): Promise<void> {
    await this.radiusClient.radippool.deleteMany({
      where: { framedipaddress: ipAddress, tenantId },
    });
  }

  async getIpFromPool(
    poolName: string,
    tenantId: string,
    nasipaddress?: string,
  ): Promise<string | null> {
    const availableIp = await this.radiusClient.radippool.findFirst({
      where: {
        pool_name: poolName,
        tenantId,
        nasipaddress: nasipaddress || null,
      },
    });

    return availableIp?.framedipaddress || null;
  }

  async returnIpToPool(ipAddress: string, tenantId: string): Promise<void> {
    await this.radiusClient.radippool.updateMany({
      where: { framedipaddress: ipAddress, tenantId },
      data: {
        nasipaddress: null,
        pool_key: null,
      },
    });
  }

  async getIpPoolStats(
    tenantId: string,
    poolName?: string,
  ): Promise<{ total: number; used: number; available: number }> {
    const whereClause = poolName
      ? { pool_name: poolName, tenantId }
      : { tenantId };

    const total = await this.radiusClient.radippool.count({
      where: whereClause,
    });
    const used = await this.radiusClient.radippool.count({
      where: {
        ...whereClause,
        nasipaddress: { not: null },
      },
    });

    return { total, used, available: total - used };
  }

  async getAllIpPools(tenantId: string): Promise<RadIpPoolEntity[]> {
    const pools = await this.radiusClient.radippool.findMany({
      where: { tenantId },
      orderBy: [{ pool_name: "asc" }, { framedipaddress: "asc" }],
    });

    return pools.map(toRadIpPoolEntity);
  }

  async syncIpPoolToRadius(
    poolName: string,
    ipRange: string,
    tenantId: string,
  ): Promise<void> {
    const ips = ipRange ? parseIpRange(ipRange) : [];
    const desiredIps = new Set(ips);
    const existingEntries = await this.radiusClient.radippool.findMany({
      where: {
        pool_name: poolName,
        tenantId,
      },
    });

    const staleAvailableIps = existingEntries
      .filter((entry) => !desiredIps.has(entry.framedipaddress))
      .filter((entry) => !isAllocatedIpPoolEntry(entry))
      .map((entry) => entry.framedipaddress);

    if (staleAvailableIps.length > 0) {
      await this.radiusClient.radippool.deleteMany({
        where: {
          pool_name: poolName,
          framedipaddress: { in: staleAvailableIps },
          tenantId,
          nasipaddress: "",
          pool_key: "",
          username: "",
        },
      });
    }

    const existingIpSet = new Set(
      existingEntries.map((entry) => entry.framedipaddress),
    );
    const missingIps = ips.filter((ip) => !existingIpSet.has(ip));
    if (missingIps.length === 0) return;

    const pastTime = getExpiredPoolTimestamp();
    await this.radiusClient.radippool.createMany({
      data: missingIps.map((ip) => ({
        pool_name: poolName,
        framedipaddress: ip,
        nasipaddress: "",
        calledstationid: "",
        callingstationid: "",
        username: "",
        pool_key: "",
        expiry_time: pastTime,
        tenantId,
      })),
      skipDuplicates: true,
    });
  }
}
