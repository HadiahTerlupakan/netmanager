import { buildRABTrackingDataset } from "@/modules/finance/client";

import { bulatkanRupiah } from "../domain/bagi-hasil-proyek";
import { hitungPorsiModal } from "../domain/porsi-investor-proyek";
import {
  keCapaianTracking,
  keInputTracking,
  type ProyekRabUntukTracking,
} from "./rab-tracking-input";

/** Hasil satu bulan aktual proyek dari sudut pandang seorang investor. */
export interface HasilBulananInvestor {
  month: number;
  /** Pendapatan yang dipakai hitungan RAB. */
  revenue: number;
  /** Biaya operasional yang dipakai hitungan RAB (rencana bulanan RAB). */
  opex: number;
  /** Bagi hasil milik investor ini. */
  myProfitShare: number;
  /** Pengembalian modal milik investor ini. */
  myCapitalReturn: number;
}

export interface HasilInvestorProyek {
  bulanan: HasilBulananInvestor[];
  totalBagiHasil: number;
  totalPengembalianModal: number;
}

type ProyekDenganModalInvestor = ProyekRabUntukTracking & {
  investors: { investmentAmount: bigint }[];
};

/**
 * Hasil bulan-bulan aktual proyek untuk satu investor, memakai mesin tracking
 * RAB yang sama dengan halaman admin dan perhitungan bagi hasil — sehingga
 * angka di portal investor sama dengan bagi hasil yang dibayarkan.
 */
export function hitungHasilInvestorProyek(
  proyek: ProyekDenganModalInvestor,
  modalInvestor: bigint,
): HasilInvestorProyek {
  const porsi = hitungPorsiModal(
    modalInvestor,
    proyek.investors.map((investor) => investor.investmentAmount),
  );
  const { rows } = buildRABTrackingDataset(keInputTracking(proyek), keCapaianTracking(proyek));
  const bulanan = rows
    .filter((baris) => !baris.isAutoAssumed)
    .map((baris) => ({
      month: baris.month,
      revenue: baris.displayRevenue,
      opex: baris.displayRevenue - baris.grossProfit,
      myProfitShare: bulatkanRupiah(baris.investorShare * porsi),
      myCapitalReturn: bulatkanRupiah(baris.recoveryInstallment * porsi),
    }));
  return {
    bulanan,
    totalBagiHasil: bulatkanRupiah(bulanan.reduce((jumlah, b) => jumlah + b.myProfitShare, 0)),
    totalPengembalianModal: bulatkanRupiah(
      bulanan.reduce((jumlah, b) => jumlah + b.myCapitalReturn, 0),
    ),
  };
}
