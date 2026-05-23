/**
 * Kode feature module yang dipakai sebagai key di tabel TenantFeatureFlag.
 * Domain layer hanya butuh string opaque — definisi catalog konkretnya
 * tinggal di lib/feature-modules.ts (infrastruktur). Adapter/services
 * boleh menyempitkan tipe ini ke union literal saat memanggil port.
 */
export type FeatureModuleCode = string;

export interface TenantFeatureFlagRow {
  feature: string;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface IFeatureFlagRepository {
  /** Ambil semua row flag untuk satu tenant. */
  findAllByTenant(tenantId: string): Promise<TenantFeatureFlagRow[]>;

  /** Ambil row spesifik (tenantId, feature). Null bila tidak ada. */
  findByFeature(
    tenantId: string,
    feature: FeatureModuleCode,
  ): Promise<TenantFeatureFlagRow | null>;

  /** Upsert satu row flag. */
  upsert(
    tenantId: string,
    feature: FeatureModuleCode,
    enabled: boolean,
    updatedBy: string | null,
  ): Promise<TenantFeatureFlagRow>;
}
