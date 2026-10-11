import { getMappingService } from "@/modules/map";

/** Pesan galat bila ODP pelanggan tidak memenuhi syarat. */
export const ODP_TIDAK_VALID_MESSAGE =
  "ODP tidak valid: harus berupa ODP yang sudah terpasang";

/** Lingkup tenant pemilik pelanggan yang sedang ditulis. */
export type OdpTenantScope = {
  tenantId?: string | null;
  isSuperAdmin?: boolean | null;
};

/**
 * Apakah `odpId` boleh dipakai sebagai ODP pelanggan: node harus ada, bertipe
 * `odp`, dan sudah terpasang (bukan titik rencana OSP). `Pelanggan.odpId`
 * adalah FK mentah ke `mapping_nodes`, jadi tanpa pemeriksaan ini pemanggil
 * API bisa menyambungkan pelanggan ke ODP yang fisiknya belum ada.
 *
 * Nilai kosong (tanpa ODP) selalu diterima.
 */
export async function isOdpAssignable(
  odpId: string | null | undefined,
  scope: OdpTenantScope,
): Promise<boolean> {
  if (!odpId) return true;

  // Tanpa tenant dan bukan super admin, pelanggan tidak punya batas tenant
  // yang bisa disaring; perlakukan sebagai super admin seperti jalur lain.
  const isSuperAdmin = Boolean(scope.isSuperAdmin) || !scope.tenantId;
  return getMappingService().isInstalledOdp(
    { tenantId: scope.tenantId, isSuperAdmin },
    odpId,
  );
}
