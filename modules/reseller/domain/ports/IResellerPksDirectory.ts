import type { PksContractSnapshot } from "../reseller-compliance";

/** Sumber dokumen PKS reseller (modul legal). */
export interface IResellerPksDirectory {
  /**
   * Kontrak PKS yang belum diakhiri/diperpanjang per reseller. Reseller tanpa
   * kontrak boleh tidak muncul di map.
   */
  listContractsByReseller(
    tenantId: string | null,
    resellerIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly PksContractSnapshot[]>>;
}
