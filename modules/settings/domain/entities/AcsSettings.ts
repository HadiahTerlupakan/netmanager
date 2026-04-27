export interface AcsVendorEntity {
  id: string;
  name: string;
  manufacturerPatterns: string;
  productPatterns: string;
  parameterPrefix: string | null;
  priority: number;
  enabled: boolean;
  description: string | null;
  serviceListPath: string | null;
  vlanIdPath: string | null;
}

export interface AcsWifiSecurityEntity {
  id: string;
  tenantId: string | null;
  productClass: string;
  parameterPath: string;
  wpaTypes: string | null;
  encryptTypes: string | null;
}
