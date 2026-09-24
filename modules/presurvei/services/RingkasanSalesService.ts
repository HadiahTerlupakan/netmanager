import type { IRingkasanSalesRepository } from "../domain/ports/IRingkasanSalesRepository";
import {
  BATAS_PERLU_FOLLOW_UP,
  lengkapiHitunganPerJenis,
  periodeBulanUtc,
  pilihPerluFollowUp,
  rentangHariUtc,
  type RingkasanSales,
  type TargetSendiri,
} from "../domain/ringkasan-sales";
import { RingkasanSalesRepository } from "../repositories/RingkasanSalesRepository";
import { TargetService, type BarisLaporan } from "./TargetService";

/** Masukan ringkasan: identitas dan tenant sesi, serta jam server. */
export interface MasukanRingkasanSales {
  userId: string;
  tenantId: string;
  sekarang: Date;
}

/**
 * Orkestrasi ringkasan Beranda sales mobile.
 *
 * Tidak memuat otorisasi: route menurunkan `userId` dan `tenantId` dari sesi.
 */
export class RingkasanSalesService {
  constructor(
    private readonly repository: IRingkasanSalesRepository = new RingkasanSalesRepository(),
    private readonly targetService: Pick<
      TargetService,
      "pencapaianSendiri"
    > = new TargetService(),
  ) {}

  /** Ringkasan milik `userId` untuk hari dan bulan UTC yang memuat `sekarang`. */
  async ringkasan(masukan: MasukanRingkasanSales): Promise<RingkasanSales> {
    const { userId, tenantId, sekarang } = masukan;
    const hariIni = rentangHariUtc(sekarang);
    const [hitungan, target, prospekAktif] = await Promise.all([
      this.repository.hitungKegiatanPerJenis(userId, hariIni, tenantId),
      this.targetService.pencapaianSendiri(
        userId,
        periodeBulanUtc(sekarang),
        tenantId,
      ),
      this.repository.daftarProspekAktif(userId, tenantId),
    ]);
    const kegiatanTerakhir = await this.repository.waktuKegiatanTerakhir(
      prospekAktif.map((prospek) => prospek.id),
      tenantId,
    );

    return {
      tanggal: hariIni.mulai,
      kegiatanHariIni: lengkapiHitunganPerJenis(hitungan),
      target: keTargetSendiri(target),
      perluFollowUp: pilihPerluFollowUp(
        prospekAktif,
        kegiatanTerakhir,
        BATAS_PERLU_FOLLOW_UP,
      ),
    };
  }
}

/** Buang `userId` dari baris laporan; null tetap null. */
function keTargetSendiri(baris: BarisLaporan | null): TargetSendiri | null {
  if (!baris) return null;
  return {
    periodeTahun: baris.periodeTahun,
    periodeBulan: baris.periodeBulan,
    pencapaian: baris.pencapaian,
  };
}
