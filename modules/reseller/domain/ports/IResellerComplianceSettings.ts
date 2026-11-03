/** Pengaturan kepatuhan reseller per tenant. */
export interface IResellerComplianceSettings {
  /** True bila tenant mewajibkan reseller patuh sebelum menerima pelanggan baru. */
  isComplianceRequired(tenantId: string): Promise<boolean>;
  /** Simpan pengaturan wajib kepatuhan untuk tenant. */
  setComplianceRequired(tenantId: string, isRequired: boolean): Promise<void>;
}
