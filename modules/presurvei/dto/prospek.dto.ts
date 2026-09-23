import type {
  ProspekEntity,
  ProspekStatus,
  ProspekSumber,
} from "../domain/entities/Prospek";
import { canPromosikanKeCanvasing } from "../domain/prospek-rules";

/**
 * Bentuk data prospek yang dikirim ke klien.
 *
 * Tanggal dikirim sebagai ISO string supaya aman melewati JSON, dan kesiapan
 * promosi dihitung di sini supaya UI tidak perlu menyalin aturan domain.
 */

export interface ProspekListItemDto {
  id: string;
  nama: string;
  noTelp: string;
  alamat: string;
  sumber: ProspekSumber;
  status: ProspekStatus;
  pemilikId: string | null;
  /** Label pemilik; null bila tak bertuan atau tidak bisa ditampilkan. */
  namaPemilik: string | null;
  paketDiminati: string | null;
  /**
   * Canvasing hasil konversi, null bila belum. Ikut di daftar supaya papan
   * tidak menawarkan konversi ulang pada kartu yang sudah dikonversi.
   */
  canvasingId: string | null;
  createdAt: string;
}

export interface ProspekDetailDto extends ProspekListItemDto {
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  shareloc: string | null;
  iklanId: string | null;
  registrationId: string | null;
  referralNama: string | null;
  catatan: string | null;
  konversiAt: string | null;
  isSiapDipromosikan: boolean;
  updatedAt: string;
}

/** Ringkasan prospek untuk tampilan daftar. */
export function toProspekListItem(prospek: ProspekEntity): ProspekListItemDto {
  return {
    id: prospek.id,
    nama: prospek.nama,
    noTelp: prospek.noTelp,
    alamat: prospek.alamat,
    sumber: prospek.sumber,
    status: prospek.status,
    pemilikId: prospek.pemilikId,
    namaPemilik: prospek.namaPemilik ?? null,
    paketDiminati: prospek.paketDiminati,
    canvasingId: prospek.canvasingId ?? null,
    createdAt: prospek.createdAt.toISOString(),
  };
}

/** Rincian lengkap prospek untuk halaman detail. */
export function toProspekDetail(prospek: ProspekEntity): ProspekDetailDto {
  return {
    ...toProspekListItem(prospek),
    email: prospek.email,
    latitude: prospek.latitude,
    longitude: prospek.longitude,
    shareloc: prospek.shareloc,
    iklanId: prospek.iklanId,
    registrationId: prospek.registrationId,
    referralNama: prospek.referralNama,
    catatan: prospek.catatan,
    konversiAt: prospek.konversiAt?.toISOString() ?? null,
    isSiapDipromosikan: canPromosikanKeCanvasing(prospek),
    updatedAt: prospek.updatedAt.toISOString(),
  };
}
