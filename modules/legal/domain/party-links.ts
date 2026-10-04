import type { LegalPartyType } from "./entities/LegalDocument";

/**
 * Halaman admin tiap jenis pihak kontrak. Reseller tidak punya halaman detail
 * (diubah lewat modal di daftar), jadi tautannya ke daftar reseller.
 */
const PARTY_DETAIL_PATHS: Record<LegalPartyType, (id: string) => string> = {
  MITRA: (id) => `/admin/mitra/${id}`,
  RESELLER: () => "/admin/resellers",
  PELANGGAN: (id) => `/admin/pelanggan/ppp/${id}`,
  VENDOR: (id) => `/admin/procurement/suppliers/${id}`,
  SITE: (id) => `/admin/workorders/sites/${id}`,
};

/** Tautan ke halaman pihak, atau null bila pihak hanya berupa teks. */
export function partyDetailUrl(
  partyType: LegalPartyType | null,
  partyId: string | null,
): string | null {
  if (!partyType || !partyId) return null;

  return PARTY_DETAIL_PATHS[partyType](partyId);
}
