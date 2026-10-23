/**
 * Bagi hasil investor per proyek RAB untuk satu periode kalender.
 * Baris tracking RAB bernomor "bulan ke-n" sejak tanggal mulai proyek; hanya
 * bulan yang sudah punya capaian aktual (bukan proyeksi) yang dibagikan.
 * Fungsi murni.
 */

/** Baris tracking RAB yang dibutuhkan (subset `RABTrackingRow`). */
export interface BarisTrackingBagiHasil {
  month: number;
  isAutoAssumed: boolean;
  netProfit: number;
  investorShare: number;
  recoveryInstallment: number;
}

/** Bagian seorang investor dari bulan-bulan yang dibagikan. */
export interface BagianInvestorPeriode {
  /** Bulan ke-n proyek yang tercakup. */
  bulan: number[];
  /** Laba bersih proyek (semua investor + perusahaan) di bulan-bulan itu. */
  labaBersih: number;
  bagiHasil: number;
  pengembalianModal: number;
  /** Bagian investor ini terhadap laba bersih proyek, %. */
  persenDariLaba: number;
}

const DESIMAL_RUPIAH = 100;
const PERSEN_PENUH = 100;

/** Awal bulan kalender (UTC) untuk bulan ke-n proyek. */
export function awalBulanKalender(tanggalMulai: Date, bulanKe: number): Date {
  return new Date(
    Date.UTC(tanggalMulai.getUTCFullYear(), tanggalMulai.getUTCMonth() + bulanKe - 1, 1),
  );
}

function awalBulan(tanggal: Date): Date {
  return new Date(Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), 1));
}

/** Pembulatan ke sen (Decimal 19,2). */
export function bulatkanRupiah(nilai: number): number {
  return Math.round(nilai * DESIMAL_RUPIAH) / DESIMAL_RUPIAH;
}

/** Bulan aktual proyek yang jatuh di dalam periode [mulai, selesai]. */
export function barisDalamPeriode<T extends BarisTrackingBagiHasil>(
  baris: readonly T[],
  tanggalMulaiProyek: Date,
  periodeMulai: Date,
  periodeSelesai: Date,
): T[] {
  const batasAwal = awalBulan(periodeMulai).getTime();
  const batasAkhir = periodeSelesai.getTime();
  return baris.filter((b) => {
    if (b.isAutoAssumed) return false;
    const bulan = awalBulanKalender(tanggalMulaiProyek, b.month).getTime();
    return bulan >= batasAwal && bulan <= batasAkhir;
  });
}

/**
 * Bagian seorang investor dari baris-baris bulan. Dibulatkan PER BULAN lalu
 * dijumlah — sama dengan portal investor sehingga angka tampil = angka dibayar.
 */
export function bagianInvestor(
  baris: readonly BarisTrackingBagiHasil[],
  porsiModal: number,
): BagianInvestorPeriode {
  const jumlah = baris.reduce(
    (total, b) => ({
      labaBersih: total.labaBersih + b.netProfit,
      bagiHasil: total.bagiHasil + bulatkanRupiah(b.investorShare * porsiModal),
      pengembalianModal: total.pengembalianModal + bulatkanRupiah(b.recoveryInstallment * porsiModal),
    }),
    { labaBersih: 0, bagiHasil: 0, pengembalianModal: 0 },
  );
  const bagiHasil = bulatkanRupiah(jumlah.bagiHasil);
  const persen = jumlah.labaBersih > 0 ? (bagiHasil / jumlah.labaBersih) * PERSEN_PENUH : 0;
  return {
    bulan: baris.map((b) => b.month),
    labaBersih: bulatkanRupiah(jumlah.labaBersih),
    bagiHasil,
    pengembalianModal: bulatkanRupiah(jumlah.pengembalianModal),
    persenDariLaba: Math.round(persen * DESIMAL_RUPIAH) / DESIMAL_RUPIAH,
  };
}
