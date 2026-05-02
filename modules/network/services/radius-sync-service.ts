import { logger } from "@/lib/logger";
/**
 * RADIUS Sync Service
 *
 * High-level service for syncing Pelanggan data to RADIUS tables or MikroTik.
 * Handles status changes, bandwidth updates, and bulk operations.
 *
 * Mode Koneksi:
 * - RADIUS: Pelanggan auth via FreeRADIUS
 * - MIKROTIK_API: Pelanggan auth via PPP Secret di MikroTik langsung
 */

import { Status } from "../types/network.enums";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { MikroTikPPPSecretService } from "./MikroTikPPPSecretService";
import { createMikroTikPPPSecretService } from "../factories/MikroTikPPPSecretServiceFactory";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { prismaRadius } from "@/lib/prisma-radius";

export type ConnectionMode = "RADIUS" | "MIKROTIK_API";
export type RadiusSyncDisconnectErrorCode =
  | "PELANGGAN_NOT_FOUND"
  | "ROUTER_NOT_FOUND";

export class RadiusSyncService {
  private radiusRepo: RadiusRepository;
  private pppSecretService: MikroTikPPPSecretService;
  private networkRepo: NetworkRepository;

  private static readonly MB_DIVISOR = 1048576;

  private toMB(bytes: number): number {
    return Math.round((bytes / RadiusSyncService.MB_DIVISOR) * 100) / 100;
  }

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
   * Sync all active customers to RADIUS
   */
  async syncAllActiveCustomers(): Promise<{
    created: number;
    updated: number;
    deleted: number;
  }> {
    return await this.radiusRepo.syncAllActiveCustomers();
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
    const pelanggan = await this.networkRepo.findPelangganBasic(pelangganId);

    if (!pelanggan) {
      throw new Error(`Pelanggan ${pelangganId} not found`);
    }

    const mode = await this.getConnectionMode();

    if (mode === "MIKROTIK_API") {
      if (newStatus === "AKTIF") {
        await this.pppSecretService.syncNewCustomer(pelangganId);
        await this.pppSecretService.unIsolateCustomer(pelangganId);
      } else if (newStatus === "ISOLIR" || newStatus === "NONAKTIF") {
        await this.pppSecretService.isolateCustomer(pelangganId);
      } else if (newStatus === "DISMANTLE") {
        await this.pppSecretService.dismantleCustomer(pelangganId);
      } else {
        await this.pppSecretService.isolateCustomer(pelangganId);
      }
    } else {
      await this.radiusRepo.syncPelangganToRadius(pelangganId);

      if (newStatus === "AKTIF") {
        await this.pppSecretService.unIsolateCustomer(pelangganId);
      } else if (newStatus === "DISMANTLE") {
        await this.pppSecretService.dismantleCustomer(pelangganId);
      } else {
        await this.pppSecretService.isolateCustomer(pelangganId);
      }
    }
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
    return await this.radiusRepo.getActiveSessions(tenantId, username);
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
    return await this.radiusRepo.getAccountingStats(
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
    return await this.radiusRepo.getUserSessionHistory(
      tenantId,
      username,
      options,
    );
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

  private toISODateEnd(date: Date): Date {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private toHours(seconds: string): number {
    const value = Number(seconds || "0");
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round((value / 3600) * 100) / 100;
  }

  private toGBFromMB(mb: number): number {
    if (!Number.isFinite(mb) || mb <= 0) return 0;
    return Math.round((mb / 1024) * 100) / 100;
  }

  private toGBFromOctets(octets: string): number {
    const value = Number(octets || "0");
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round((value / 1073741824) * 100) / 100;
  }

  private parseHistoryDateParam(
    value: string | null,
    endOfDay = false,
  ): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return endOfDay ? this.toISODateEnd(date) : date;
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
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit =
      params.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;
    const startDate = this.parseHistoryDateParam(
      params.startDate || null,
      false,
    );
    const endDate = this.parseHistoryDateParam(params.endDate || null, true);

    const result = await this.getCustomerSessionHistory(username, tenantId, {
      page,
      limit,
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    });

    const sessions = result.sessions.map((item) => ({
      ...item,
      acctSessionHours: this.toHours(item.acctSessionTime),
      uploadGB: this.toGBFromMB(item.uploadMB),
      downloadGB: this.toGBFromMB(item.downloadMB),
      totalGB: this.toGBFromMB(item.totalMB),
    }));

    const summary = {
      ...result.summary,
      totalSessionHours: this.toHours(result.summary.totalSessionTime),
      totalInputGB: this.toGBFromOctets(result.summary.totalInputOctets),
      totalOutputGB: this.toGBFromOctets(result.summary.totalOutputOctets),
      totalGB: this.toGBFromOctets(result.summary.totalOctets),
    };

    return {
      username,
      summary,
      sessions,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
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
    const pelanggan = await this.getPelangganRouterByUsername(
      username,
      tenantId,
    );

    if (!pelanggan) {
      return {
        success: false,
        disconnected: 0,
        error: "Pelanggan tidak ditemukan untuk tenant ini",
        errorCode: "PELANGGAN_NOT_FOUND",
      };
    }

    const routerId = pelanggan.hargaPaket?.profilePPP?.mikroTikRouter?.id;
    if (!routerId) {
      return {
        success: false,
        disconnected: 0,
        pelangganId: pelanggan.id,
        error: "Router pelanggan tidak ditemukan",
        errorCode: "ROUTER_NOT_FOUND",
      };
    }

    const result = await this.pppSecretService.disconnectSession(
      routerId,
      username,
    );

    return {
      success: result.success,
      disconnected: result.disconnected,
      pelangganId: pelanggan.id,
      ...(result.error ? { error: result.error } : {}),
    };
  }

  private async resolveRouterForUsername(
    username: string,
    tenantId: string,
    nasIpAddress?: string,
  ): Promise<{
    routerId?: string;
    source?: "pelanggan" | "nas-ip" | "tenant-fallback";
  }> {
    const pelanggan = await this.getPelangganRouterByUsername(
      username,
      tenantId,
    );
    if (pelanggan?.hargaPaket?.profilePPP?.mikroTikRouter?.id) {
      return {
        routerId: pelanggan.hargaPaket.profilePPP.mikroTikRouter.id,
        source: "pelanggan",
      };
    }

    if (nasIpAddress) {
      const nasRouter = await this.networkRepo.findRouterByNasIp(
        nasIpAddress,
        tenantId,
      );
      if (nasRouter?.id) {
        return { routerId: nasRouter.id, source: "nas-ip" };
      }
    }

    const fallbackRouter =
      await this.networkRepo.findAnyRouterByTenant(tenantId);
    if (fallbackRouter?.id) {
      return { routerId: fallbackRouter.id, source: "tenant-fallback" };
    }

    return {};
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
    const { routerId } = await this.resolveRouterForUsername(
      username,
      tenantId,
      nasIpAddress,
    );

    if (!routerId) {
      return { success: false, error: "Router tenant tidak ditemukan" };
    }

    const usageResult = await this.pppSecretService.getActiveSessionUsage(
      routerId,
      username,
    );
    if (!usageResult.success || !usageResult.usage) {
      return {
        success: false,
        ...(usageResult.error ? { error: usageResult.error } : {}),
      };
    }

    return {
      success: true,
      downloadMB: this.toMB(usageResult.usage.downloadBytes),
      uploadMB: this.toMB(usageResult.usage.uploadBytes),
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
    const { routerId, source } = await this.resolveRouterForUsername(
      username,
      tenantId,
      nasIpAddress,
    );

    if (!routerId) {
      return { success: false, error: "Router tenant tidak ditemukan" };
    }

    const debug = await this.pppSecretService.debugActiveSessionUsage(
      routerId,
      username,
    );
    if (!debug.success) {
      return {
        success: false,
        routerSource: source,
        routerId,
        ...(debug.error ? { error: debug.error } : {}),
      };
    }

    return {
      success: true,
      routerSource: source,
      routerId,
      debug,
    };
  }

  /**
   * Verify RADIUS sync status for customer
   */
  async verifyCustomerSync(pelangganId: string): Promise<{
    synced: boolean;
    username: string;
    status: Status;
    existsInRadius: boolean;
  }> {
    const pelanggan = await this.networkRepo.findPelangganBasic(pelangganId);

    if (!pelanggan || !pelanggan.tenantId) {
      throw new Error(`Pelanggan ${pelangganId} not found or missing tenantId`);
    }

    const existsInRadius = await this.radiusRepo.userExists(
      pelanggan.username,
      pelanggan.tenantId,
    );
    const shouldExist = pelanggan.status === "AKTIF";

    return {
      synced: existsInRadius === shouldExist,
      username: pelanggan.username,
      status: pelanggan.status as Status,
      existsInRadius,
    };
  }
}

export default RadiusSyncService;
