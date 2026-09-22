import type { ProspekEntity } from "../domain/entities/Prospek";
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
  sumber: string;
  status: string;
  pemilikId: string | null;
  paketDiminati: string | null;
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
  canvasingId: string | null;
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
    paketDiminati: prospek.paketDiminati,
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
    canvasingId: prospek.canvasingId,
    konversiAt: prospek.konversiAt?.toISOString() ?? null,
    isSiapDipromosikan: canPromosikanKeCanvasing(prospek),
    updatedAt: prospek.updatedAt.toISOString(),
  };
}
