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
}

export default RadiusRepository;
