import { logger } from "@/lib/logger";
import { Status } from "../types/network.enums";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { MikroTikPPPSecretService } from "./MikroTikPPPSecretService";
import { createMikroTikPPPSecretService } from "../factories/MikroTikPPPSecretServiceFactory";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { prismaRadius } from "@/lib/prisma-radius";
import {
  buildSessionHistoryOptions,
  buildSessionHistoryView,
} from "./radius-sync-session.helpers";
import {
  debugLiveSessionUsageByUsername as debugLiveSessionUsage,
  disconnectSessionByUsername as disconnectSession,
  getLiveSessionUsageByUsername as getLiveSessionUsage,
  type RadiusSyncDisconnectErrorCode,
} from "./radius-sync-router.helpers";
import {
  handleCustomerStatusChange,
  verifyCustomerSyncStatus,
} from "./radius-sync-status.helpers";

export type ConnectionMode = "RADIUS" | "MIKROTIK_API";

export class RadiusSyncService {
  private radiusRepo: RadiusRepository;
  private pppSecretService: MikroTikPPPSecretService;
  private networkRepo: NetworkRepository;

  private async getPelangganRouterByUsername(
    username: string,
    tenantId: string,
  ) {
    return this.networkRepo.findPelangganWithRouterByUsername(
      username,
      tenantId,
    );
  }

  constructor(radiusClient?: typeof prismaRadius) {
    this.radiusRepo = new RadiusRepository(undefined, radiusClient);
    this.pppSecretService = createMikroTikPPPSecretService();
    this.networkRepo = new NetworkRepository();
  }

  /**
   * Get connection mode from settings
   * Default: RADIUS (backward compatible)
   */
  async getConnectionMode(): Promise<ConnectionMode> {
    try {
      const setting = await this.networkRepo.findSettingByKey(
        "PPP_CONNECTION_MODE",
      );
      if (setting?.value === "MIKROTIK_API") {
        return "MIKROTIK_API";
      }
    } catch (_error) {
      logger.warn(
        "[RadiusSyncService] Could not read connection mode, defaulting to RADIUS",
      );
    }
    return "RADIUS";
  }

  /**
   * Sync single customer to RADIUS or MikroTik
   */
  async syncSingleCustomer(pelangganId: string): Promise<void> {
    const mode = await this.getConnectionMode();

    if (mode === "MIKROTIK_API") {
      await this.pppSecretService.syncNewCustomer(pelangganId);
    } else {
      await this.radiusRepo.syncPelangganToRadius(pelangganId);
    }
  }

  /**
   * Sync all active customers to RADIUS, optionally scoped to a tenant
   */
  async syncAllActiveCustomers(tenantId?: string): Promise<{
    created: number;
    updated: number;
    deleted: number;
  }> {
    return this.radiusRepo.syncAllActiveCustomers(tenantId);
  }

  async deleteRadiusUserByUsername(
    username: string,
    tenantId: string,
  ): Promise<void> {
    await this.radiusRepo.deleteRadiusUser(username, tenantId);
  }

  /**
   * Handle customer status change
   */
  async handleStatusChange(
    pelangganId: string,
    newStatus: Status,
  ): Promise<void> {
    await handleCustomerStatusChange({
      pelangganId,
      newStatus,
      mode: await this.getConnectionMode(),
      networkRepo: this.networkRepo,
      radiusRepo: this.radiusRepo,
      pppSecretService: this.pppSecretService,
    });
  }

  /**
   * Update customer bandwidth
   */
  async updateCustomerBandwidth(pelangganId: string): Promise<void> {
    await this.syncSingleCustomer(pelangganId);
  }

  /**
   * Get active sessions for customer
   */
  async getCustomerActiveSessions(username: string, tenantId: string) {
    return this.radiusRepo.getActiveSessions(tenantId, username);
  }

  /**
   * Get accounting statistics for customer
   */
  async getCustomerAccountingStats(
    username: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    return this.radiusRepo.getAccountingStats(
      username,
      tenantId,
      startDate,
      endDate,
    );
  }

  async getCustomerSessionHistory(
    username: string,
    tenantId: string,
    options?: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return this.radiusRepo.getUserSessionHistory(tenantId, username, options);
  }

  async ensureCustomerBelongsToTenant(
    username: string,
    tenantId: string,
  ): Promise<boolean> {
    const pelanggan = await this.getPelangganRouterByUsername(
      username,
      tenantId,
    );
    return Boolean(pelanggan);
  }

