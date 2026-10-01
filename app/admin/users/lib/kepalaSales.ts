/** Satu kandidat kepala sales (`GET /api/admin/presurvei/kepala-sales`). */
export interface KandidatKepalaSales {
  id: string;
  nama: string;
}

/** Kepala sales yang sedang tersimpan pada user yang diubah. */
export interface KepalaSalesTersimpan {
  id: string;
  nama: string | null;
}

/** Akhiran opsi kepala sales tersimpan yang tidak lagi ada di daftar kandidat. */
const AKHIRAN_BUKAN_KANDIDAT = " (bukan kandidat lagi)";

/**
 * Opsi pemilih kepala sales.
 *
 * - User yang sedang diubah dibuang: server menolak kepala sales = diri sendiri.
 * - Kepala sales yang tersimpan tetap ditawarkan walau tidak lagi kandidat
 *   (role-nya dicabut/nonaktif) — tanpanya `<select>` menampilkan
 *   "tanpa kepala sales" padahal relasinya masih ada, dan menyimpan form
 *   tanpa menyentuh medan ini diam-diam tetap mempertahankannya.
 */
export function opsiKepalaSales(
  kandidat: readonly KandidatKepalaSales[],
  userIdDiubah: string | null,
  tersimpan: KepalaSalesTersimpan | null,
): KandidatKepalaSales[] {
  const opsi = kandidat.filter((calon) => calon.id !== userIdDiubah);
  if (tersimpan && !opsi.some((calon) => calon.id === tersimpan.id)) {
    opsi.push({
      id: tersimpan.id,
      nama: `${tersimpan.nama ?? tersimpan.id}${AKHIRAN_BUKAN_KANDIDAT}`,
    });
  }
  return opsi;
}

/**
 * Nilai `kepalaSalesId` yang dikirim ke API. Medan hanya tampil untuk user
 * sales, jadi mematikan sakelar Sales ikut melepas user dari timnya; string
 * kosong (opsi "tanpa kepala sales") dikirim sebagai null.
 */
export function kepalaSalesIdUntukDikirim(
  isSales: boolean,
  kepalaSalesId: string,
): string | null {
  return isSales && kepalaSalesId.length > 0 ? kepalaSalesId : null;
}
