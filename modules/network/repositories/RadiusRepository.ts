import { prismaRadius } from "@/lib/prisma-radius";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type {
  DashboardStatsEntity,
  NasEntity,
  RadIpPoolEntity,
  RadiusAccountingStatsEntity,
  RadiusBandwidthEntity,
  RadiusSessionEntity,
  RadiusSessionHistoryOptionsEntity,
  RadiusSessionHistoryResultEntity,
  RadiusSessionTotalsEntity,
  RadiusSessionViewEntity,
  RadiusUserEntity,
} from "../domain/entities/RadiusEntity";
import type { IRadiusRepository } from "../domain/ports/IRadiusRepository";
import { parseIpRange } from "@/lib/utils/ip-helpers";
import {
  buildMikrotikRateLimit,
  parseRadiusRateLimitMbps,
  toRadiusRateLimitMbps,
} from "../utils/radius-rate-limit";

type PrismaInstance = typeof defaultPrisma;

export class RadiusRepository implements IRadiusRepository {
  private radiusClient: typeof prismaRadius;
  constructor(
    private prisma: PrismaInstance = defaultPrisma,
    radiusClient?: typeof prismaRadius,
  ) {
    this.radiusClient = radiusClient || prismaRadius;
  }

  /**
   * Create RADIUS user with authentication credentials
   */
  async createRadiusUser(
    data: RadiusUserEntity,
    tenantId: string,
  ): Promise<void> {
    // Create authentication entry in radcheck
    await this.radiusClient.radcheck.create({
      data: {
        username: data.username,
        attribute: "Cleartext-Password",
        op: ":=",
        value: data.password,
        tenantId,
      },
    });

    // Assign to group if specified
    if (data.groupname) {
      await this.assignUserToGroup(data.username, data.groupname, tenantId);
    }
  }

  /**
   * Update user password
   */
  async updateRadiusPassword(
    username: string,
    password: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radcheck.updateMany({
      where: {
        username,
        attribute: "Cleartext-Password",
        tenantId,
      },
      data: {
        value: password,
      },
    });
  }

  /**
   * Delete RADIUS user and all related records
   */
  async deleteRadiusUser(username: string, tenantId: string): Promise<void> {
    await this.radiusClient.$transaction([
      this.radiusClient.radcheck.deleteMany({ where: { username, tenantId } }),
      this.radiusClient.radreply.deleteMany({ where: { username, tenantId } }),
      this.radiusClient.radusergroup.deleteMany({
        where: { username, tenantId },
      }),
    ]);
  }

  /**
   * Check if user exists in RADIUS
   */
  async userExists(username: string, tenantId: string): Promise<boolean> {
    const count = await this.radiusClient.radcheck.count({
      where: {
        username,
        attribute: "Cleartext-Password",
        tenantId,
      },
    });
    return count > 0;
  }

  /**
   * Set user bandwidth using Mikrotik-Rate-Limit attribute
   * Format: "upload/download" in bits per second
   */
  async setUserBandwidth(
    username: string,
    bandwidth: RadiusBandwidthEntity,
    tenantId: string,
  ): Promise<void> {
    const rateLimit = toRadiusRateLimitMbps(bandwidth);

    // Delete existing bandwidth entries
    await this.radiusClient.radreply.deleteMany({
      where: {
        username,
        attribute: "Mikrotik-Rate-Limit",
        tenantId,
      },
    });

    // Create new bandwidth entry
    await this.radiusClient.radreply.create({
      data: {
        username,
        attribute: "Mikrotik-Rate-Limit",
        op: ":=",
        value: rateLimit,
        tenantId,
      },
    });
  }

  /**
   * Get user bandwidth settings
   */
  async getUserBandwidth(
    username: string,
    tenantId: string,
  ): Promise<RadiusBandwidthEntity | null> {
    const reply = await this.radiusClient.radreply.findFirst({
      where: {
        username,
        attribute: "Mikrotik-Rate-Limit",
        tenantId,
      },
    });

    if (!reply) return null;

    return parseRadiusRateLimitMbps(reply.value);
  }

