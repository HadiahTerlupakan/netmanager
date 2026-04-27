import type {
  AcsVendorEntity,
  AcsWifiSecurityEntity,
} from "../entities/AcsSettings";

export interface AcsVendorInput {
  name: string;
  manufacturerPatterns: string;
  productPatterns: string;
  parameterPrefix?: string | null;
  priority?: number;
  enabled?: boolean;
  description?: string | null;
}

export interface AcsWifiSecurityInput {
  productClass: string;
  parameterPath: string;
  wpaTypes?: string | null;
  encryptTypes?: string | null;
}

export interface IAcsSettingsRepository {
  findAllVendors(): Promise<AcsVendorEntity[]>;
  createVendor(payload: AcsVendorInput): Promise<AcsVendorEntity>;
  updateVendor(id: string, payload: AcsVendorInput): Promise<AcsVendorEntity>;
  deleteVendor(id: string): Promise<void>;
  findWifiSecurityByTenant(
    tenantId?: string | null,
  ): Promise<AcsWifiSecurityEntity[]>;
  upsertWifiSecurityByTenantAndProductClass(
    tenantId: string | null,
    payload: AcsWifiSecurityInput,
  ): Promise<AcsWifiSecurityEntity>;
  updateWifiSecurity(
    id: string,
    payload: AcsWifiSecurityInput,
  ): Promise<AcsWifiSecurityEntity>;
  deleteWifiSecurity(id: string): Promise<void>;
}
