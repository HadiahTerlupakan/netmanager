import { prismaRadius } from "@/lib/prisma-radius";
import type { prisma as defaultPrisma } from "@/lib/prisma";

import type {
  DashboardStatsEntity,
  NasEntity,
  RadIpPoolEntity,
  RadiusAccountingStatsEntity,
  RadiusSessionEntity,
  RadiusSessionHistoryOptionsEntity,
  RadiusSessionHistoryResultEntity,
  RadiusSessionTotalsEntity,
  RadiusSessionViewEntity,
} from "../domain/entities/RadiusEntity";
import { RadiusIpPoolRepository } from "./RadiusIpPoolRepository";
import { RadiusNasRepository } from "./RadiusNasRepository";
import { RadiusSessionRepository } from "./RadiusSessionRepository";
import { RadiusRepositoryCoreBase } from "./radius-repository-core.base";

type PrismaInstance = typeof defaultPrisma;

export abstract class RadiusRepositoryResourcesBase extends RadiusRepositoryCoreBase {
  protected readonly ipPoolRepository: RadiusIpPoolRepository;
  protected readonly nasRepository: RadiusNasRepository;
  protected readonly sessionRepository: RadiusSessionRepository;

  constructor(
    protected override prisma: PrismaInstance,
    radiusClient?: typeof prismaRadius,
  ) {
    super(prisma, radiusClient);
    this.ipPoolRepository = new RadiusIpPoolRepository(this.radiusClient);
    this.nasRepository = new RadiusNasRepository(this.radiusClient);
    this.sessionRepository = new RadiusSessionRepository(this.radiusClient);
  }

  async getActiveSessions(
    tenantId: string,
    username?: string,
  ): Promise<RadiusSessionEntity[]> {
    return this.sessionRepository.getActiveSessions(tenantId, username);
  }

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

  async addToIpPool(
    pool: RadIpPoolEntity,
    tenantId: string,
  ): Promise<RadIpPoolEntity> {
    return this.ipPoolRepository.addToIpPool(pool, tenantId);
  }

  async removeFromIpPool(ipAddress: string, tenantId: string): Promise<void> {
    await this.ipPoolRepository.removeFromIpPool(ipAddress, tenantId);
  }

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

  async returnIpToPool(ipAddress: string, tenantId: string): Promise<void> {
    await this.ipPoolRepository.returnIpToPool(ipAddress, tenantId);
  }

  async getIpPoolStats(
    tenantId: string,
    poolName?: string,
  ): Promise<{ total: number; used: number; available: number }> {
    return this.ipPoolRepository.getIpPoolStats(tenantId, poolName);
  }

  async getAllIpPools(tenantId: string): Promise<RadIpPoolEntity[]> {
    return this.ipPoolRepository.getAllIpPools(tenantId);
  }

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

  async getRecentSessions(
    tenantId: string,
    options: { page?: number; limit?: number; status?: "active" | "all" } = {},
  ): Promise<{ sessions: RadiusSessionViewEntity[]; total: number }> {
    return this.sessionRepository.getRecentSessions(tenantId, options);
  }

  async syncIpPoolToRadius(
    poolName: string,
    ipRange: string,
    tenantId: string,
  ): Promise<void> {
    await this.ipPoolRepository.syncIpPoolToRadius(poolName, ipRange, tenantId);
  }
}
