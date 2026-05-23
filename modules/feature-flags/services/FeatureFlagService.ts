import { logger } from "@/lib/logger";
import { cache, tenantCacheKey } from "@/lib/cache";
import {
  FEATURE_MODULES,
  isFeatureModuleCode,
  type FeatureModuleCode,
} from "@/lib/feature-modules";
import type {
  IFeatureFlagRepository,
  TenantFeatureFlagRow,
} from "../domain/ports/IFeatureFlagRepository";
import type {
  AdminFeatureFlagListItemDTO,
  FeatureFlagDTO,
} from "../dto/FeatureFlagDTO";
import { FeatureFlagRepository } from "../repositories/FeatureFlagRepository";

const CACHE_TTL_SECONDS = 5 * 60;
const CACHE_KEY = "feature-flags:disabled";

/**
 * Service untuk feature flag per-tenant.
 *
 * Kontrak default: bila row `(tenantId, feature)` tidak ada → feature dianggap
 * **enabled**. Disable hanya direpresentasikan oleh row eksplisit dengan
 * `enabled: false`. Approach ini menghindari backfill saat fitur baru ditambah
 * — tenant existing langsung dapat akses ke modul baru tanpa migrasi data.
 */
export class FeatureFlagService {
  constructor(
    private readonly repo: IFeatureFlagRepository = new FeatureFlagRepository(),
  ) {}

  /** Cek apakah feature aktif untuk tenant. */
  async isEnabled(
    tenantId: string,
    feature: FeatureModuleCode,
  ): Promise<boolean> {
    const disabled = await this.getDisabledFeatures(tenantId);
    return !disabled.includes(feature);
  }

  /** Ambil daftar feature yang DISABLE (cached). */
  async getDisabledFeatures(tenantId: string): Promise<FeatureModuleCode[]> {
    const key = tenantCacheKey(tenantId, CACHE_KEY);
    const cached = cache.get<FeatureModuleCode[]>(key);
    if (cached) {
      return cached;
    }

    const rows = await this.repo.findAllByTenant(tenantId);
    const disabled = rows
      .filter((row) => !row.enabled)
      .map((row) => row.feature)
      .filter(isFeatureModuleCode);
    cache.set(key, disabled, CACHE_TTL_SECONDS);
    return disabled;
  }

  /** Update satu feature flag (super admin action). */
  async setFeature(
    tenantId: string,
    feature: FeatureModuleCode,
    enabled: boolean,
    updatedBy: string | null,
  ): Promise<FeatureFlagDTO> {
    const row = await this.repo.upsert(tenantId, feature, enabled, updatedBy);
    cache.invalidateTenant(tenantId);
    logger.info(
      `[FeatureFlag] tenant=${tenantId} feature=${feature} enabled=${enabled} by=${updatedBy ?? "unknown"}`,
    );
    return toDTO(row);
  }

  /**
   * Update batch — atomic per row, tapi cache invalidate hanya sekali di akhir.
   */
  async setBatch(
    tenantId: string,
    updates: Array<{ feature: FeatureModuleCode; enabled: boolean }>,
    updatedBy: string | null,
  ): Promise<FeatureFlagDTO[]> {
    const result: FeatureFlagDTO[] = [];
    for (const update of updates) {
      const row = await this.repo.upsert(
        tenantId,
        update.feature,
        update.enabled,
        updatedBy,
      );
      result.push(toDTO(row));
      logger.info(
        `[FeatureFlag] tenant=${tenantId} feature=${update.feature} enabled=${update.enabled} by=${updatedBy ?? "unknown"}`,
      );
    }
    cache.invalidateTenant(tenantId);
    return result;
  }

  /**
   * Listing untuk UI super admin: gabungan catalog statis + state per tenant.
   * Module yang tidak punya row di DB → dianggap enabled (default).
   */
  async getCatalogForTenant(
    tenantId: string,
  ): Promise<AdminFeatureFlagListItemDTO[]> {
    const rows = await this.repo.findAllByTenant(tenantId);
    const byFeature = new Map<string, TenantFeatureFlagRow>();
    for (const row of rows) {
      byFeature.set(row.feature, row);
    }

    return FEATURE_MODULES.map((module) => {
      const row = byFeature.get(module.code);
      return {
        feature: module.code,
        label: module.label,
        description: module.description,
        group: module.group,
        enabled: row ? row.enabled : true,
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
      };
    });
  }
}

function toDTO(row: TenantFeatureFlagRow): FeatureFlagDTO {
  return {
    feature: row.feature as FeatureModuleCode,
    enabled: row.enabled,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}
