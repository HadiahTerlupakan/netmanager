import { buildRABTrackingDataset } from "@/modules/finance/client";

import { bulatkanRupiah } from "../domain/bagi-hasil-proyek";
import { hitungPorsiModal, persenBagiHasilInvestor } from "../domain/porsi-investor-proyek";
import {
  keCapaianTracking,
  keInputTracking,
  type ProyekRabUntukTracking,
} from "./rab-tracking-input";

/** Sama dengan bawaan mesin tracking RAB bila field persen kosong. */
const PERSEN_BAGI_HASIL_BAWAAN = 50;
const PERSEN_BAWAAN_BEP: Record<string, number> = { false: 80, true: 60 };

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
  /**
   * Persen bagi hasil milik investor ini yang berlaku untuk bulan berikutnya
   * (mode BEP: sebelum/sesudah modal lunas), sudah dikali porsi modalnya.
   */
  persenBerlaku: number;
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
  const barisAktual = rows.filter((baris) => !baris.isAutoAssumed);
  const isModalLunas = (barisAktual.at(-1)?.remainingInvestment ?? 1) <= 0;
  // Mode BEP: bila modal sudah lunas di bulan aktual terakhir, bulan berikutnya
  // memakai persen sesudah BEP; selain itu persen sebelum BEP.
  const persenSemuaInvestor =
    proyek.investorProfitShareMode === "TIERED_AFTER_BEP"
      ? (isModalLunas
          ? proyek.investorProfitShareAfterBepPercent
          : proyek.investorProfitShareBeforeBepPercent) ?? PERSEN_BAWAAN_BEP[String(isModalLunas)]
      : (proyek.investorProfitSharePercent ?? PERSEN_BAGI_HASIL_BAWAAN);
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
    persenBerlaku: persenBagiHasilInvestor(persenSemuaInvestor, porsi),
    bulanan,
    totalBagiHasil: bulatkanRupiah(bulanan.reduce((jumlah, b) => jumlah + b.myProfitShare, 0)),
    totalPengembalianModal: bulatkanRupiah(
      bulanan.reduce((jumlah, b) => jumlah + b.myCapitalReturn, 0),
    ),
  };
}
