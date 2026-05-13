import { prisma as defaultPrisma } from "@/lib/prisma";
import type { IRadiusRepository } from "../domain/ports/IRadiusRepository";
import { RadiusSyncRepository } from "./RadiusSyncRepository";
import { RadiusRepositoryBase } from "./radius-repository.base";

type PrismaInstance = typeof defaultPrisma;

export class RadiusRepository
  extends RadiusRepositoryBase
  implements IRadiusRepository
{
  private readonly syncRepository: RadiusSyncRepository;

  constructor(
    protected override prisma: PrismaInstance = defaultPrisma,
    radiusClient?: typeof import("@/lib/prisma-radius").prismaRadius,
  ) {
    super(prisma, radiusClient);
    this.syncRepository = new RadiusSyncRepository(
      this.prisma,
      this.radiusClient,
      this,
    );
  }

  /** Sync single pelanggan to RADIUS. */
  async syncPelangganToRadius(pelangganId: string): Promise<void> {
    return this.syncRepository.syncPelangganToRadius(pelangganId);
  }

  /** Sync Package settings to RADIUS. */
  async syncPackageToRadius(packageId: string): Promise<void> {
    return this.syncRepository.syncPackageToRadius(packageId);
  }

  /** Sync all packages using a specific bandwidth to RADIUS. */
  async syncBandwidthToRadius(bandwidthId: string): Promise<void> {
    return this.syncRepository.syncBandwidthToRadius(bandwidthId);
  }

  /** Sync all packages using a specific profile to RADIUS. */
  async syncProfileToRadius(profileId: string): Promise<void> {
    return this.syncRepository.syncProfileToRadius(profileId);
  }

  /** Sync all packages to RADIUS. */
  async syncAllPackagesToRadius(tenantId?: string): Promise<void> {
    return this.syncRepository.syncAllPackagesToRadius(tenantId);
  }

  /** Sync all active customers to RADIUS. */
  async syncAllActiveCustomers(
    tenantId?: string,
  ): Promise<{ created: number; updated: number; deleted: number }> {
    return this.syncRepository.syncAllActiveCustomers(tenantId);
  }

  override async syncIpPoolToRadius(
    poolName: string,
    ipRange: string,
    tenantId: string,
  ): Promise<void> {
    await this.ipPoolRepository.syncIpPoolToRadius(poolName, ipRange, tenantId);
  }

  /** Find RADIUS usernames that have no matching pelanggan record. */
  async findOrphanUsernames(tenantId: string): Promise<string[]> {
    const radcheckUsers = await this.radiusClient.radcheck.findMany({
      where: { tenantId, attribute: "Cleartext-Password" },
      select: { username: true },
      distinct: ["username"],
    });

    if (radcheckUsers.length === 0) return [];

    const usernames = radcheckUsers.map((r) => r.username);

    const existingPelanggans = await this.prisma.pelanggan.findMany({
      where: {
        username: { in: usernames },
        OR: [{ tenantId }, { tenantId: null }],
      },
      select: { username: true },
    });

    const existingSet = new Set(existingPelanggans.map((p) => p.username));
    return usernames.filter((u) => !existingSet.has(u));
  }

  /** Delete multiple orphan RADIUS users in bulk and close their active sessions. */
  async deleteOrphanUsers(
    usernames: string[],
    tenantId: string,
  ): Promise<number> {
    if (usernames.length === 0) return 0;

    const now = new Date();
    const [checkResult] = await this.radiusClient.$transaction([
      this.radiusClient.radcheck.deleteMany({
        where: { username: { in: usernames }, tenantId },
      }),
      this.radiusClient.radreply.deleteMany({
        where: { username: { in: usernames }, tenantId },
      }),
      this.radiusClient.radusergroup.deleteMany({
        where: { username: { in: usernames }, tenantId },
      }),
      this.radiusClient.radacct.updateMany({
        where: {
          username: { in: usernames },
          tenantId,
          acctstoptime: null,
        },
        data: {
          acctstoptime: now,
          acctterminatecause: "Admin-Reset",
        },
      }),
    ]);

    return checkResult.count;
  }
}

export default RadiusRepository;
