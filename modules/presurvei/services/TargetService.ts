import type { PeriodeTarget, TargetEntity } from "../domain/entities/Target";
import type {
  IKegiatanRepository,
  RentangPeriode,
} from "../domain/ports/IKegiatanRepository";
import type { IProspekRepository } from "../domain/ports/IProspekRepository";
import type {
  DataTarget,
  ITargetRepository,
} from "../domain/ports/ITargetRepository";
import { rentangTertutupUtc } from "../domain/rentang-waktu";
import { hitungPencapaian, type Pencapaian } from "../domain/target-rules";
import { KegiatanRepository } from "../repositories/KegiatanRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";
import { TargetRepository } from "../repositories/TargetRepository";
import { PenugasanSalesService } from "./PenugasanSalesService";

/** Satu baris laporan: target seorang sales beserta pencapaiannya. */
export interface BarisLaporan {
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  pencapaian: Pencapaian;
}

const BULAN_BERIKUTNYA = 1;

/**
 * Orkestrasi target sales beserta laporan pencapaiannya.
 *
 * Realisasi dihitung di repository lewat agregasi, bukan dengan mengambil
 * seluruh baris lalu menjumlahkannya di sini — laporan satu bulan bisa
 * menyentuh ribuan kegiatan.
 */
export class TargetService {
  constructor(
    private readonly targetRepository: ITargetRepository = new TargetRepository(),
    private readonly kegiatanRepository: IKegiatanRepository = new KegiatanRepository(),
    private readonly prospekRepository: IProspekRepository = new ProspekRepository(),
    private readonly penugasanSales: PenugasanSalesService = new PenugasanSalesService(),
  ) {}

  /**
   * Tetapkan target seorang sales, menimpa target periode yang sama.
   *
   * `tenantSesi` null hanya untuk super admin tanpa tenant sesi; tenant baris
   * lalu diambil dari sales itu sendiri. Target BARU menuntut sales aktif,
   * sedangkan target yang sudah ada tetap boleh diubah walau sales-nya kini
   * nonaktif — "baru" ditentukan dari ada-tidaknya target periode itu di
   * tenant baris, bukan dari klien.
   */
  async tetapkan(
    input: DataTarget,
    tenantSesi: string | null,
  ): Promise<TargetEntity> {
    const penugasan = await this.penugasanSales.muatUntukBarisBaru(
      input.userId,
      tenantSesi,
    );
    const targetLama = penugasan.tenantBaris
      ? await this.targetRepository.findByUserPeriode(
          input.userId,
          { tahun: input.periodeTahun, bulan: input.periodeBulan },
          penugasan.tenantBaris,
        )
      : null;

    const tenantBaris = this.penugasanSales.pastikanSah(penugasan, {
      isWajibAktif: targetLama === null,
    });

    return this.targetRepository.simpan({ ...input, tenantId: tenantBaris });
  }

  /** Seluruh target pada satu periode. */
  async ambilPeriode(periode: PeriodeTarget): Promise<TargetEntity[]> {
    return this.targetRepository.findByPeriode(periode);
  }

  /**
   * Target seorang sales pada satu periode beserta realisasinya, atau null
   * bila targetnya belum ditetapkan.
   *
   * Null, bukan baris bernilai nol: `hitungPersen` menganggap target nol
   * tercapai penuh (`domain/target-rules.ts:53-54`), jadi "belum ada target"
   * yang dipetakan ke nol akan tampil 100%. Realisasi tidak dihitung bila
   * target tidak ada.
   *
   * Realisasi dihitung lewat `hitungUntukUser`/`hitungBaruUntukUser`/
   * `hitungKonversiUntukUser` — query yang sudah difilter `userId` DAN
   * `tenantId` sejak awal — BUKAN `laporanPencapaian`'s `hitungRealisasi`
   * (groupBy seluruh tenant lalu mengambil satu baris). Ringkasan Beranda
   * memanggil method ini di setiap muat layar; realisasi wajib "dibatasi ke
   * user sesi" (spec §7.1), dan groupBy se-tenant tiap muat juga jauh lebih
   * mahal daripada satu `count()` bersyarat `userId`.
   */
  async pencapaianSendiri(
    userId: string,
    periode: PeriodeTarget,
    tenantId: string,
  ): Promise<BarisLaporan | null> {
    const target = await this.targetRepository.findByUserPeriode(
      userId,
      periode,
      tenantId,
    );
    if (!target) return null;

    const rentang = bangunRentangBulan(periode);
    const [kunjungan, prospek, konversi] = await Promise.all([
      this.kegiatanRepository.hitungUntukUser(userId, rentang, tenantId),
      this.prospekRepository.hitungBaruUntukUser(userId, rentang, tenantId),
      this.prospekRepository.hitungKonversiUntukUser(userId, rentang, tenantId),
    ]);

    return {
      userId: target.userId,
      periodeTahun: target.periodeTahun,
      periodeBulan: target.periodeBulan,
      pencapaian: hitungPencapaian(target, { kunjungan, prospek, konversi }),
    };
  }

  /** Target beserta realisasinya untuk seluruh sales pada satu periode. */
  async laporanPencapaian(periode: PeriodeTarget): Promise<BarisLaporan[]> {
    const target = await this.targetRepository.findByPeriode(periode);
    if (target.length === 0) return [];

    const rentang = bangunRentangBulan(periode);

    const [kunjungan, prospekBaru, konversi] = await Promise.all([
      this.kegiatanRepository.hitungPerUser(rentang),
      this.prospekRepository.hitungBaruPerUser(rentang),
      this.prospekRepository.hitungKonversiPerUser(rentang),
    ]);

    return target.map((baris) => ({
      userId: baris.userId,
      periodeTahun: baris.periodeTahun,
      periodeBulan: baris.periodeBulan,
      pencapaian: hitungPencapaian(baris, {
        kunjungan: kunjungan[baris.userId] ?? 0,
        prospek: prospekBaru[baris.userId] ?? 0,
        konversi: konversi[baris.userId] ?? 0,
      }),
    }));
  }
}

/**
 * Rentang tertutup yang mencakup seluruh hari pada satu bulan.
 *
 * Batas atasnya satu milidetik sebelum bulan berikutnya (`rentangTertutupUtc`),
 * bukan tengah malam tanggal terakhir — memakai tengah malam akan memotong
 * kegiatan sepanjang hari terakhir dari laporan. Penanggalan bulan diserahkan
 * ke `Date` supaya jumlah hari dan tahun kabisat tidak perlu dihitung sendiri.
 */
function bangunRentangBulan(periode: PeriodeTarget): RentangPeriode {
  const mulai = new Date(Date.UTC(periode.tahun, periode.bulan - 1, 1));
  const awalBulanBerikutnya = new Date(
    Date.UTC(periode.tahun, periode.bulan - 1 + BULAN_BERIKUTNYA, 1),
  );

  return rentangTertutupUtc(mulai, awalBulanBerikutnya);
}
