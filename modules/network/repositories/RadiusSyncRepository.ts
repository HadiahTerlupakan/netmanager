import type { PrismaInstance, RadiusSyncOperations } from "./radius-sync.types";
import { MIKROTIK_RATE_LIMIT_ATTRIBUTE } from "./radiusRepository.constants";
import { RadiusSyncPackageGroupService } from "./radius-sync.package-groups";

type RadiusClient = {
  radreply: {
    deleteMany(input: {
      where: { username?: string; attribute: string; tenantId: string };
    }): Promise<unknown>;
  };
};

type PelangganWithPackage = Awaited<
  ReturnType<RadiusSyncRepository["findPelangganWithPackage"]>
>;

export class RadiusSyncRepository {
  private readonly packageGroupService: RadiusSyncPackageGroupService;

  constructor(
    private readonly prisma: PrismaInstance,
    private readonly radiusClient: RadiusClient,
    private readonly operations: RadiusSyncOperations,
  ) {
    this.packageGroupService = new RadiusSyncPackageGroupService(
      this.operations,
      this,
    );
  }

  async syncPelangganToRadius(pelangganId: string): Promise<void> {
    const pelanggan = await this.findPelangganWithPackage(pelangganId);
    if (!pelanggan) throw new Error(`Pelanggan ${pelangganId} not found`);
    if (!pelanggan.tenantId) {
      throw new Error(`Pelanggan ${pelangganId} does not have a tenantId`);
    }

    if (this.shouldDeleteRadiusUser(pelanggan.status)) {
      await this.operations.deleteRadiusUser(
        pelanggan.username,
        pelanggan.tenantId,
      );
      return;
    }

    await this.ensureRadiusUser(pelanggan);
    await this.removeUserBandwidth(pelanggan.username, pelanggan.tenantId);
    if (this.shouldAssignGroups(pelanggan.status)) {
      await this.syncPelangganGroups(pelanggan);
    }
  }

  async syncPackageToRadius(packageId: string): Promise<void> {
    const pkg = await this.findPackageWithRadiusSettings(packageId);
    if (!pkg?.tenantId) return;

    await this.packageGroupService.syncPackageBandwidth(pkg);
    await this.packageGroupService.syncPackageProfile(pkg);
  }

  async syncBandwidthToRadius(bandwidthId: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      where: { bandwidthId },
    });
    for (const pkg of packages) {
      await this.syncPackageToRadius(pkg.id);
    }
  }

  async syncProfileToRadius(profileId: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      where: { profilePPPId: profileId },
    });
    for (const pkg of packages) {
      await this.syncPackageToRadius(pkg.id);
    }
  }

  async syncAllPackagesToRadius(tenantId?: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      ...(tenantId && { where: { tenantId } }),
    });
    for (const pkg of packages) {
      await this.syncPackageToRadius(pkg.id);
    }
  }

  async syncAllActiveCustomers(
    tenantId?: string,
  ): Promise<{ created: number; updated: number; deleted: number }> {
    await this.syncAllPackagesToRadius(tenantId);
    const pelanggans = await this.findPelanggansForSync(tenantId);
    const result = { created: 0, updated: 0, deleted: 0 };

    for (const pelanggan of pelanggans) {
      await this.syncCustomerAndCount(pelanggan, result);
    }

    return result;
  }

  async findPelangganWithPackage(pelangganId: string) {
    return this.prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: { hargaPaket: { include: { bandwidth: true } } },
    });
  }

  async findPackageWithRadiusSettings(packageId: string) {
    return this.prisma.hargaPaket.findUnique({
      where: { id: packageId },
      include: { bandwidth: true, profilePPP: true },
    });
  }

  async findPelanggansForSync(tenantId?: string) {
    return this.prisma.pelanggan.findMany({
      where: {
        status: { in: ["AKTIF", "ISOLIR", "NONAKTIF"] },
        ...(tenantId && { tenantId }),
      },
      include: { hargaPaket: { include: { bandwidth: true } } },
    });
  }

  private shouldDeleteRadiusUser(status: string) {
    return status === "NONAKTIF" || status === "BLOCKED";
  }

  private shouldAssignGroups(status: string) {
    return status === "AKTIF" || status === "ISOLIR";
  }

  private async ensureRadiusUser(pelanggan: NonNullable<PelangganWithPackage>) {
    const exists = await this.operations.userExists(
      pelanggan.username,
      pelanggan.tenantId!,
    );

    if (!exists) {
      await this.operations.createRadiusUser(
        { username: pelanggan.username, password: pelanggan.password },
        pelanggan.tenantId!,
      );
      return;
    }

    await this.operations.updateRadiusPassword(
      pelanggan.username,
      pelanggan.password,
      pelanggan.tenantId!,
    );
  }

  private async removeUserBandwidth(username: string, tenantId: string) {
    await this.radiusClient.radreply.deleteMany({
      where: {
        username,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        tenantId,
      },
    });
  }

  private async syncPelangganGroups(
    pelanggan: NonNullable<PelangganWithPackage>,
  ) {
    const desiredGroups: string[] = [];

    if (pelanggan.hargaPaket) {
      await this.packageGroupService.assignPackageGroup(
        pelanggan,
        desiredGroups,
      );
    }
    if (pelanggan.status === "ISOLIR") {
      await this.packageGroupService.assignIsolirGroup(
        pelanggan,
        desiredGroups,
      );
    }
    await this.packageGroupService.syncUserGroups(
      pelanggan.username,
      pelanggan.tenantId!,
      desiredGroups,
    );
  }

  private async syncCustomerAndCount(
    pelanggan: {
      id: string;
      username: string;
      status: string;
      tenantId: string | null;
    },
    result: { created: number; updated: number; deleted: number },
  ) {
    if (!pelanggan.tenantId) return;

    const exists = await this.operations.userExists(
      pelanggan.username,
      pelanggan.tenantId,
    );

    if (this.shouldAssignGroups(pelanggan.status)) {
      if (exists) result.updated += 1;
      else result.created += 1;
      await this.syncPelangganToRadius(pelanggan.id);
      return;
    }

    if (!this.shouldDeleteRadiusUser(pelanggan.status) || !exists) {
      return;
    }

    result.deleted += 1;
    await this.syncPelangganToRadius(pelanggan.id);
  }
}

export default RadiusSyncRepository;
