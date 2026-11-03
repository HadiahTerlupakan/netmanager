import type { PksContractSnapshot } from "../domain/reseller-compliance";
import type { IResellerPksDirectory } from "../domain/ports/IResellerPksDirectory";

/**
 * PKS reseller dari modul legal lewat API publiknya.
 *
 * Impor dinamis: `modules/legal` sudah mengimpor `modules/reseller` (direktori
 * pihak kontrak), jadi impor statis membentuk siklus modul saat dimuat.
 */
export class LegalResellerPksDirectory implements IResellerPksDirectory {
  /** Kontrak PKS per reseller, dikelompokkan berdasarkan id reseller. */
  async listContractsByReseller(
    tenantId: string | null,
    resellerIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly PksContractSnapshot[]>> {
    const grouped = new Map<string, PksContractSnapshot[]>();
    if (resellerIds.length === 0) return grouped;

    const { LegalPartyContractReader } = await import("@/modules/legal");
    const contracts =
      await new LegalPartyContractReader().listMonitoredContracts({
        tenantId,
        partyType: "RESELLER",
        partyIds: resellerIds,
      });
    for (const contract of contracts) {
      const list = grouped.get(contract.partyId) ?? [];
      list.push({
        documentId: contract.documentId,
        startDate: contract.startDate,
        endDate: contract.endDate,
        daysLeft: contract.daysLeft,
        hasStarted: contract.hasStarted,
      });
      grouped.set(contract.partyId, list);
    }
    return grouped;
  }
}
