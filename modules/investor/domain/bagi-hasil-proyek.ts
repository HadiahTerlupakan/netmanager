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

/** Jumlah untuk SEMUA investor proyek dalam periode. */
export interface RingkasanPeriodeProyek {
  jumlahBulan: number;
  labaBersih: number;
  bagiHasilInvestor: number;
  pengembalianModal: number;
}

const DESIMAL_RUPIAH = 100;

/** Awal bulan kalender (UTC) untuk bulan ke-n proyek. */
export function awalBulanKalender(tanggalMulai: Date, bulanKe: number): Date {
  return new Date(
    Date.UTC(tanggalMulai.getUTCFullYear(), tanggalMulai.getUTCMonth() + bulanKe - 1, 1),
  );
}

function awalBulan(tanggal: Date): Date {
  return new Date(Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), 1));
}

/** Jumlahkan bulan aktual proyek yang jatuh di dalam periode [mulai, selesai]. */
export function ringkasPeriodeProyek(
  baris: readonly BarisTrackingBagiHasil[],
  tanggalMulaiProyek: Date,
  periodeMulai: Date,
  periodeSelesai: Date,
): RingkasanPeriodeProyek {
  const batasAwal = awalBulan(periodeMulai).getTime();
  const batasAkhir = periodeSelesai.getTime();
  const dalamPeriode = baris.filter((b) => {
    if (b.isAutoAssumed) return false;
    const bulan = awalBulanKalender(tanggalMulaiProyek, b.month).getTime();
    return bulan >= batasAwal && bulan <= batasAkhir;
  });
  return dalamPeriode.reduce<RingkasanPeriodeProyek>(
    (jumlah, b) => ({
      jumlahBulan: jumlah.jumlahBulan + 1,
      labaBersih: jumlah.labaBersih + b.netProfit,
      bagiHasilInvestor: jumlah.bagiHasilInvestor + b.investorShare,
      pengembalianModal: jumlah.pengembalianModal + b.recoveryInstallment,
    }),
    { jumlahBulan: 0, labaBersih: 0, bagiHasilInvestor: 0, pengembalianModal: 0 },
  );
}

/** Pembulatan ke sen (Decimal 19,2). */
export function bulatkanRupiah(nilai: number): number {
  return Math.round(nilai * DESIMAL_RUPIAH) / DESIMAL_RUPIAH;
}

/** Bagian satu investor dari ringkasan proyek sesuai porsi modalnya. */
export function bagianInvestor(ringkasan: RingkasanPeriodeProyek, porsiModal: number) {
  const bagiHasil = bulatkanRupiah(ringkasan.bagiHasilInvestor * porsiModal);
  const persen =
    ringkasan.labaBersih > 0 ? (bagiHasil / ringkasan.labaBersih) * 100 : 0;
  return {
    bagiHasil,
    pengembalianModal: bulatkanRupiah(ringkasan.pengembalianModal * porsiModal),
    persenDariLaba: Math.round(persen * DESIMAL_RUPIAH) / DESIMAL_RUPIAH,
  };
}
