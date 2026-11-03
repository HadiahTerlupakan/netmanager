import type { LegalPartyType } from "../domain/entities/LegalDocument";
import { daysUntil } from "../domain/legal-rules";
import {
  LegalPartyContractRepository,
  type PartyContractRenewalRow,
  type PartyContractRow,
} from "../repositories/LegalPartyContractRepository";

/**
 * Jarak maksimum (hari) antara akhir kontrak lama dan mulai penggantinya agar
 * dianggap bersambung: kontrak berakhir 31 Des, pengganti mulai 1 Jan.
 */
const SEAMLESS_RENEWAL_GAP_DAYS = 1;

/**
 * Ringkasan satu kontrak milik pihak lain (mis. PKS reseller) untuk modul
 * lain yang perlu menilai kepatuhan. Sengaja tanpa judul/isi: kategori
 * dokumen bisa rahasia, sedangkan status berlaku tidak.
 */
export interface PartyContractSnapshot {
  documentId: string;
  partyId: string;
  startDate: Date | null;
  /**
   * Akhir masa berlaku efektif. Untuk kontrak yang sudah diperpanjang dengan
   * pengganti yang bersambung dan belum mulai, ini akhir masa pengganti.
   */
  endDate: Date | null;
  /** Sisa hari kalender WIB sampai `endDate`; null bila tanpa tanggal akhir. */
  daysLeft: number | null;
  /** False bila tanggal mulai masih di masa depan. */
  hasStarted: boolean;
}

/** Sumber baris kontrak; dipisah agar bisa diganti di tes. */
export interface PartyContractSource {
  findMonitoredContracts(params: {
    tenantId: string | null;
    partyType: LegalPartyType;
    partyIds: readonly string[];
  }): Promise<PartyContractRow[]>;
}

function hasStartedBy(startDate: Date | null, now: Date): boolean {
  return !startDate || daysUntil(startDate, now) <= 0;
}

function activeRenewal(row: PartyContractRow): PartyContractRenewalRow | null {
  return row.renewedBy && !row.renewedBy.terminatedAt ? row.renewedBy : null;
}

function isSeamless(
  previousEnd: Date | null,
  renewal: PartyContractRenewalRow,
): boolean {
  if (!previousEnd || !renewal.startDate) return true;
  return daysUntil(renewal.startDate, previousEnd) <= SEAMLESS_RENEWAL_GAP_DAYS;
}

/**
 * Akhir efektif kontrak, atau `null` bila barisnya tidak perlu ditampilkan
 * karena penggantinya sudah berlaku (pengganti muncul sebagai barisnya sendiri).
 */
function resolveEffectiveEnd(
  row: PartyContractRow,
  now: Date,
): { endDate: Date | null } | null {
  const renewal = activeRenewal(row);
  if (!renewal) return { endDate: row.endDate };
  if (hasStartedBy(renewal.startDate, now)) return null;
  return isSeamless(row.endDate, renewal)
    ? { endDate: renewal.endDate }
    : { endDate: row.endDate };
}

/** API baca kontrak per pihak untuk modul lain. */
export class LegalPartyContractReader {
  constructor(
    private readonly source: PartyContractSource = new LegalPartyContractRepository(),
  ) {}

  /**
   * Kontrak yang belum diakhiri untuk pihak-pihak tertentu, termasuk yang
   * sudah kedaluwarsa atau belum mulai (pemanggil yang menilai). Kontrak lama
   * yang diperpanjang tetap dihitung sampai penggantinya mulai berlaku.
   */
  async listMonitoredContracts(params: {
    tenantId: string | null;
    partyType: LegalPartyType;
    partyIds: readonly string[];
    now?: Date;
  }): Promise<PartyContractSnapshot[]> {
    const now = params.now ?? new Date();
    const rows = await this.source.findMonitoredContracts(params);

    return rows.flatMap((row) => {
      if (!row.partyId) return [];
      const effective = resolveEffectiveEnd(row, now);
      if (!effective) return [];
      return [
        {
          documentId: row.id,
          partyId: row.partyId,
          startDate: row.startDate,
          endDate: effective.endDate,
          daysLeft: effective.endDate
            ? daysUntil(effective.endDate, now)
            : null,
          hasStarted: hasStartedBy(row.startDate, now),
        },
      ];
    });
  }
}
