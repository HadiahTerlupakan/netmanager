/**
 * Minimal pelanggan entity shape needed by finance module.
 * Avoids importing full PelangganEntity from pelanggan module.
 */
export interface PelangganMinimal {
  id: string;
  nama: string;
  email?: string | null;
  noTelp?: string | null;
  siteId?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

/**
 * Interface for pelanggan data access needed by finance module.
 * Implemented by PelangganBillingBridgeService in modules/pelanggan.
 */
export interface IPelangganBillingBridge {
  findEligibleForBilling(
    dueDateStart: Date,
    dueDateEnd: Date,
    limit: number,
    offset: number,
  ): Promise<unknown[]>;
  findByIdWithHargaPaket(id: string): Promise<unknown>;
  findById(id: string): Promise<PelangganMinimal | null>;
  findByIdWithPushToken(pelangganId: string): Promise<unknown>;
  findManyWithPushToken(tokens: string[]): Promise<unknown[]>;
  clearPushTokens(tokens: string[]): Promise<unknown>;
  updateStatus(id: string, status: string): Promise<unknown>;
  updateJatuhTempo(id: string, jatuhTempo: Date): Promise<unknown>;
  update(id: string, data: Record<string, unknown>): Promise<unknown>;
  findBySiteId(siteId: string): Promise<unknown[]>;
}

/**
 * Interface for pelanggan service methods needed by finance module.
 */
export interface IPelangganService {
  getPelanggan(id: string): Promise<PelangganMinimal | null>;
  updateStatusPelanggan(
    id: string,
    status: string,
    reason?: string,
  ): Promise<unknown>;
}

/**
 * Interface for pelanggan admin query methods needed by finance module.
 */
export interface IPelangganAdminQuery {
  getPppMutationContext(
    id: string,
    tenantId?: string | null,
  ): Promise<{ siteId?: string | null; [key: string]: unknown } | null>;
}
