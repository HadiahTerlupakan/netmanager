import type {
  KegiatanEntity,
  KegiatanHasil,
  KegiatanJenis,
} from "../domain/entities/Kegiatan";
import type { RiwayatKegiatanEntity } from "../domain/entities/KegiatanRiwayat";
import type { PerubahanKegiatan } from "../domain/kegiatan-perubahan";

/**
 * Bentuk data kegiatan yang dikirim ke klien.
 *
 * Tanggal dikirim sebagai ISO string, dan data teknis dikelompokkan terpisah
 * supaya UI bisa menyembunyikannya untuk kegiatan yang bukan survei.
 */

export interface KegiatanListItemDto {
  id: string;
  jenis: KegiatanJenis;
  userId: string;
  /** Label pelaku; null bila tidak bisa ditampilkan (lihat `KegiatanEntity`). */
  namaSales: string | null;
  prospekId: string | null;
  waktuMulai: string;
  alamatDikunjungi: string | null;
  ditemuiNama: string | null;
  latitude: number | null;
  longitude: number | null;
  hasil: KegiatanHasil;
  jumlahFoto: number;
}

export interface KegiatanDetailDto extends KegiatanListItemDto {
  iklanId: string | null;
  waktuSelesai: string | null;
  catatan: string | null;
  fotoUrls: string[];
  dataTeknis: {
    odpTerdekat: string | null;
    estimasiKabelMeter: number | null;
    catatanTeknis: string | null;
  } | null;
  createdAt: string;
}

/** Satu baris jejak audit perubahan kegiatan. */
export interface RiwayatKegiatanDto {
  id: string;
  diubahOlehId: string | null;
  /** Label pengubah; null bila tidak bisa ditampilkan (lihat entitasnya). */
  namaPengubah: string | null;
  diubahPada: string;
  /** Hanya medan yang berubah: `{ medan: { dari, ke } }`. */
  perubahan: PerubahanKegiatan;
}

/**
 * Rincian kegiatan beserta riwayat perubahannya, bentuk
 * `GET`/`PATCH /api/presurvei/kegiatan/[id]`. `POST` catat tetap memakai
 * `KegiatanDetailDto` — kegiatan baru belum punya riwayat.
 */
export interface KegiatanRincianDto extends KegiatanDetailDto {
  /**
   * Versi baris (ISO bermilidetik). Klien web mengirimnya kembali sebagai
   * `versi` pada `PATCH`, supaya perubahan orang lain sejak rincian ini
   * dimuat ditolak 409 alih-alih tertimpa diam-diam.
   */
  updatedAt: string;
  riwayat: RiwayatKegiatanDto[];
}

/** Ringkasan kegiatan untuk tampilan daftar. */
export function toKegiatanListItem(
  kegiatan: KegiatanEntity,
): KegiatanListItemDto {
  return {
    id: kegiatan.id,
    jenis: kegiatan.jenis,
    userId: kegiatan.userId,
    namaSales: kegiatan.namaSales ?? null,
    prospekId: kegiatan.prospekId,
    waktuMulai: kegiatan.waktuMulai.toISOString(),
    alamatDikunjungi: kegiatan.alamatDikunjungi,
    ditemuiNama: kegiatan.ditemuiNama,
    latitude: kegiatan.latitude,
    longitude: kegiatan.longitude,
    hasil: kegiatan.hasil,
    jumlahFoto: kegiatan.fotoUrls.length,
  };
}

/** Rincian lengkap kegiatan untuk halaman detail. */
export function toKegiatanDetail(kegiatan: KegiatanEntity): KegiatanDetailDto {
  // Perbandingan eksplisit terhadap null, bukan truthiness: estimasi kabel
  // 0 meter adalah hasil survei yang sah, dan `Boolean(0)` akan menyembunyikan
  // seluruh blok data teknis dari UI.
  const hasDataTeknis =
    kegiatan.odpTerdekat !== null ||
    kegiatan.estimasiKabelMeter !== null ||
    kegiatan.catatanTeknis !== null;

  return {
    ...toKegiatanListItem(kegiatan),
    iklanId: kegiatan.iklanId,
    waktuSelesai: kegiatan.waktuSelesai?.toISOString() ?? null,
    catatan: kegiatan.catatan,
    fotoUrls: kegiatan.fotoUrls,
    dataTeknis: hasDataTeknis
      ? {
          odpTerdekat: kegiatan.odpTerdekat,
          estimasiKabelMeter: kegiatan.estimasiKabelMeter,
          catatanTeknis: kegiatan.catatanTeknis,
        }
      : null,
    createdAt: kegiatan.createdAt.toISOString(),
  };
}

/** Satu baris riwayat untuk klien; `tenantId` sengaja tidak ikut. */
function toRiwayatKegiatanDto(
  riwayat: RiwayatKegiatanEntity,
): RiwayatKegiatanDto {
  return {
    id: riwayat.id,
    diubahOlehId: riwayat.diubahOlehId,
    namaPengubah: riwayat.namaPengubah,
    diubahPada: riwayat.diubahPada.toISOString(),
    perubahan: riwayat.perubahan,
  };
}

/** Rincian kegiatan beserta riwayat perubahannya. */
export function toKegiatanRincian(rincian: {
  kegiatan: KegiatanEntity;
  riwayat: RiwayatKegiatanEntity[];
}): KegiatanRincianDto {
  return {
    ...toKegiatanDetail(rincian.kegiatan),
    updatedAt: rincian.kegiatan.updatedAt.toISOString(),
    riwayat: rincian.riwayat.map(toRiwayatKegiatanDto),
  };
}
