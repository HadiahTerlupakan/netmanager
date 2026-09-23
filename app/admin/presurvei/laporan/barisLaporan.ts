import type {
  BarisLaporanDto,
  SalesPresurveiDto,
} from "@/modules/presurvei/client";

import { labelSales } from "../labelSales";

/** Satu metrik pencapaian dalam bentuk siap tampil. */
export interface MetrikTampilan {
  target: number;
  tercapai: number;
  persen: number;
  /**
   * Lebar bilah kemajuan, dibatasi 100 walau pencapaiannya melampaui. Nol
   * untuk metrik bertarget nol — lihat `isTargetNol`.
   */
  lebarBilah: number;
  /**
   * Target metrik ini nol. Domain memberinya persen 100
   * (`modules/presurvei/domain/target-rules.ts:53-54`), jadi tanpa penanda ini
   * bilahnya tampil penuh padahal tidak ada target yang dikejar.
   */
  isTargetNol: boolean;
}

/** Satu baris laporan dalam bentuk siap tampil. */
export interface BarisTampilan {
  userId: string;
  namaSales: string;
  kunjungan: MetrikTampilan;
  prospek: MetrikTampilan;
  konversi: MetrikTampilan;
  /** Seluruh targetnya nol — belum ditetapkan, bukan berkinerja sempurna. */
  isTanpaTarget: boolean;
}

const LEBAR_BILAH_MAKS = 100;
const LEBAR_BILAH_TANPA_TARGET = 0;

const PESAN_LAPORAN_KOSONG = "Belum ada target untuk periode ini.";
const PESAN_LAPORAN_GAGAL = "Laporan gagal dimuat.";

function keMetrik(metrik: BarisLaporanDto["kunjungan"]): MetrikTampilan {
  // `<= 0`, sama dengan penjaga `hitungPersen` (`target-rules.ts:53`).
  const isTargetNol = metrik.target <= 0;

  return {
    target: metrik.target,
    tercapai: metrik.tercapai,
    persen: metrik.persen,
    lebarBilah: isTargetNol
      ? LEBAR_BILAH_TANPA_TARGET
      : Math.min(metrik.persen, LEBAR_BILAH_MAKS),
    isTargetNol,
  };
}

/**
 * Bentuk tampilan dari baris laporan.
 *
 * Tidak menghitung ulang pencapaian — `hitungPencapaian` di domain sudah
 * membatasi persentase dan memperlakukan target nol sebagai tercapai penuh.
 * Yang ditambahkan hanya label sales, lebar bilah, dan penanda target nol
 * per metrik maupun per baris.
 */
export function keBarisTampilan(
  baris: readonly BarisLaporanDto[],
  daftarSales: readonly SalesPresurveiDto[],
): BarisTampilan[] {
  return baris.map((dto) => {
    const kunjungan = keMetrik(dto.kunjungan);
    const prospek = keMetrik(dto.prospek);
    const konversi = keMetrik(dto.konversi);

    return {
      userId: dto.userId,
      namaSales: labelSales(dto.userId, daftarSales),
      kunjungan,
      prospek,
      konversi,
      isTanpaTarget:
        kunjungan.isTargetNol && prospek.isTargetNol && konversi.isTargetNol,
    };
  });
}

/**
 * Pesan tabel tanpa baris: gagal memuat dibedakan dari periode kosong.
 *
 * Laporan disusun dari daftar target
 * (`modules/presurvei/services/TargetService.ts:52-53`), jadi laporan kosong
 * berarti belum ada target — bukan belum ada kegiatan.
 */
export function pesanLaporanKosong(isError: boolean): string {
  return isError ? PESAN_LAPORAN_GAGAL : PESAN_LAPORAN_KOSONG;
}