  async ensurePelangganIdBelongsToTenant(
    pelangganId: string,
    tenantId: string,
  ): Promise<boolean> {
    const pelanggan = await this.networkRepo.findPelangganBasic(pelangganId);
    if (!pelanggan) return false;
    if (!pelanggan.tenantId) return false;
    return pelanggan.tenantId === tenantId;
  }

  async getSessionHistoryView(
    username: string,
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) {
    const options = buildSessionHistoryOptions(params);
    const result = await this.getCustomerSessionHistory(
      username,
      tenantId,
      options,
    );

    return buildSessionHistoryView(username, result, {
      page: options.page,
      limit: options.limit,
    });
  }

  async canGetHistoryForRadiusDashboardUser(
    username: string,
    tenantId: string,
  ): Promise<boolean> {
    return this.ensureCustomerBelongsToTenant(username, tenantId);
  }

  async getHistoryForRadiusDashboardUser(
    username: string,
    tenantId: string,
    params: {
      page?: number;
      limit?: number;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) {
    return this.getSessionHistoryView(username, tenantId, params);
  }

  async verifyCustomerSync(pelangganId: string): Promise<{
    synced: boolean;
    username: string;
    status: Status;
    existsInRadius: boolean;
  }> {
    return verifyCustomerSyncStatus({
      pelangganId,
      networkRepo: this.networkRepo,
      radiusRepo: this.radiusRepo,
    });
  }

  async disconnectSessionByUsername(
    username: string,
    tenantId: string,
  ): Promise<{
    success: boolean;
    disconnected: number;
    pelangganId?: string;
    error?: string;
    errorCode?: RadiusSyncDisconnectErrorCode;
  }> {
    return disconnectSession(
      this.networkRepo,
      this.pppSecretService,
      username,
      tenantId,
    );
  }

  async getLiveSessionUsageByUsername(
    username: string,
    tenantId: string,
    nasIpAddress?: string,
  ): Promise<{
    success: boolean;
    downloadMB?: number;
    uploadMB?: number;
    error?: string;
  }> {
    const result = await getLiveSessionUsage(
      this.networkRepo,
      this.pppSecretService,
      username,
      tenantId,
      nasIpAddress,
    );

    return {
      success: result.success,
      downloadMB: result.downloadMB,
      uploadMB: result.uploadMB,
      ...(result.error ? { error: result.error } : {}),
    };
  }

  async debugLiveSessionUsageByUsername(
    username: string,
    tenantId: string,
    nasIpAddress?: string,
  ): Promise<{
    success: boolean;
    routerSource?: "pelanggan" | "nas-ip" | "tenant-fallback";
    routerId?: string;
    debug?: unknown;
    error?: string;
  }> {
    return debugLiveSessionUsage(
      this.networkRepo,
      this.pppSecretService,
      username,
      tenantId,
      nasIpAddress,
    );
  }

  /** List orphan RADIUS usernames (no matching pelanggan). */
  async listOrphanRadiusUsers(tenantId: string): Promise<string[]> {
    return this.radiusRepo.findOrphanUsernames(tenantId);
  }

  /**
   * Remove a single customer from RADIUS by username.
   * Digunakan oleh event handler saat customer dihapus dari sistem.
   * tenantId wajib diisi — tanpanya deleteOrphanUsers akan WHERE tenantId = ""
   * yang tidak match record manapun (silent no-op, orphan credential).
   */
  async removeCustomer(username: string, tenantId?: string): Promise<void> {
    if (!tenantId) {
      throw new Error(
        `[RadiusSync] removeCustomer memerlukan tenantId untuk username ${username}; cegah silent no-op`,
      );
    }
    await this.radiusRepo.deleteOrphanUsers([username], tenantId);
  }

  /** Delete orphan RADIUS users. If usernames provided, only delete those. */
  async cleanupOrphanRadiusUsers(
    tenantId: string,
    usernames?: string[],
  ): Promise<{ deleted: number }> {
    const targets =
      usernames && usernames.length > 0
        ? usernames
        : await this.radiusRepo.findOrphanUsernames(tenantId);

    if (targets.length === 0) return { deleted: 0 };

    const deleted = await this.radiusRepo.deleteOrphanUsers(targets, tenantId);
    return { deleted };
  }

  /** Force remove a RADIUS user (credentials + close active sessions). */
  async forceRemoveRadiusUser(
    username: string,
    tenantId: string,
  ): Promise<{ deleted: number }> {
    const deleted = await this.radiusRepo.deleteOrphanUsers(
      [username],
      tenantId,
    );
    return { deleted };
  }
}

export default RadiusSyncService;
