import { prismaRadius } from "@/lib/prisma-radius";
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
import {
  parseRadiusRateLimitMbps,
  toRadiusRateLimitMbps,
} from "../utils/radius-rate-limit";
import {
  CLEAR_TEXT_PASSWORD_ATTRIBUTE,
  DEFAULT_GROUP_PRIORITY,
  GROUP_CHECK_MATCH_OP,
  GROUP_REPLY_ASSIGN_OP,
  MIKROTIK_RATE_LIMIT_ATTRIBUTE,
} from "./radiusRepository.constants";
import { RadiusIpPoolRepository } from "./RadiusIpPoolRepository";
import { RadiusNasRepository } from "./RadiusNasRepository";
import { RadiusSessionRepository } from "./RadiusSessionRepository";
import { RadiusSyncRepository } from "./RadiusSyncRepository";

type PrismaInstance = typeof defaultPrisma;

export class RadiusRepository implements IRadiusRepository {
  private readonly radiusClient: typeof prismaRadius;
  private readonly ipPoolRepository: RadiusIpPoolRepository;
  private readonly nasRepository: RadiusNasRepository;
  private readonly sessionRepository: RadiusSessionRepository;
  private readonly syncRepository: RadiusSyncRepository;

  constructor(
    private prisma: PrismaInstance = defaultPrisma,
    radiusClient?: typeof prismaRadius,
  ) {
    this.radiusClient = radiusClient || prismaRadius;
    this.ipPoolRepository = new RadiusIpPoolRepository(this.radiusClient);
    this.nasRepository = new RadiusNasRepository(this.radiusClient);
    this.sessionRepository = new RadiusSessionRepository(this.radiusClient);
    this.syncRepository = new RadiusSyncRepository(
      this.prisma,
      this.radiusClient,
      this,
    );
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
        attribute: CLEAR_TEXT_PASSWORD_ATTRIBUTE,
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
        attribute: CLEAR_TEXT_PASSWORD_ATTRIBUTE,
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
        attribute: CLEAR_TEXT_PASSWORD_ATTRIBUTE,
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
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        tenantId,
      },
    });

    // Create new bandwidth entry
    await this.radiusClient.radreply.create({
      data: {
        username,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        op: GROUP_REPLY_ASSIGN_OP,
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
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
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
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        tenantId,
      },
    });

    // Create new bandwidth entry in radgroupreply
    await this.radiusClient.radgroupreply.create({
      data: {
        groupname,
        attribute: MIKROTIK_RATE_LIMIT_ATTRIBUTE,
        op: GROUP_REPLY_ASSIGN_OP,
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
    op = GROUP_CHECK_MATCH_OP,
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
    op = GROUP_REPLY_ASSIGN_OP,
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
    priority = DEFAULT_GROUP_PRIORITY,
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
    return this.sessionRepository.getActiveSessions(tenantId, username);
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
    return this.sessionRepository.getUserSessions(
      username,
      tenantId,
      startDate,
      endDate,
    );
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
    return this.sessionRepository.getAccountingStats(
      username,
      tenantId,
      startDate,
      endDate,
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

  async createNas(nas: NasEntity, tenantId: string): Promise<NasEntity> {
    return this.nasRepository.createNas(nas, tenantId);
  }

  async updateNas(
    id: number,
    nas: Partial<NasEntity>,
    tenantId: string,
  ): Promise<NasEntity> {
    return this.nasRepository.updateNas(id, nas, tenantId);
  }

  async deleteNas(id: number, tenantId: string): Promise<void> {
    await this.nasRepository.deleteNas(id, tenantId);
  }

  async getNasById(id: number, tenantId: string): Promise<NasEntity | null> {
    return this.nasRepository.getNasById(id, tenantId);
  }

  async getAllNas(tenantId: string): Promise<NasEntity[]> {
    return this.nasRepository.getAllNas(tenantId);
  }

  async getNasByIp(ip: string, tenantId: string): Promise<NasEntity | null> {
    return this.nasRepository.getNasByIp(ip, tenantId);
  }

  /**
   * Add IP to pool
   */
  async addToIpPool(
    pool: RadIpPoolEntity,
    tenantId: string,
  ): Promise<RadIpPoolEntity> {
    return this.ipPoolRepository.addToIpPool(pool, tenantId);
  }

  /**
   * Remove IP from pool
   */
  async removeFromIpPool(ipAddress: string, tenantId: string): Promise<void> {
    await this.ipPoolRepository.removeFromIpPool(ipAddress, tenantId);
  }

  /**
   * Get available IP from pool
   */
  async getIpFromPool(
    poolName: string,
    tenantId: string,
    nasipaddress?: string,
  ): Promise<string | null> {
    return this.ipPoolRepository.getIpFromPool(
      poolName,
      tenantId,
      nasipaddress,
    );
  }

  /**
   * Return IP to pool (mark as available)
   */
  async returnIpToPool(ipAddress: string, tenantId: string): Promise<void> {
    await this.ipPoolRepository.returnIpToPool(ipAddress, tenantId);
  }

  /**
   * Get IP pool statistics
   */
  async getIpPoolStats(
    tenantId: string,
    poolName?: string,
  ): Promise<{ total: number; used: number; available: number }> {
    return this.ipPoolRepository.getIpPoolStats(tenantId, poolName);
  }

  /**
   * Get all IP pools
   */
  async getAllIpPools(tenantId: string): Promise<RadIpPoolEntity[]> {
    return this.ipPoolRepository.getAllIpPools(tenantId);
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(tenantId: string): Promise<DashboardStatsEntity> {
    return this.sessionRepository.getDashboardStats(tenantId);
  }

  async getTotalUsageByUsernames(
    tenantId: string,
    usernames: string[],
  ): Promise<Record<string, RadiusSessionTotalsEntity>> {
    return this.sessionRepository.getTotalUsageByUsernames(tenantId, usernames);
  }

  async getUserSessionHistory(
    tenantId: string,
    username: string,
    options: RadiusSessionHistoryOptionsEntity = {},
  ): Promise<RadiusSessionHistoryResultEntity> {
    return this.sessionRepository.getUserSessionHistory(
      tenantId,
      username,
      options,
    );
  }

  /**
   * Get recent sessions with pagination
   */
  async getRecentSessions(
    tenantId: string,
    options: { page?: number; limit?: number; status?: "active" | "all" } = {},
  ): Promise<{ sessions: RadiusSessionViewEntity[]; total: number }> {
    return this.sessionRepository.getRecentSessions(tenantId, options);
  }

  /**
   * Sync IP Pool to RADIUS radippool table
   */
  async syncIpPoolToRadius(
    poolName: string,
    ipRange: string,
    tenantId: string,
  ): Promise<void> {
    await this.ipPoolRepository.syncIpPoolToRadius(poolName, ipRange, tenantId);
  }
}

export default RadiusRepository;
