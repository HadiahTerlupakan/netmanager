import { buildMikrotikRateLimit } from "../utils/radius-rate-limit";
import {
  EXPIRED_USERS_PROFILE,
  FRAMED_POOL_ATTRIBUTE,
  GROUP_REPLY_ASSIGN_OP,
  ISOLIR_GROUP_PRIORITY,
  MIKROTIK_GROUP_ATTRIBUTE,
  MIKROTIK_RATE_LIMIT_ATTRIBUTE,
  PACKAGE_GROUP_PRIORITY,
  POOL_NAME_ATTRIBUTE,
} from "./radiusRepository.constants";
import type { RadiusSyncOperations } from "./radius-sync.types";

type PackageWithRadiusSettings = {
  id: string;
  tenantId: string | null;
  profilePPP?: {
    name: string;
    remoteAddress: string | null;
  } | null;
  bandwidth?: {
    maxLimitUpload: string;
    maxLimitDownload: string;
    burstLimitUpload: string | null;
    burstLimitDownload: string | null;
    burstThresholdUpload: string | null;
    burstThresholdDownload: string | null;
    burstTimeUpload: number | null;
    burstTimeDownload: number | null;
    priority: number | null;
    minLimitUpload: string | null;
    minLimitDownload: string | null;
  } | null;
};

type PackageGroupCustomer = {
  username: string;
  tenantId: string;
  hargaPaket?: { id: string } | null;
  status?: string;
};

type RadiusSyncRepositoryLike = {
  syncPackageToRadius(packageId: string): Promise<void>;
};

export class RadiusSyncPackageGroupService {
  constructor(
    private readonly operations: RadiusSyncOperations,
    private readonly repository: RadiusSyncRepositoryLike,
  ) {}

  async syncUserGroups(
    username: string,
    tenantId: string,
    desiredGroups: string[],
  ) {
    const existingGroups = await this.operations.getUserGroups(
      username,
      tenantId,
    );
    const desiredGroupSet = new Set(desiredGroups);

    for (const groupname of existingGroups) {
      if (!desiredGroupSet.has(groupname)) {
        await this.operations.removeUserFromGroup(
          username,
          groupname,
          tenantId,
        );
      }
    }
  }

  async assignPackageGroup(
    pelanggan: PackageGroupCustomer,
    desiredGroups: string[],
  ) {
    const packageId = pelanggan.hargaPaket!.id;
    await this.repository.syncPackageToRadius(packageId);
    await this.operations.assignUserToGroup(
      pelanggan.username,
      packageId,
      pelanggan.tenantId,
      PACKAGE_GROUP_PRIORITY,
    );
    desiredGroups.push(packageId);
  }

  async assignIsolirGroup(
    pelanggan: { username: string; tenantId: string },
    desiredGroups: string[],
  ) {
    await this.operations.setGroupAttribute(
      "ISOLIR",
      MIKROTIK_GROUP_ATTRIBUTE,
      EXPIRED_USERS_PROFILE,
      pelanggan.tenantId,
    );
    await this.operations.removeGroupAttribute(
      "ISOLIR",
      MIKROTIK_RATE_LIMIT_ATTRIBUTE,
      pelanggan.tenantId,
    );
    await this.operations.assignUserToGroup(
      pelanggan.username,
      "ISOLIR",
      pelanggan.tenantId,
      ISOLIR_GROUP_PRIORITY,
    );
    desiredGroups.push("ISOLIR");
  }

  async syncPackageBandwidth(pkg: PackageWithRadiusSettings) {
    if (pkg.bandwidth) {
      await this.operations.setGroupBandwidth(
        pkg.id,
        buildMikrotikRateLimit(pkg.bandwidth),
        pkg.tenantId!,
      );
      return;
    }

    await this.operations.removeGroupAttribute(
      pkg.id,
      MIKROTIK_RATE_LIMIT_ATTRIBUTE,
      pkg.tenantId!,
    );
  }

  async syncPackageProfile(pkg: PackageWithRadiusSettings) {
    if (pkg.profilePPP) {
      await this.syncExistingPackageProfile(
        pkg as PackageWithRadiusSettings & {
          profilePPP: NonNullable<PackageWithRadiusSettings["profilePPP"]>;
        },
      );
      return;
    }

    await this.clearPackageProfile(pkg.id, pkg.tenantId!);
  }

  private async syncExistingPackageProfile(
    pkg: PackageWithRadiusSettings & {
      profilePPP: NonNullable<PackageWithRadiusSettings["profilePPP"]>;
    },
  ) {
    await this.operations.setGroupAttribute(
      pkg.id,
      MIKROTIK_GROUP_ATTRIBUTE,
      pkg.profilePPP.name,
      pkg.tenantId!,
    );

    await this.syncPackagePool(pkg);
  }

  private async syncPackagePool(pkg: PackageWithRadiusSettings) {
    const poolName = pkg.profilePPP?.remoteAddress?.trim();
    if (!poolName) {
      await this.operations.removeGroupAttribute(
        pkg.id,
        FRAMED_POOL_ATTRIBUTE,
        pkg.tenantId!,
      );
      await this.operations.removeGroupCheckAttribute(
        pkg.id,
        POOL_NAME_ATTRIBUTE,
        pkg.tenantId!,
      );
      return;
    }

    await this.operations.setGroupAttribute(
      pkg.id,
      FRAMED_POOL_ATTRIBUTE,
      poolName,
      pkg.tenantId!,
    );
    await this.operations.setGroupCheckAttribute(
      pkg.id,
      POOL_NAME_ATTRIBUTE,
      poolName,
      pkg.tenantId!,
      GROUP_REPLY_ASSIGN_OP,
    );
  }

  async clearPackageProfile(packageId: string, tenantId: string) {
    await this.operations.removeGroupAttribute(
      packageId,
      MIKROTIK_GROUP_ATTRIBUTE,
      tenantId,
    );
    await this.operations.removeGroupAttribute(
      packageId,
      FRAMED_POOL_ATTRIBUTE,
      tenantId,
    );
    await this.operations.removeGroupCheckAttribute(
      packageId,
      POOL_NAME_ATTRIBUTE,
      tenantId,
    );
  }
}
