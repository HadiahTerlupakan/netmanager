import type { QueryKey } from "@tanstack/react-query";

import {
  jadikanCanvasingSchema,
  PROSPEK_STATUS_CONFIG,
  type ProspekStatus,
} from "@/modules/presurvei/client";

import { buildUbahProspekUrl } from "./pindahProspek";
import { KUNCI_KOLOM_PROSPEK } from "./prospekKolomQuery";

/** Status yang disyaratkan `jadikanCanvasing` (`canPromosikanKeCanvasing`). */
const STATUS_DEAL: ProspekStatus = "DEAL";

/**
 * Panjang kabel terkecil yang diterima modul marketing
 * (`modules/marketing/validators/canvasingValidation.ts:62-65`). Schema
 * presurvei sendiri menerima 0 (`konversi.validator.ts:19`).
 */
const KABEL_MINIMAL_METER = 1;

/** Label tombol pembuka modal konversi; juga disebut pesan setengah jalan. */
export const LABEL_TOMBOL_JADIKAN_CANVASING = "Jadikan canvasing";

/** Nilai medan form konversi; semuanya string karena berasal dari `<input>`. */
export interface NilaiFormKonversi {
  noKtp: string;
  paket: string;
  kabel: string;
  odp: string;
  sn: string;
  fotoKtp: string;
}

/** Nilai awal form konversi. */
export const NILAI_FORM_KONVERSI_KOSONG: NilaiFormKonversi = {
  noKtp: "",
  paket: "",
  kabel: "",
  odp: "",
  sn: "",
  fotoKtp: "",
};

/** Teks yang sudah dirapikan, atau null bila medannya dikosongkan. */
function teksAtauNull(teks: string): string | null {
  const bersih = teks.trim();
  return bersih === "" ? null : bersih;
}

/**
 * Panjang kabel dari isian, atau `undefined` bila dikosongkan.
 *
 * `undefined`, bukan `null`: `kabel` di `jadikanCanvasingSchema` hanya
 * `.optional()` (`modules/presurvei/validators/konversi.validator.ts:19`),
 * jadi null ditolak, sedangkan `undefined` hilang dari JSON dan server lalu
 * memakai estimasi survei (`ProspekKonversiService.ts:170`). Nol tetap nol.
 */
function kabelAtauKosong(teks: string): number | undefined {
  const bersih = teks.trim();
  return bersih === "" ? undefined : Number(bersih);
}

/**
 * Badan `POST /api/presurvei/prospek/{id}/jadikan-canvasing`.
 *
 * `foto` tidak dikirim: form tidak punya medannya, dan server mengisinya dari
 * foto pertama survei terakhir (`ProspekKonversiService.ts:173`).
 */
export function keMuatanKonversi(nilai: NilaiFormKonversi) {
  return {
    noKtp: nilai.noKtp.trim(),
    paket: nilai.paket.trim(),
    kabel: kabelAtauKosong(nilai.kabel),
    odp: teksAtauNull(nilai.odp),
    sn: teksAtauNull(nilai.sn),
    fotoKtp: teksAtauNull(nilai.fotoKtp),
  };
}

/** Badan permintaan konversi. */
export type MuatanKonversi = ReturnType<typeof keMuatanKonversi>;

/** Pesan kesalahan per medan form konversi. */
export type KesalahanFormKonversi = Partial<
  Record<keyof NilaiFormKonversi, string>
>;

/**
 * Pesan per medan saat schema menolaknya. `Record` memaksa setiap medan
 * dijawab saat kompilasi; pesan bawaan Zod berbahasa Inggris.
 */
const PESAN_MEDAN_TIDAK_SAH: Record<keyof NilaiFormKonversi, string> = {
  noKtp: "Nomor KTP harus 16–20 karakter",
  paket: "Paket wajib diisi",
  kabel: "Panjang kabel harus bilangan bulat dalam meter",
  odp: "ODP terlalu panjang",
  sn: "Nomor seri terlalu panjang",
  fotoKtp: "Foto KTP harus berupa tautan yang sah",
};

/** Apakah `kunci` adalah nama medan form konversi. */
function isMedanKonversi(kunci: string): kunci is keyof NilaiFormKonversi {
  return Object.hasOwn(PESAN_MEDAN_TIDAK_SAH, kunci);
}

/**
 * Kesalahan isian form konversi; objek kosong berarti boleh dikirim.
 *
 * Selain `jadikanCanvasingSchema`, kabel nol ditolak di sini: validator
 * marketing menuntut minimal 1 meter, dan penolakannya di server baru datang
 * SETELAH kartu non-DEAL dipindah ke DEAL.
 */
