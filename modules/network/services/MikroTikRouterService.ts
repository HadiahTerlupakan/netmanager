import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type {
  MikroTikRouterCreateData,
  MikroTikRouterUpdateData,
  PaginatedRouterResult,
} from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";
import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import {
  getAuthorizedRouter,
  resolveRestrictedSiteId,
  RouterAccessDeniedError,
  RouterNotFoundError,
} from "./mikrotik-router.access";
import {
  createRouterMutation,
  deleteRouterMutation,
  generateRouterApiUserMutation,
  updateRouterMutation,
} from "./mikrotik-router.mutations";
import { testRouterConnection } from "./mikrotik-router.connection-test";

export { RouterAccessDeniedError, RouterNotFoundError };

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
    data: Omit<
      MikroTikRouterCreateData,
      "tenantId" | "secretRadius" | "authPort" | "accountingPort"
    >;
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
  async testConnection(params: {
    tenantId: string;
    routerId?: string;
    ipAddress?: string;
    apiPort?: number | string;
    apiUsername?: string;
    apiPassword?: string;
  }) {
    return testRouterConnection({
      ...params,
      routerRepository: this.routerRepository,
    });
  }
}