  /**
   * Set group bandwidth using Mikrotik-Rate-Limit attribute in radgroupreply
   */
  async setGroupBandwidth(
    groupname: string,
    bandwidth: string | RadiusBandwidthEntity,
    tenantId: string,
  ): Promise<void> {
    const rateLimit =
      typeof bandwidth === "string"
        ? bandwidth
        : toRadiusRateLimitMbps(bandwidth);

    // Delete existing bandwidth entries for the group
    await this.radiusClient.radgroupreply.deleteMany({
      where: {
        groupname,
        attribute: "Mikrotik-Rate-Limit",
        tenantId,
      },
    });

    // Create new bandwidth entry in radgroupreply
    await this.radiusClient.radgroupreply.create({
      data: {
        groupname,
        attribute: "Mikrotik-Rate-Limit",
        op: ":=",
        value: rateLimit,
        tenantId,
      },
    });
  }

  /**
   * Set a check attribute for a group in radgroupcheck
   */
  async setGroupCheckAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
    op = "==",
  ): Promise<void> {
    // Delete existing attribute entries for the group
    await this.radiusClient.radgroupcheck.deleteMany({
      where: {
        groupname,
        attribute,
        tenantId,
      },
    });

    // Create new attribute entry
    await this.radiusClient.radgroupcheck.create({
      data: {
        groupname,
        attribute,
        op,
        value,
        tenantId,
      },
    });
  }

  /**
   * Remove a check attribute from a group in radgroupcheck
   */
  async removeGroupCheckAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radgroupcheck.deleteMany({
      where: {
        groupname,
        attribute,
        tenantId,
      },
    });
  }

  /**
   * Set a generic attribute for a group in radgroupreply
   */
  async setGroupAttribute(
    groupname: string,
    attribute: string,
    value: string,
    tenantId: string,
    op = ":=",
  ): Promise<void> {
    // Delete existing attribute entries for the group
    await this.radiusClient.radgroupreply.deleteMany({
      where: {
        groupname,
        attribute,
        tenantId,
      },
    });

    // Create new attribute entry
    await this.radiusClient.radgroupreply.create({
      data: {
        groupname,
        attribute,
        op,
        value,
        tenantId,
      },
    });
  }

  /**
   * Remove a generic attribute from a group in radgroupreply
   */
  async removeGroupAttribute(
    groupname: string,
    attribute: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radgroupreply.deleteMany({
      where: {
        groupname,
        attribute,
        tenantId,
      },
    });
  }

  /**
   * Get group bandwidth settings from radgroupreply
   */
  async getGroupBandwidth(
    groupname: string,
    tenantId: string,
  ): Promise<RadiusBandwidthEntity | null> {
    const reply = await this.radiusClient.radgroupreply.findFirst({
      where: {
        groupname,
        attribute: "Mikrotik-Rate-Limit",
        tenantId,
      },
    });

    if (!reply) return null;

    return parseRadiusRateLimitMbps(reply.value);
  }

  /**
   * Assign user to a group
   */
  async assignUserToGroup(
    username: string,
    groupname: string,
    tenantId: string,
    priority = 0,
  ): Promise<void> {
    const existing = await this.radiusClient.radusergroup.findFirst({
      where: { username, groupname, tenantId },
    });
    if (existing) {
      await this.radiusClient.radusergroup.update({
        where: { id: existing.id },
        data: { priority },
      });
    } else {
      await this.radiusClient.radusergroup.create({
        data: { username, groupname, priority, tenantId },
      });
    }
  }

  /**
   * Remove user from group
   */
  async removeUserFromGroup(
    username: string,
    groupname: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusClient.radusergroup.deleteMany({
      where: { username, groupname, tenantId },
    });
  }

  /**
   * Get all groups assigned to user
   */
  async getUserGroups(username: string, tenantId: string): Promise<string[]> {
    const groups = await this.radiusClient.radusergroup.findMany({
      where: { username, tenantId },
      orderBy: { priority: "asc" },
    });
    return groups.map(
      (g: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) =>
        g.groupname,
    );
  }

  /**
   * Get active sessions (acctstoptime is null)
   */
  async getActiveSessions(
    tenantId: string,
    username?: string,
  ): Promise<RadiusSessionEntity[]> {
    const sessions = await this.radiusClient.radacct.findMany({
      where: {
        acctstoptime: null,
        tenantId,
        ...(username && { username }),
      },
      orderBy: {
        acctstarttime: "desc",
      },
    });

    return sessions as unknown as RadiusSessionEntity[];
  }

  /**
   * Get user sessions within date range
   */
  async getUserSessions(
    username: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RadiusSessionEntity[]> {
    const sessions = await this.radiusClient.radacct.findMany({
      where: {
        username,
        tenantId,
        ...(startDate && {
          acctstarttime: {
            gte: startDate,
          },
        }),
        ...(endDate && {
          acctstarttime: {
            lte: endDate,
          },
        }),
      },
      orderBy: {
        acctstarttime: "desc",
      },
    });

    return sessions as unknown as RadiusSessionEntity[];
  }

  /**
   * Get accounting statistics for user
   */
  async getAccountingStats(
    username: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RadiusAccountingStatsEntity> {
    const sessions = await this.getUserSessions(
      username,
      tenantId,
      startDate,
      endDate,
    );

    const stats: RadiusAccountingStatsEntity = {
      username,
      totalSessions: sessions.length,
      totalSessionTime: BigInt(0),
      totalInputOctets: BigInt(0),
      totalOutputOctets: BigInt(0),
      activeSessions: 0,
    };

    for (const rawSession of sessions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = rawSession as any;
      if (session.acctsessiontime) {
        stats.totalSessionTime += session.acctsessiontime;
      }
      if (session.acctinputoctets) {
        stats.totalInputOctets += session.acctinputoctets;
      }
      if (session.acctoutputoctets) {
        stats.totalOutputOctets += session.acctoutputoctets;
      }
      if (!session.acctstoptime) {
        stats.activeSessions++;
      }
    }

    return stats;
  }

  /**
   * Parse bandwidth from MikroTik format (e.g., "10M") to Mbps
   */
  private parseSpeed(speed: string | null): number {
    if (!speed) return 0;
    const match = speed.match(/^(\d+)([MKG])?$/i);
    if (!match) return 0;

    const value = parseInt(match[1] ?? "0");
    const unit = match[2]?.toUpperCase();

    if (unit === "G") return value * 1000;
    if (unit === "M") return value;
    if (unit === "K") return value / 1000;

    // If it's just a number, assume it's bits/sec if it's very large, or Mbps if it's small?
    // Usually, in this app, it's Mbps if no unit.
    return value;
  }

  private async syncUserGroups(
    username: string,
    tenantId: string,
    desiredGroups: string[],
  ): Promise<void> {
    const existingGroups = await this.getUserGroups(username, tenantId);
    const desiredGroupSet = new Set(desiredGroups);

    for (const groupname of existingGroups) {
      if (!desiredGroupSet.has(groupname)) {
        await this.removeUserFromGroup(username, groupname, tenantId);
      }
    }
  }

  private isAllocatedIpPoolEntry(entry: {
    nasipaddress: string;
    pool_key: string;
    username: string;
    callingstationid: string;
    calledstationid: string;
  }): boolean {
    return Boolean(
      entry.nasipaddress ||
      entry.pool_key ||
      entry.username ||
      entry.callingstationid ||
      entry.calledstationid,
    );
  }

  /**
   * Sync single pelanggan to RADIUS
   */
  async syncPelangganToRadius(pelangganId: string): Promise<void> {
    const pelanggan = await this.prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: {
        hargaPaket: {
          include: {
            bandwidth: true,
          },
        },
      },
    });

    if (!pelanggan) {
      throw new Error(`Pelanggan ${pelangganId} not found`);
    }

    const { username, password, status, hargaPaket, tenantId } = pelanggan;

    if (!tenantId) {
      throw new Error(`Pelanggan ${pelangganId} does not have a tenantId`);
    }

    // 1. Handle NONAKTIF / DISMANTLE: Remove from RADIUS
    if (status === "NONAKTIF" || status === "DISMANTLE") {
      await this.deleteRadiusUser(username, tenantId);
      return;
    }

    // 2. Ensure User exists and password is correct
    const exists = await this.userExists(username, tenantId);
    if (!exists) {
      await this.createRadiusUser({ username, password }, tenantId);
    } else {
      await this.updateRadiusPassword(username, password, tenantId);
    }

    // 2.5. Remove individual bandwidth from radreply to ensure Group Bandwidth takes priority
    await this.radiusClient.radreply.deleteMany({
      where: {
        username,
        attribute: "Mikrotik-Rate-Limit",
        tenantId,
      },
    });

    // 3. Handle status-based Group Assignment
    if (status === "AKTIF" || status === "ISOLIR") {
      const desiredGroups: string[] = [];

      if (hargaPaket) {
        // Ensure package group exists and sync bandwidth
        await this.syncPackageToRadius(hargaPaket.id);

        // Ensure user is assigned to their package group (priority 10 - lower)
        await this.assignUserToGroup(username, hargaPaket.id, tenantId, 10);
        desiredGroups.push(hargaPaket.id);
      }

      if (status === "ISOLIR") {
        // Ensure ISOLIR group tells MikroTik to use the 'expired users' profile
        await this.setGroupAttribute(
          "ISOLIR",
          "Mikrotik-Group",
          "expired users",
          tenantId,
        );

        // Also remove explicit bandwidth limit from ISOLIR group if it exists
        // so it doesn't override the package bandwidth
        await this.removeGroupAttribute(
          "ISOLIR",
          "Mikrotik-Rate-Limit",
          tenantId,
        );

        // Add to ISOLIR group with HIGHER priority (priority 1 - higher)
        // This ensures the profile switch happens while keeping the package bandwidth
        await this.assignUserToGroup(username, "ISOLIR", tenantId, 1);
        desiredGroups.push("ISOLIR");
      }

      await this.syncUserGroups(username, tenantId, desiredGroups);
    }
  }

  /**
   * Sync Package settings to RADIUS (radgroupreply)
   */
  async syncPackageToRadius(packageId: string): Promise<void> {
    const pkg = await this.prisma.hargaPaket.findUnique({
      where: { id: packageId },
      include: {
        bandwidth: true,
        profilePPP: true,
      },
    });

    if (!pkg || !pkg.tenantId) return;
    const tenantId = pkg.tenantId;

    // 1. Sync Bandwidth
    if (pkg.bandwidth) {
      // Ambil helper format dari service MikroTik (menghindari duplikasi logika)
      // rx-rate/tx-rate [burst-rate] [burst-threshold] [burst-time] [priority] [min-limit]
      // rx = upload, tx = download

      const rateLimit = buildMikrotikRateLimit({
        maxLimitUpload: pkg.bandwidth.maxLimitUpload,
        maxLimitDownload: pkg.bandwidth.maxLimitDownload,
        burstLimitUpload: pkg.bandwidth.burstLimitUpload,
        burstLimitDownload: pkg.bandwidth.burstLimitDownload,
        burstThresholdUpload: pkg.bandwidth.burstThresholdUpload,
        burstThresholdDownload: pkg.bandwidth.burstThresholdDownload,
        burstTimeUpload: pkg.bandwidth.burstTimeUpload,
        burstTimeDownload: pkg.bandwidth.burstTimeDownload,
        priority: pkg.bandwidth.priority,
        minLimitUpload: pkg.bandwidth.minLimitUpload,
        minLimitDownload: pkg.bandwidth.minLimitDownload,
      });

      // Using pkg.id as group name for stability
      await this.setGroupBandwidth(pkg.id, rateLimit, tenantId);
    } else {
      await this.removeGroupAttribute(pkg.id, "Mikrotik-Rate-Limit", tenantId);
    }

    // 2. Sync IP Pool Mode & Profile Settings
    if (pkg.profilePPP) {
      const profile = pkg.profilePPP;
      const poolName = profile.remoteAddress;

      // 2.1 Sync Profile Name
      if (profile.name) {
        await this.setGroupAttribute(
          pkg.id,
          "Mikrotik-Group",
          profile.name,
          tenantId,
        );
      } else {
        await this.removeGroupAttribute(pkg.id, "Mikrotik-Group", tenantId);
      }

      if (profile.poolMode === "RADIUS") {
        // Mode RADIUS: Gunakan radgroupcheck.Pool-Name sebagai CONTROL attribute
        // Operator ':=' berarti assign ke control list (bukan '==' yang berarti match/compare)
        // Sesuai dokumentasi resmi FreeRADIUS: Pool-Name is a CONTROL attribute
        await this.setGroupCheckAttribute(
          pkg.id,
          "Pool-Name",
          poolName,
          tenantId,
          ":=",
        );

        // Pastikan tidak ada Framed-Pool di reply agar tidak konflik
        await this.removeGroupAttribute(pkg.id, "Framed-Pool", tenantId);
      } else {
        // Mode MIKROTIK (Default): Gunakan radgroupreply.Framed-Pool
        // MikroTik akan mencari pool lokal dengan nama tersebut
        await this.setGroupAttribute(pkg.id, "Framed-Pool", poolName, tenantId);

        // Pastikan tidak ada Pool-Name di check agar tidak konflik
        await this.removeGroupCheckAttribute(pkg.id, "Pool-Name", tenantId);
      }
    } else {
      await this.removeGroupAttribute(pkg.id, "Mikrotik-Group", tenantId);
      await this.removeGroupAttribute(pkg.id, "Framed-Pool", tenantId);
      await this.removeGroupCheckAttribute(pkg.id, "Pool-Name", tenantId);
    }
  }

  /**
   * Sync all packages using a specific bandwidth to RADIUS
   */
  async syncBandwidthToRadius(bandwidthId: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      where: { bandwidthId },
    });
    for (const pkg of packages) {
      await this.syncPackageToRadius(pkg.id);
    }
  }

  /**
   * Sync all packages using a specific profile to RADIUS
   */
  async syncProfileToRadius(profileId: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      where: { profilePPPId: profileId },
    });
    for (const pkg of packages) {
      await this.syncPackageToRadius(pkg.id);
    }
  }

  /**
   * Sync all packages to RADIUS
   */
  async syncAllPackagesToRadius(tenantId?: string): Promise<void> {
    const packages = await this.prisma.hargaPaket.findMany({
      ...(tenantId && { where: { tenantId } }),
    });
    for (const pkg of packages) {
      await this.syncPackageToRadius(pkg.id);
    }
  }

  /**
   * Sync all active customers to RADIUS
   */
  async syncAllActiveCustomers(
    tenantId?: string,
  ): Promise<{ created: number; updated: number; deleted: number }> {
    // First sync all packages to ensure groups are ready
    await this.syncAllPackagesToRadius(tenantId);

    const pelanggans = await this.prisma.pelanggan.findMany({
      include: {
        hargaPaket: {
          include: {
            bandwidth: true,
          },
        },
      },
      ...(tenantId && { where: { tenantId } }),
    });

    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const pelanggan of pelanggans) {
      const currentTenantId = pelanggan.tenantId;
      if (!currentTenantId) continue;

      const exists = await this.userExists(pelanggan.username, currentTenantId);

      if (pelanggan.status === "AKTIF" || pelanggan.status === "ISOLIR") {
        if (exists) {
          updated++;
        } else {
          created++;
        }
        await this.syncPelangganToRadius(pelanggan.id);
      } else {
        if (exists) {
          deleted++;
          await this.deleteRadiusUser(pelanggan.username, currentTenantId);
        }
      }
    }

    return { created, updated, deleted };
  }

  /**
   * Create or update NAS (Network Access Server)
   */
  async createNas(nas: NasEntity, tenantId: string): Promise<NasEntity> {
    // Use upsert to prevent unique constraint violations if the NAS already exists
    const created = await this.radiusClient.nas.upsert({
      where: {
        nasname_tenantId: {
          nasname: nas.nasname,
          tenantId: tenantId,
        },
      },
      update: {
        shortname: nas.shortname ?? null,
        type: nas.type || "other",
        ports: nas.ports ?? null,
        secret: nas.secret,
        community: nas.community ?? null,
        description: nas.description ?? null,
      },
      create: {
        nasname: nas.nasname,
        shortname: nas.shortname ?? null,
        type: nas.type || "other",
        ports: nas.ports ?? null,
        secret: nas.secret,
        community: nas.community ?? null,
        description: nas.description ?? null,
        tenantId,
      },
    });

    return {
      id: created.id,
      nasname: created.nasname,
      secret: created.secret,
      ...(created.shortname ? { shortname: created.shortname } : {}),
      ...(created.type ? { type: created.type } : {}),
      ...(created.ports ? { ports: created.ports } : {}),
      ...(created.community ? { community: created.community } : {}),
      ...(created.description ? { description: created.description } : {}),
    };
  }

  /**
   * Update NAS configuration
   */
  async updateNas(
    id: number,
    nas: Partial<NasEntity>,
    tenantId: string,
  ): Promise<NasEntity> {
    const updated = await this.radiusClient.nas.update({
      where: { id, tenantId },
      data: {
        ...(nas.nasname !== undefined ? { nasname: nas.nasname } : {}),
        ...(nas.shortname !== undefined ? { shortname: nas.shortname } : {}),
        ...(nas.type !== undefined ? { type: nas.type } : {}),
        ...(nas.ports !== undefined ? { ports: nas.ports } : {}),
        ...(nas.secret !== undefined ? { secret: nas.secret } : {}),
        ...(nas.community !== undefined ? { community: nas.community } : {}),
        ...(nas.description !== undefined
          ? { description: nas.description }
          : {}),
      },
    });

    return {
      id: updated.id,
      nasname: updated.nasname,
      secret: updated.secret,
      ...(updated.shortname ? { shortname: updated.shortname } : {}),
      ...(updated.type ? { type: updated.type } : {}),
      ...(updated.ports ? { ports: updated.ports } : {}),
      ...(updated.community ? { community: updated.community } : {}),
      ...(updated.description ? { description: updated.description } : {}),
    };
  }

  /**
   * Delete NAS
   */
  async deleteNas(id: number, tenantId: string): Promise<void> {
    await this.radiusClient.nas.delete({
      where: { id, tenantId },
    });
  }

  /**
   * Get NAS by ID
   */
  async getNasById(id: number, tenantId: string): Promise<NasEntity | null> {
    const nas = await this.radiusClient.nas.findFirst({
      where: { id, tenantId },
    });

    if (!nas) return null;

    return {
      id: nas.id,
      nasname: nas.nasname,
      secret: nas.secret,
      ...(nas.shortname ? { shortname: nas.shortname } : {}),
      ...(nas.type ? { type: nas.type } : {}),
      ...(nas.ports ? { ports: nas.ports } : {}),
      ...(nas.community ? { community: nas.community } : {}),
      ...(nas.description ? { description: nas.description } : {}),
    };
  }

  /**
   * Get all NAS
   */
  async getAllNas(tenantId: string): Promise<NasEntity[]> {
    const nasList = await this.radiusClient.nas.findMany({
      where: { tenantId },
      orderBy: { nasname: "asc" },
    });

    return nasList.map(
      (
        nas: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
      ) => ({
        id: nas.id,
        nasname: nas.nasname,
        secret: nas.secret,
        ...(nas.shortname ? { shortname: nas.shortname } : {}),
        ...(nas.type ? { type: nas.type } : {}),
        ...(nas.ports ? { ports: nas.ports } : {}),
        ...(nas.community ? { community: nas.community } : {}),
        ...(nas.description ? { description: nas.description } : {}),
      }),
    );
  }

  /**
   * Get NAS by IP address
   */
  async getNasByIp(ip: string, tenantId: string): Promise<NasEntity | null> {
    const nas = await this.radiusClient.nas.findFirst({
      where: { nasname: ip, tenantId },
    });

    if (!nas) return null;

    return {
      id: nas.id,
      nasname: nas.nasname,
      secret: nas.secret,
      ...(nas.shortname ? { shortname: nas.shortname } : {}),
      ...(nas.type ? { type: nas.type } : {}),
      ...(nas.ports ? { ports: nas.ports } : {}),
      ...(nas.community ? { community: nas.community } : {}),
      ...(nas.description ? { description: nas.description } : {}),
    };
  }

  /**
   * Add IP to pool
   */
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

    return {
      id: created.id,
      poolName: created.pool_name,
      framedIpAddress: created.framedipaddress,
      ...(created.nasipaddress ? { nasIpAddress: created.nasipaddress } : {}),
      ...(created.pool_key ? { poolKey: created.pool_key } : {}),
    };
  }

  /**
   * Remove IP from pool
   */
  async removeFromIpPool(ipAddress: string, tenantId: string): Promise<void> {
    await this.radiusClient.radippool.deleteMany({
      where: { framedipaddress: ipAddress, tenantId },
    });
  }

  /**
   * Get available IP from pool
   */
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
        // Find IP that's not currently assigned
      },
    });

    return availableIp?.framedipaddress || null;
  }

  /**
   * Return IP to pool (mark as available)
   */
  async returnIpToPool(ipAddress: string, tenantId: string): Promise<void> {
    // In a real implementation, you might clear the poolKey or nasipaddress
    // to mark the IP as available again
    await this.radiusClient.radippool.updateMany({
      where: { framedipaddress: ipAddress, tenantId },
      data: {
        nasipaddress: null,
        pool_key: null,
      },
    });
  }

  /**
   * Get IP pool statistics
   */
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

    return {
      total,
      used,
      available: total - used,
    };
  }

  /**
   * Get all IP pools
   */
  async getAllIpPools(tenantId: string): Promise<RadIpPoolEntity[]> {
    const pools = await this.radiusClient.radippool.findMany({
      where: { tenantId },
      orderBy: [{ pool_name: "asc" }, { framedipaddress: "asc" }],
    });

    return pools.map(
      (
        pool: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
      ) => ({
        id: pool.id,
        poolName: pool.pool_name,
        framedIpAddress: pool.framedipaddress,
        ...(pool.nasipaddress ? { nasIpAddress: pool.nasipaddress } : {}),
        ...(pool.pool_key ? { poolKey: pool.pool_key } : {}),
      }),
    );
  }
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: string): Promise<DashboardStatsEntity> {
    // Get unique usernames (since one user might have multiple radcheck entries)
    const uniqueUsers = await this.radiusClient.radcheck.groupBy({
      by: ["username"],
      where: {
        attribute: "Cleartext-Password",
        tenantId,
      },
    });

    // Get online users (active sessions)
    const onlineSessions = await this.radiusClient.radacct.findMany({
      where: {
        acctstoptime: null,
        tenantId,
      },
      distinct: ["username"],
    });

    const onlineUsers = onlineSessions.length;
    const offlineUsers = uniqueUsers.length - onlineUsers;

    // Get today's traffic
    const today = new Date();
    today.setTime(toStartOfDay(today).getTime());

    const todaySessions = await this.radiusClient.radacct.findMany({
      where: {
        acctstarttime: {
          gte: today,
        },
        tenantId,
      },
    });

    let totalDownloadBytes = BigInt(0);
    let totalUploadBytes = BigInt(0);

    for (const session of todaySessions) {
      if (session.acctoutputoctets) {
        totalDownloadBytes += session.acctoutputoctets;
      }
      if (session.acctinputoctets) {
        totalUploadBytes += session.acctinputoctets;
      }
    }

    // Convert to GB
    const downloadGB = Number(totalDownloadBytes) / 1073741824;
    const uploadGB = Number(totalUploadBytes) / 1073741824;

    // TODO: Get last sync info from cache/database
    const lastSyncTime = new Date().toISOString();
    const lastSyncStats = {
      created: 0,
      updated: 0,
      deleted: 0,
    };

    return {
      totalUsers: uniqueUsers.length,
      onlineUsers,
      offlineUsers,
      totalTrafficToday: {
        download: totalDownloadBytes.toString(),
        upload: totalUploadBytes.toString(),
        downloadGB: Math.round(downloadGB * 100) / 100,
        uploadGB: Math.round(uploadGB * 100) / 100,
      },
      lastSyncTime,
      lastSyncStats,
    };
  }

  async getTotalUsageByUsernames(
    tenantId: string,
    usernames: string[],
  ): Promise<Record<string, RadiusSessionTotalsEntity>> {
    const uniqueUsernames = Array.from(
      new Set(usernames.map((username) => username.trim()).filter(Boolean)),
    );
    if (uniqueUsernames.length === 0) {
      return {};
    }

    const grouped = await this.radiusClient.radacct.groupBy({
      by: ["username"],
      where: {
        tenantId,
        username: { in: uniqueUsernames },
      },
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
      },
    });

    const result: Record<string, RadiusSessionTotalsEntity> = {};
    for (const row of grouped) {
      const username = row.username;
      if (!username) continue;

      const downloadBytes = Number(row._sum.acctoutputoctets ?? 0);
      const uploadBytes = Number(row._sum.acctinputoctets ?? 0);

      result[username] = {
        downloadMB: Math.round((downloadBytes / 1048576) * 100) / 100,
        uploadMB: Math.round((uploadBytes / 1048576) * 100) / 100,
      };
    }

    return result;
  }

  async getUserSessionHistory(
    tenantId: string,
    username: string,
    options: RadiusSessionHistoryOptionsEntity = {},
  ): Promise<RadiusSessionHistoryResultEntity> {
    const { page = 1, limit = 20, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      username,
      ...(startDate || endDate
        ? {
            acctstarttime: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    };

    const [total, sessions, summaryRaw] = await Promise.all([
      this.radiusClient.radacct.count({ where }),
      this.radiusClient.radacct.findMany({
        where,
        orderBy: { acctstarttime: "desc" },
        skip,
        take: limit,
      }),
      this.radiusClient.radacct.aggregate({
        where,
        _count: { _all: true },
        _sum: {
          acctsessiontime: true,
          acctinputoctets: true,
          acctoutputoctets: true,
        },
      }),
    ]);

    const items = sessions.map(
      (
        session: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
      ) => {
        const inputOctets = session.acctinputoctets
          ? BigInt(session.acctinputoctets)
          : BigInt(0);
        const outputOctets = session.acctoutputoctets
          ? BigInt(session.acctoutputoctets)
          : BigInt(0);
        const totalOctets = inputOctets + outputOctets;

        const uploadMB =
          Math.round((Number(inputOctets) / 1048576) * 100) / 100;
        const downloadMB =
          Math.round((Number(outputOctets) / 1048576) * 100) / 100;
        const totalMB = Math.round((Number(totalOctets) / 1048576) * 100) / 100;

        return {
          radAcctId: session.radacctid.toString(),
          username: session.username,
          nasIpAddress: session.nasipaddress,
          framedIpAddress: session.framedipaddress,
          acctStartTime: session.acctstarttime?.toISOString() || null,
          acctStopTime: session.acctstoptime?.toISOString() || null,
          acctSessionTime: session.acctsessiontime?.toString() || "0",
          acctInputOctets: inputOctets.toString(),
          acctOutputOctets: outputOctets.toString(),
          totalOctets: totalOctets.toString(),
          uploadMB,
          downloadMB,
          totalMB,
          isOnline: session.acctstoptime === null,
        };
      },
    );

    const totalInputOctets = summaryRaw._sum.acctinputoctets
      ? BigInt(summaryRaw._sum.acctinputoctets)
      : BigInt(0);
    const totalOutputOctets = summaryRaw._sum.acctoutputoctets
      ? BigInt(summaryRaw._sum.acctoutputoctets)
      : BigInt(0);
    const totalSessionTime = summaryRaw._sum.acctsessiontime
      ? BigInt(summaryRaw._sum.acctsessiontime)
      : BigInt(0);
    const totalOctets = totalInputOctets + totalOutputOctets;

    const summary = {
      totalSessions: summaryRaw._count._all,
      activeSessions: items.filter((item) => item.isOnline).length,
      totalSessionTime: totalSessionTime.toString(),
      totalInputOctets: totalInputOctets.toString(),
      totalOutputOctets: totalOutputOctets.toString(),
      totalOctets: totalOctets.toString(),
      totalInputMB:
        Math.round((Number(totalInputOctets) / 1048576) * 100) / 100,
      totalOutputMB:
        Math.round((Number(totalOutputOctets) / 1048576) * 100) / 100,
      totalMB: Math.round((Number(totalOctets) / 1048576) * 100) / 100,
    };

    return {
      sessions: items,
      total,
      summary,
    };
  }

  /**
   * Get recent sessions with pagination
   */
  async getRecentSessions(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: "active" | "all";
    } = {},
  ): Promise<{ sessions: RadiusSessionViewEntity[]; total: number }> {
    const { page = 1, limit = 50, status = "active" } = options;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId };
    if (status === "active") {
      where.acctstoptime = null;
    }

    const total = await this.radiusClient.radacct.count({ where });

    const sessions = await this.radiusClient.radacct.findMany({
      where,
      orderBy: {
        acctstarttime: "desc",
      },
      skip,
      take: limit,
    });

    const now = new Date();
    const transformedSessions = sessions.map(
      (
        session: any /* eslint-disable-line @typescript-eslint/no-explicit-any */,
      ) => {
        const startTime = session.acctstarttime || new Date();
        const isOnline = session.acctstoptime === null;

        let uptimeSeconds = 0;
        if (isOnline) {
          uptimeSeconds = Math.floor(
            (now.getTime() - startTime.getTime()) / 1000,
          );
        } else if (session.acctsessiontime) {
          uptimeSeconds = Number(session.acctsessiontime);
        }

        const uptimeHours = Math.round((uptimeSeconds / 3600) * 100) / 100;

        const downloadMB = session.acctoutputoctets
          ? Math.round((Number(session.acctoutputoctets) / 1048576) * 100) / 100
          : 0;
        const uploadMB = session.acctinputoctets
          ? Math.round((Number(session.acctinputoctets) / 1048576) * 100) / 100
          : 0;

        return {
          radAcctId: session.radacctid.toString(),
          username: session.username,
          nasIpAddress: session.nasipaddress,
          framedIpAddress: session.framedipaddress,
          acctStartTime: session.acctstarttime?.toISOString() || null,
          acctStopTime: session.acctstoptime?.toISOString() || null,
          acctSessionTime: session.acctsessiontime?.toString() || "0",
          acctInputOctets: session.acctinputoctets?.toString() || "0",
          acctOutputOctets: session.acctoutputoctets?.toString() || "0",
          uptimeSeconds,
          uptimeHours,
          downloadMB,
          uploadMB,
          isOnline,
        };
      },
    );

    return { sessions: transformedSessions, total };
  }

  /**
   * Sync IP Pool to RADIUS radippool table
   */
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
      .filter((entry) => !this.isAllocatedIpPoolEntry(entry))
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

    // FreeRADIUS 3.2.5 allocate_find uses: WHERE expiry_time < 'now'::timestamp(0)
    // NULL expiry_time would NOT match this condition, so we set it to past timestamp
    const pastTime = new Date(Date.now() - 1000);
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

export default RadiusRepository;
