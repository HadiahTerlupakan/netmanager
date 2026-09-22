import type { KegiatanEntity } from "../domain/entities/Kegiatan";

/**
 * Bentuk data kegiatan yang dikirim ke klien.
 *
 * Tanggal dikirim sebagai ISO string, dan data teknis dikelompokkan terpisah
 * supaya UI bisa menyembunyikannya untuk kegiatan yang bukan survei.
 */

export interface KegiatanListItemDto {
  id: string;
  jenis: string;
  userId: string;
  prospekId: string | null;
  waktuMulai: string;
  alamatDikunjungi: string | null;
  ditemuiNama: string | null;
  latitude: number | null;
  longitude: number | null;
  hasil: string;
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

/** Ringkasan kegiatan untuk tampilan daftar. */
export function toKegiatanListItem(
  kegiatan: KegiatanEntity,
): KegiatanListItemDto {
  return {
    id: kegiatan.id,
    jenis: kegiatan.jenis,
    userId: kegiatan.userId,
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
