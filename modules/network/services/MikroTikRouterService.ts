import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type {
  MikroTikRouterUpdateData,
  PaginatedRouterResult,
} from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";
import { NetworkRepository } from "../repositories/NetworkRepository";
import type { IVpnCoreRouterTombstoneRepository } from "../domain/ports/IVpnCoreRouterTombstoneRepository";
import { VpnCoreRouterTombstoneRepository } from "../repositories/VpnCoreRouterTombstoneRepository";
import { VpnServerRepository } from "../repositories/VpnServerRepository";
import { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import {
  getAuthorizedRouter,
  resolveRestrictedSiteId,
  RouterAccessDeniedError,
  RouterNotFoundError,
} from "./mikrotik-router.access";
import {
  createRouterMutation,
  type CreateRouterRequestData,
  deleteRouterMutation,
  generateRouterApiUserMutation,
  updateRouterMutation,
} from "./mikrotik-router.mutations";
import { testRouterConnection } from "./mikrotik-router.connection-test";
import {
  checkAllMikroTikRouterStatus,
  checkTenantMikroTikRouterStatus,
} from "./mikrotik-ping-check";
import { RouterIpConflictError } from "../domain/errors/RouterErrors";

export { RouterAccessDeniedError, RouterNotFoundError, RouterIpConflictError };

function createEmptyRouterList(
  page: number,
  limit: number,
): PaginatedRouterResult {
  return {
    routers: [],
    total: 0,
    page,
    limit,
    totalPages: 0,
  };
}

function buildRouterFilters(params: { search?: string; siteId?: string }) {
  const filters: Record<string, string | undefined> = {};

  if (params.search) {
    filters.search = params.search;
  }

  if (params.siteId) {
    filters.siteId = params.siteId;
  }

  return filters;
}

export class MikroTikRouterService {
  constructor(
    private readonly routerRepository: IMikroTikRouterRepository = new MikroTikRouterRepository(),
    private readonly networkRepository: IRouterAccessRepository = new NetworkRepository(),
    private readonly provisioningService = new MikroTikProvisioningService(),
    private readonly vpnServerRepository: Pick<
      IVpnServerRepository,
      "tenantServerIds"
    > = new VpnServerRepository(),
    private readonly tombstoneRepository: Pick<
      IVpnCoreRouterTombstoneRepository,
      "add" | "has"
    > = new VpnCoreRouterTombstoneRepository(),
  ) {}

  getRouterRepository() {
    return this.routerRepository;
  }

  getNetworkRepository() {
    return this.networkRepository;
  }

  getProvisioningService() {
    return this.provisioningService;
  }

  /** Ambil daftar router dengan pembatasan site bila diperlukan. */
  async listRouters(params: {
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
    search?: string;
    page: number;
    limit: number;
  }) {
    const siteId = params.restrictedToOwnSite
      ? await resolveRestrictedSiteId(this.networkRepository, params.userId)
      : undefined;

    if (params.restrictedToOwnSite && !siteId) {
      return createEmptyRouterList(params.page, params.limit);
    }

    return this.routerRepository.findWithFilters(
      buildRouterFilters({ search: params.search, siteId }),
      { page: params.page, limit: params.limit },
      params.tenantId,
    );
  }

  /** Ambil detail router yang sudah lolos validasi akses user. */
  async getRouterById(params: {
    id: string;
    tenantId: string;
    userId: string;
    restrictedToOwnSite: boolean;
  }) {
    return getAuthorizedRouter({
      ...params,
      routerRepository: this.routerRepository,
      networkRepository: this.networkRepository,
    });
  }

  /** Buat router baru lalu provisioning otomatis bila diminta. */
  async createRouter(params: {
    data: CreateRouterRequestData;
    autoConfigure?: unknown;
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
  }): Promise<{ id: string }> {
    return createRouterMutation({
      ...params,
      routerRepository: this.routerRepository,
      networkRepository: this.networkRepository,
      provisioningService: this.provisioningService,
      vpnServerRepository: this.vpnServerRepository,
      tombstoneRepository: this.tombstoneRepository,
    });
  }

  /** Perbarui router dan paksa sinkronisasi parameter RADIUS runtime. */
  async updateRouter(params: {
    id: string;
    data: MikroTikRouterUpdateData;
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
  }): Promise<void> {
    await updateRouterMutation({
      ...params,
      routerRepository: this.routerRepository,
      networkRepository: this.networkRepository,
    });
  }

  /** Hapus router lalu deprovision konfigurasi MikroTik bila router masih ada. */
  async deleteRouter(params: {
    id: string;
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
  }): Promise<void> {
    await deleteRouterMutation({
      ...params,
      routerRepository: this.routerRepository,
      networkRepository: this.networkRepository,
      provisioningService: this.provisioningService,
      tombstoneRepository: this.tombstoneRepository,
    });
  }

  /** Generate user API terbatas untuk koneksi rutin ke router. */
  async generateApiUser(params: {
    id: string;
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
  }): Promise<{ success: boolean; username?: string; logs: string[] }> {
    return generateRouterApiUserMutation({
      ...params,
      routerRepository: this.routerRepository,
      networkRepository: this.networkRepository,
      provisioningService: this.provisioningService,
    });
  }

  /** Test koneksi API router dan sinkronkan status online/offline bila router tersimpan. */
  /**
   * Uji koneksi router. Router tersimpan (`routerId`) tunduk pada
   * `mikrotik:site_only` seperti endpoint router lain — dulu router site lain
   * bisa diuji (dan kredensialnya dipakai) lewat id-nya.
   */
  async testConnection(params: {
    tenantId: string;
    userId: string;
    restrictedToOwnSite: boolean;
    routerId?: string;
    vpnDraftId?: string;
    ipAddress?: string;
    apiPort?: number | string;
    apiUsername?: string;
    apiPassword?: string;
  }) {
    const { userId, restrictedToOwnSite, ...connection } = params;
    if (connection.routerId) {
      await this.getRouterById({
        id: connection.routerId,
        tenantId: connection.tenantId,
        userId,
        restrictedToOwnSite,
      });
    }
    return testRouterConnection({
      ...connection,
      routerRepository: this.routerRepository,
    });
  }

  /**
   * Cek status router dari tombol admin: super admin seluruh tenant, admin
   * tenant hanya tenant-nya, dan admin `mikrotik:site_only` hanya site-nya
   * (tanpa site → tidak ada router yang dicek).
   */
  async checkRouterStatus(params: {
    tenantId?: string | null;
    userId: string;
    isSuperAdmin: boolean;
    restrictedToOwnSite: boolean;
  }): Promise<number> {
    if (params.isSuperAdmin) return checkAllMikroTikRouterStatus();
    if (!params.tenantId) return 0;
    if (!params.restrictedToOwnSite) {
      return checkTenantMikroTikRouterStatus({ tenantId: params.tenantId });
    }
    const siteId = await resolveRestrictedSiteId(
      this.networkRepository,
      params.userId,
    );
    if (!siteId) return 0;
    return checkTenantMikroTikRouterStatus({
      tenantId: params.tenantId,
      siteId,
    });
  }
}
