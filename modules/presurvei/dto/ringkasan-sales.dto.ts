import type { KegiatanJenis } from "../domain/entities/Kegiatan";
import type { ProspekStatus } from "../domain/entities/Prospek";
import type { RingkasanSales, TargetSendiri } from "../domain/ringkasan-sales";
import { toBarisLaporanDto, type BarisLaporanDto } from "./target.dto";

/**
 * Bentuk ringkasan Beranda sales yang dikirim ke aplikasi mobile.
 *
 * `tanggal` hanya bagian tanggal (hari UTC yang dihitung), supaya klien
 * tidak menafsirkan ulang jam di zona perangkat.
 */

const PANJANG_TANGGAL_ISO = 10;

// `toBarisLaporanDto` menuntut `userId` karena dipakai juga untuk laporan
// lintas sales; ringkasan Beranda hanya untuk pemanggil sendiri, jadi
// `userId`-nya tidak berarti apa-apa dan langsung dibuang di bawah.
const USER_ID_TIDAK_DIPAKAI = "";

export type TargetSendiriDto = Omit<BarisLaporanDto, "userId">;

export interface ProspekPerluFollowUpDto {
  id: string;
  nama: string;
  noTelp: string;
  status: ProspekStatus;
  sentuhanTerakhir: string;
}

export interface RingkasanSalesDto {
  tanggal: string;
  kegiatanHariIni: Record<KegiatanJenis, number>;
  target: TargetSendiriDto | null;
  perluFollowUp: ProspekPerluFollowUpDto[];
}

/** Ringkasan untuk klien; target yang belum ditetapkan tetap null. */
export function toRingkasanSalesDto(
  ringkasan: RingkasanSales,
): RingkasanSalesDto {
  return {
    tanggal: ringkasan.tanggal.toISOString().slice(0, PANJANG_TANGGAL_ISO),
    kegiatanHariIni: { ...ringkasan.kegiatanHariIni },
    target: toTargetSendiriDto(ringkasan.target),
    perluFollowUp: ringkasan.perluFollowUp.map((prospek) => ({
      id: prospek.id,
      nama: prospek.nama,
      noTelp: prospek.noTelp,
      status: prospek.status,
      sentuhanTerakhir: prospek.sentuhanTerakhir.toISOString(),
    })),
  };
}

/** Baris pencapaian target sendiri untuk klien; null bila belum ditetapkan. */
function toTargetSendiriDto(
  target: TargetSendiri | null,
): TargetSendiriDto | null {
  if (!target) return null;

  const { userId: _userId, ...pencapaian } = toBarisLaporanDto({
    userId: USER_ID_TIDAK_DIPAKAI,
    periodeTahun: target.periodeTahun,
    periodeBulan: target.periodeBulan,
    pencapaian: target.pencapaian,
  });

  return pencapaian;
}
