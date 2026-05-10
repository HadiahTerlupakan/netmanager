import { TenantSettingsRepository } from "../repositories/TenantSettingsRepository";
import type { AutoRejectSettings } from "./AutoRejectService";

/** Service untuk mengelola tenant settings - wrapper untuk repository. */
export class TenantSettingsService {
  private repository: TenantSettingsRepository;

  constructor() {
    this.repository = new TenantSettingsRepository();
  }

  async getAutoRejectSettings(
    tenantId: string,
  ): Promise<AutoRejectSettings | null> {
    return this.repository.getAutoRejectSettings(tenantId);
  }

  async updateAutoRejectSettings(
    tenantId: string,
    settings: Partial<AutoRejectSettings>,
  ) {
    return this.repository.updateAutoRejectSettings(tenantId, settings);
  }

  async createDefaultSettings(tenantId: string) {
    return this.repository.createDefaultSettings(tenantId);
  }

  async deleteSettings(tenantId: string) {
    return this.repository.deleteSettings(tenantId);
  }
}

export function getTenantSettingsService() {
  return new TenantSettingsService();
}
