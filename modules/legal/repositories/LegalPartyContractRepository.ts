import { prisma } from "@/modules/database";
import type { LegalPartyType } from "../domain/entities/LegalDocument";

/** Masa berlaku dokumen pengganti (hasil perpanjangan) sebuah kontrak. */
export interface PartyContractRenewalRow {
  startDate: Date | null;
  endDate: Date | null;
  terminatedAt: Date | null;
}

/** Baris kontrak minimal untuk ringkasan status kontrak per pihak. */
export interface PartyContractRow {
  id: string;
  partyId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  /** Dokumen pengganti bila kontrak ini sudah diperpanjang. */
  renewedBy: PartyContractRenewalRow | null;
}

/**
 * Kontrak (KONTRAK) yang belum diakhiri milik sekumpulan pihak, termasuk yang
 * sudah diperpanjang: perpanjangan biasanya dibuat sebelum kontrak lama habis,
 * dan kontrak lama tetap berlaku sampai tanggal akhirnya. Isolasi tenant
 * ditegakkan ekstensi klien Prisma; `tenantId` eksplisit ditambahkan bila
 * diketahui sebagai pertahanan berlapis untuk pemanggil di luar konteks request.
 */
export class LegalPartyContractRepository {
  /** Kontrak yang belum diakhiri untuk pihak-pihak yang diminta. */
  async findMonitoredContracts(params: {
    tenantId: string | null;
    partyType: LegalPartyType;
    partyIds: readonly string[];
  }): Promise<PartyContractRow[]> {
    if (params.partyIds.length === 0) return [];

    return prisma.legalDocument.findMany({
      where: {
        documentType: "KONTRAK",
        partyType: params.partyType,
        partyId: { in: [...params.partyIds] },
        terminatedAt: null,
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
      select: {
        id: true,
        partyId: true,
        startDate: true,
        endDate: true,
        renewedBy: {
          select: { startDate: true, endDate: true, terminatedAt: true },
        },
      },
    });
  }
}
