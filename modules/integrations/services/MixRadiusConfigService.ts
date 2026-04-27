import type {
  IMixRadiusConfigRepository,
  MixRadiusConfigCreateInput,
  MixRadiusConfigUpdateInput,
} from "../domain/ports/IMixRadiusConfigRepository";
import { MixRadiusConfigRepository } from "../repositories/MixRadiusConfigRepository";

export class MixRadiusConfigService {
  constructor(
    private readonly configRepository: IMixRadiusConfigRepository = new MixRadiusConfigRepository(),
  ) {}

  /** Get all MixRadius configs. */
  async getAllConfigs() {
    return this.configRepository.getAllConfigs();
  }

  /** Get all MixRadius configs for a tenant. */
  async getAllConfigsByTenant(tenantId: string) {
    return this.configRepository.getAllConfigsByTenant(tenantId);
  }

  /** Get the active MixRadius config. */
  async getActiveConfig() {
    return this.configRepository.getActiveConfig();
  }

  /** Get the active MixRadius config for a tenant. */
  async getActiveConfigByTenant(tenantId: string) {
    return this.configRepository.getActiveConfigByTenant(tenantId);
  }

  /** Create a MixRadius config. */
  async createConfig(data: MixRadiusConfigCreateInput) {
    return this.configRepository.createConfig(data);
  }

  /** Update a MixRadius config. */
  async updateConfig(id: string, data: MixRadiusConfigUpdateInput) {
    return this.configRepository.updateConfig(id, data);
  }

  /** Update a MixRadius config for a tenant. */
  async updateConfigForTenant(
    id: string,
    tenantId: string,
    data: MixRadiusConfigUpdateInput,
  ) {
    return this.configRepository.updateConfigForTenant(id, tenantId, data);
  }

  /** Delete a MixRadius config. */
  async deleteConfig(id: string) {
    return this.configRepository.deleteConfig(id);
  }

  /** Delete a MixRadius config for a tenant. */
  async deleteConfigForTenant(id: string, tenantId: string) {
    return this.configRepository.deleteConfigForTenant(id, tenantId);
  }
}

let mixRadiusConfigServiceInstance: MixRadiusConfigService | null = null;

/** Get the shared MixRadius config service instance. */
export function getMixRadiusConfigService() {
  if (!mixRadiusConfigServiceInstance) {
    mixRadiusConfigServiceInstance = new MixRadiusConfigService();
  }

  return mixRadiusConfigServiceInstance;
}
