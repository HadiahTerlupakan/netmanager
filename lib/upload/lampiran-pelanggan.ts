/**
 * Lampiran tiket yang diunggah pelanggan disimpan di folder miliknya sendiri
 * (`tickets/p-<pelangganId>/`). Folder itulah bukti kepemilikan: rute balasan
 * hanya menerima lampiran dari sana, dan `/uploads/` membuka folder itu hanya
 * untuk pemiliknya. Jalur yang sekadar ditulis pelanggan di balasannya tidak
 * membuktikan apa pun.
 */

const JALUR_LAMPIRAN_TIKET =
  /^\/uploads\/(?:tenants\/[^/]+\/)?tickets\/([^/]+)\/[^/]+$/;

/** Subfolder unggahan lampiran tiket milik satu pelanggan. */
export function folderLampiranPelanggan(pelangganId: string): string {
  return `p-${pelangganId}`;
}

/** Apakah jalur ini unggahan lampiran tiket pelanggan itu sendiri. */
export function lampiranMilikPelanggan(
  pathname: string,
  pelangganId: string,
): boolean {
  const folder = JALUR_LAMPIRAN_TIKET.exec(pathname)?.[1];
  return folder === folderLampiranPelanggan(pelangganId);
}
