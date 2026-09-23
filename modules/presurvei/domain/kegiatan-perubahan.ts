import type { KegiatanHasil } from "./entities/Kegiatan";

/**
 * Perubahan kegiatan presurvei lewat jalur ubah — fungsi murni, tanpa I/O.
 *
 * Hanya tiga medan yang boleh diubah setelah kegiatan dicatat. Medan lain
 * (jenis, waktu, pelaku, koordinat, foto, data teknis, tautan) menggeser
 * angka laporan pencapaian atau lahir dari perangkat lapangan.
 */

/** Nilai medan kegiatan yang boleh diubah setelah dicatat. */
export interface NilaiKegiatanDapatDiubah {
  catatan: string | null;
  ditemuiNama: string | null;
  hasil: KegiatanHasil;
}

export type MedanKegiatanDapatDiubah = keyof NilaiKegiatanDapatDiubah;

/** Masukan ubah: medan yang tidak dikirim tidak disentuh. */
export type UbahKegiatanInput = Partial<NilaiKegiatanDapatDiubah>;

/** Satu medan yang berubah beserta nilai sebelum dan sesudahnya. */
export interface NilaiBerubah<T> {
  dari: T;
  ke: T;
}

/** Isi satu baris jejak audit: HANYA medan yang benar-benar berubah. */
export type PerubahanKegiatan = {
  [Medan in MedanKegiatanDapatDiubah]?: NilaiBerubah<
    NilaiKegiatanDapatDiubah[Medan]
  >;
};

/**
 * `Record` memaksa medan baru di `NilaiKegiatanDapatDiubah` ikut didaftarkan
 * saat kompilasi, sehingga diff tidak diam-diam melewatkannya.
 */
const PENANDA_MEDAN: Record<MedanKegiatanDapatDiubah, true> = {
  catatan: true,
  ditemuiNama: true,
  hasil: true,
};

const MEDAN_DAPAT_DIUBAH = Object.keys(
  PENANDA_MEDAN,
) as MedanKegiatanDapatDiubah[];

type PerubahanLonggar = Partial<
  Record<MedanKegiatanDapatDiubah, NilaiBerubah<unknown>>
>;

/**
 * Selisih antara nilai tersimpan dan masukan ubah.
 *
 * Medan yang tidak dikirim (`undefined`) dilewati; `null` adalah nilai baru
 * yang sah (mengosongkan). Perbandingannya `===`, bukan truthiness: `""` ke
 * `null` adalah perubahan nyata.
 */
export function hitungPerubahanKegiatan(
  lama: NilaiKegiatanDapatDiubah,
  masukan: UbahKegiatanInput,
): PerubahanKegiatan {
  const perubahan: PerubahanLonggar = {};

  for (const medan of MEDAN_DAPAT_DIUBAH) {
    const ke = masukan[medan];
    if (ke === undefined || ke === lama[medan]) continue;
    perubahan[medan] = { dari: lama[medan], ke };
  }

  return perubahan as PerubahanKegiatan;
}

/** Apakah perubahan ini kosong — tidak ada yang perlu ditulis. */
export function isTanpaPerubahan(perubahan: PerubahanKegiatan): boolean {
  return Object.keys(perubahan).length === 0;
}

/** Nilai yang ditulis ke kegiatan: sisi `ke` dari setiap medan berubah. */
export function nilaiBaruDariPerubahan(
  perubahan: PerubahanKegiatan,
): UbahKegiatanInput {
  const nilai: Partial<Record<MedanKegiatanDapatDiubah, unknown>> = {};

  for (const medan of MEDAN_DAPAT_DIUBAH) {
    const berubah = perubahan[medan];
    if (berubah !== undefined) nilai[medan] = berubah.ke;
  }

  return nilai as UbahKegiatanInput;
}
