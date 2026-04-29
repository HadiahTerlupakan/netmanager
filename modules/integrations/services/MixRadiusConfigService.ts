import { IntegrationFactory } from "@/modules/integrations/factories/IntegrationFactory";
import { mixRadiusConfigRepo } from "@/modules/integrations/repositories/MixRadiusConfigRepository";

export type MixRadiusConfigPayload = {
  name?: string;
  apiUrl?: string;
  baseUrl?: string;
  username?: string;
  password?: string;
  isDefault?: boolean;
  isActive?: boolean;
  apiKey?: string;
};

/**
 * Service for MixRadius config orchestration.
 */
export class MixRadiusConfigService {
  /**
   * Get active config based on tenant scope.
   */
  async getActiveConfig(tenantId?: string | null) {
    if (tenantId) {
      return mixRadiusConfigRepo.getActiveConfigByTenant(tenantId);
    }

    return mixRadiusConfigRepo.getActiveConfig();
  }

  /**
   * Get config list based on tenant scope.
   */
  async getConfigs(tenantId?: string) {
    if (tenantId) {
      return mixRadiusConfigRepo.getAllConfigsByTenant(tenantId);
    }

    return mixRadiusConfigRepo.getAllConfigs();
  }

  /**
   * Create MixRadius config for a tenant.
   */
  async createConfig(tenantId: string, payload: MixRadiusConfigPayload) {
    const validatedPayload = this.validateCreatePayload(payload);
    this.ensureRequiredFields(validatedPayload.missingFields);
    const normalizedConfig = this.buildNormalizedConfig(validatedPayload);

    if (!tenantId) {
      throw new Error("Tenant MixRadius tidak ditemukan untuk user ini");
    }

    return mixRadiusConfigRepo.createConfig({
      name: normalizedConfig.name,
      apiUrl: normalizedConfig.baseUrl,
      apiKey: payload.apiKey || "default-api-key",
      username: normalizedConfig.username,
      password: normalizedConfig.password,
      isDefault: this.resolveIsDefault(payload),
      lastSyncedAt: null,
      tenantId,
    });
  }

  /**
   * Update MixRadius config with optional tenant scoping.
   */
  async updateConfig(
    configId: string,
    payload: MixRadiusConfigPayload,
    tenantId?: string,
  ) {
    const updatePayload = this.buildUpdatePayload(payload);

    if (tenantId) {
      return mixRadiusConfigRepo.updateConfigForTenant(
        configId,
        tenantId,
        updatePayload,
      );
    }

    return mixRadiusConfigRepo.updateConfig(configId, updatePayload);
  }

  /**
   * Delete MixRadius config with optional tenant scoping.
   */
  async deleteConfig(configId: string, tenantId?: string) {
    if (tenantId) {
      return mixRadiusConfigRepo.deleteConfigForTenant(configId, tenantId);
    }

    return mixRadiusConfigRepo.deleteConfig(configId);
  }

  private validateCreatePayload(payload: MixRadiusConfigPayload) {
    const rawBaseUrl = payload.apiUrl || payload.baseUrl || "";
    const username = payload.username || "";
    const password = payload.password || "";
    const missingFields: string[] = [];

    if (!rawBaseUrl.trim()) {
      missingFields.push("API URL");
    }

    if (!username) {
      missingFields.push("Username");
    }

    if (!password) {
      missingFields.push("Password");
    }

    return {
      missingFields,
      name: payload.name || "Default",
      rawBaseUrl,
      username,
      password,
    };
  }

  private ensureRequiredFields(missingFields: string[]) {
    if (missingFields.length === 0) {
      return;
    }

    throw new Error(`Data berikut wajib diisi: ${missingFields.join(", ")}`);
  }

  private buildNormalizedConfig(input: {
    name: string;
    rawBaseUrl: string;
    username: string;
    password: string;
  }) {
    const normalizedConfig = IntegrationFactory.createMixRadiusConfig({
      name: input.name,
      baseUrl: input.rawBaseUrl,
      username: input.username,
      password: input.password,
    });
    const validation = IntegrationFactory.validateUrl(normalizedConfig.baseUrl);

    if (!validation.isValid) {
      throw new Error(validation.error || "API URL tidak valid");
    }

    return normalizedConfig;
  }

  private buildUpdatePayload(payload: MixRadiusConfigPayload) {
    const updatePayload: Record<string, unknown> = {};

    if (typeof payload.name === "string") {
      updatePayload.name = payload.name || "Default";
    }

    if (typeof payload.username === "string") {
      updatePayload.username = payload.username;
    }

    if (typeof payload.password === "string" && payload.password.trim()) {
      updatePayload.password = payload.password;
    }

    if (payload.apiKey !== undefined) {
      updatePayload.apiKey = payload.apiKey;
    }

    const rawBaseUrl =
      typeof payload.apiUrl === "string"
        ? payload.apiUrl
        : typeof payload.baseUrl === "string"
          ? payload.baseUrl
          : undefined;

    if (rawBaseUrl !== undefined) {
      const normalizedConfig = this.buildNormalizedConfig({
        name:
          typeof payload.name === "string"
            ? payload.name || "Default"
            : "Default",
        rawBaseUrl,
        username: typeof payload.username === "string" ? payload.username : "",
        password: typeof payload.password === "string" ? payload.password : "",
      });
      updatePayload.apiUrl = normalizedConfig.baseUrl;
    }

    const resolvedIsDefault = this.resolveOptionalIsDefault(payload);
    if (resolvedIsDefault !== undefined) {
      updatePayload.isDefault = resolvedIsDefault;
    }

    return updatePayload;
  }

  private resolveIsDefault(payload: MixRadiusConfigPayload): boolean {
    return payload.isDefault ?? payload.isActive ?? false;
  }

  private resolveOptionalIsDefault(payload: MixRadiusConfigPayload) {
    if (payload.isDefault !== undefined) {
      return payload.isDefault;
    }

    if (payload.isActive !== undefined) {
      return payload.isActive;
    }

    return undefined;
  }
}

let mixRadiusConfigServiceInstance: MixRadiusConfigService | null = null;

/**
 * Get singleton MixRadius config service.
 */
export function getMixRadiusConfigService() {
  if (!mixRadiusConfigServiceInstance) {
    mixRadiusConfigServiceInstance = new MixRadiusConfigService();
  }

  return mixRadiusConfigServiceInstance;
}