export function validasiFormKonversi(
  nilai: NilaiFormKonversi,
): KesalahanFormKonversi {
  const muatan = keMuatanKonversi(nilai);
  const hasil = jadikanCanvasingSchema.safeParse(muatan);
  const kesalahan: KesalahanFormKonversi = {};

  if (!hasil.success) {
    for (const masalah of hasil.error.issues) {
      const kunci = String(masalah.path[0] ?? "");
      if (isMedanKonversi(kunci)) {
        kesalahan[kunci] = PESAN_MEDAN_TIDAK_SAH[kunci];
      }
    }
  }

  if (
    kesalahan.kabel === undefined &&
    muatan.kabel !== undefined &&
    muatan.kabel < KABEL_MINIMAL_METER
  ) {
    kesalahan.kabel = `Panjang kabel minimal ${KABEL_MINIMAL_METER} meter`;
  }

  return kesalahan;
}

/**
 * Apakah prospek harus dipindah ke DEAL sebelum dijadikan canvasing.
 *
 * `jadikanCanvasing` menolak prospek non-DEAL dengan 409
 * (`modules/presurvei/services/ProspekKonversiService.ts:67-75`). Tertukarnya
 * asimetris: status non-DEAL tanpa PATCH gagal berisik, sedangkan PATCH
 * DEAL→DEAL lolos senyap karena `ProspekService.ubah` hanya memeriksa
 * transisi bila statusnya berubah.
 */
export function isPerluTandaiDeal(status: ProspekStatus): boolean {
  return status !== STATUS_DEAL;
}

/**
 * Apakah kartu berstatus `status` menawarkan tombol konversi.
 *
 * Kartu DEAL tidak bisa diseret (`isStatusFinal`), jadi tombol ini satu-
 * satunya jalan mengonversi prospek yang dipasang DEAL tanpa canvasing — mis.
 * lewat `PATCH` biasa dari aplikasi mobile, atau konversi yang gagal di
 * langkah kedua. Kartu tidak tahu apakah prospeknya sudah punya canvasing
 * (`ProspekListItemDto` tidak membawa `canvasingId`); modal yang memeriksanya.
 */
export function isTawarkanKonversi(
  status: ProspekStatus,
  isBolehUbah: boolean,
): boolean {
  return isBolehUbah && status === STATUS_DEAL;
}

/** URL promosi prospek (`app/api/presurvei/prospek/[id]/jadikan-canvasing/route.ts`). */
export function buildJadikanCanvasingUrl(prospekId: string): string {
  return `${buildUbahProspekUrl(prospekId)}/jadikan-canvasing`;
}

/**
 * Kunci cache presurvei yang basi setelah status prospek berpindah ke DEAL.
 *
 * Kolom asal kehilangan kartunya, kolom DEAL menerimanya, dan rincian prospek
 * (key `useApi` = URL-nya) berubah status dan `canvasingId`-nya.
 */
export function kunciSetelahKonversi(
  prospekId: string,
  statusAsal: ProspekStatus,
): QueryKey[] {
  const kolom: QueryKey[] = isPerluTandaiDeal(statusAsal)
    ? [
        [KUNCI_KOLOM_PROSPEK, statusAsal],
        [KUNCI_KOLOM_PROSPEK, STATUS_DEAL],
      ]
    : [[KUNCI_KOLOM_PROSPEK, STATUS_DEAL]];

  return [...kolom, [buildUbahProspekUrl(prospekId)]];
}

/**
 * Pesan saat langkah pertama berhasil tetapi pembuatan canvasing gagal.
 *
 * Dua langkahnya tidak atomik. Prospek DEAL tanpa `canvasingId` tetap sah
 * dipromosikan (`canPromosikanKeCanvasing`,
 * `modules/presurvei/domain/prospek-rules.ts:97-105`), dan kartu DEAL membawa
 * tombol konversi (`isTawarkanKonversi`).
 */
export function pesanDealTanpaCanvasing(alasan: string): string {
  const labelDeal = PROSPEK_STATUS_CONFIG[STATUS_DEAL].label;
  return `Status prospek sudah menjadi ${labelDeal}, tetapi canvasing belum dibuat: ${alasan}. Perbaiki isian lalu simpan lagi, atau ulangi nanti lewat tombol "${LABEL_TOMBOL_JADIKAN_CANVASING}" di kartunya.`;
}
