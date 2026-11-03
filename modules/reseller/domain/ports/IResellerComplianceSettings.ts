/** Pengaturan tata kelola reseller per tenant (kepatuhan & pemisahan tugas). */
export interface IResellerComplianceSettings {
  /** True bila tenant mewajibkan reseller patuh sebelum menerima pelanggan baru. */
  isComplianceRequired(tenantId: string): Promise<boolean>;
  /** Simpan pengaturan wajib kepatuhan untuk tenant. */
  setComplianceRequired(tenantId: string, isRequired: boolean): Promise<void>;
  /**
   * True bila tenant mewajibkan pembayar settlement berbeda dari penyetujunya
   * (pemisahan tugas). Default mati.
   */
  isSettlementSeparateApproverRequired(tenantId: string): Promise<boolean>;
  /** Simpan pengaturan pemisahan penyetuju & pembayar settlement. */
  setSettlementSeparateApproverRequired(
    tenantId: string,
    isRequired: boolean,
  ): Promise<void>;
}
