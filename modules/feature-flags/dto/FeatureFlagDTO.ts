import type { FeatureModuleCode } from "@/lib/feature-modules";

export interface FeatureFlagDTO {
  feature: FeatureModuleCode;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

export interface TenantFeatureFlagsResponseDTO {
  /** Kode modul yang DISABLE untuk tenant ini. Modul yang tidak ada di sini = enabled. */
  disabledFeatures: FeatureModuleCode[];
}

export interface AdminFeatureFlagListItemDTO {
  feature: FeatureModuleCode;
  label: string;
  description: string;
  group: string;
  enabled: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}
