/**
 * Gerbang modul fitur `reseller` per tenant. Dipakai jalur non-HTTP (event
 * handler) yang tidak melewati gerbang `feature` di `createHandler`.
 */
export interface IResellerModuleGate {
  /** True bila modul reseller aktif untuk tenant. */
  isEnabled(tenantId: string): Promise<boolean>;
}
