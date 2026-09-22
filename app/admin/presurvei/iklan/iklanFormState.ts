import {
  buatIklanSchema,
  ubahIklanSchema,
  type IklanChannel,
  type IklanDetailDto,
} from "@/modules/presurvei/client";

/** Tujuan tombol Batal dan tujuan kembali setelah kampanye tersimpan. */
export const URL_DAFTAR_IKLAN = "/admin/presurvei/iklan";

/** Nilai medan form; semuanya string karena berasal dari `<input>`. */
export interface NilaiFormIklan {
  nama: string;
  kode: string;
  channel: IklanChannel;
  /** Format `YYYY-MM-DD` dari `<input type="date">`. */
  tanggalMulai: string;
  tanggalSelesai: string;
  biaya: string;
  isAktif: boolean;
}

/** Nilai awal form untuk kampanye baru. */
export const NILAI_FORM_KOSONG: NilaiFormIklan = {
  nama: "",
  kode: "",
  channel: "META",
  tanggalMulai: "",
  tanggalSelesai: "",
  biaya: "",
  isAktif: true,
};

/**
 * Angka dari medan teks, atau null bila medannya dikosongkan.
 *
 * Perbandingan terhadap string kosong, bukan truthiness: "0" adalah masukan
 * yang sah dan `Boolean("0")` memang true, tapi `Number("")` menghasilkan 0
 * sehingga medan kosong akan diam-diam terkirim sebagai nol.
 */
function angkaAtauNull(teks: string): number | null {
  const bersih = teks.trim();
  return bersih === "" ? null : Number(bersih);
}

/** Tanggal ISO dari medan, atau null bila dikosongkan. */
function tanggalAtauNull(teks: string): string | null {
  return teks.trim() === "" ? null : teks;
}

/** Muatan `POST` kampanye baru, dari nilai form yang seluruhnya string. */
export function keMuatanBuat(nilai: NilaiFormIklan) {
  return {
    nama: nilai.nama.trim(),
    kode: nilai.kode.trim(),
    channel: nilai.channel,
    tanggalMulai: nilai.tanggalMulai,
    tanggalSelesai: tanggalAtauNull(nilai.tanggalSelesai),
    biaya: angkaAtauNull(nilai.biaya),
    isAktif: nilai.isAktif,
  };
}

/**
 * Muatan ubah, tanpa `kode`.
 *
 * Kode UTM tidak bisa diubah setelah dibuat: prospek yang sudah tertaut
 * menyimpan `iklanId`, tapi tautan kampanye yang beredar membawa kode lama.
 * Mengubahnya membuat pendaftar berikutnya gagal dicocokkan.
 */
export function keMuatanUbah(nilai: NilaiFormIklan) {
  return {
    nama: nilai.nama.trim(),
    channel: nilai.channel,
    tanggalMulai: nilai.tanggalMulai,
    tanggalSelesai: tanggalAtauNull(nilai.tanggalSelesai),
    biaya: angkaAtauNull(nilai.biaya),
    isAktif: nilai.isAktif,
  };
}

/** Badan `POST /api/admin/presurvei/iklan`. */
export type MuatanBuatIklan = ReturnType<typeof keMuatanBuat>;

/** Badan `PATCH /api/admin/presurvei/iklan/{id}`. */
export type MuatanUbahIklan = ReturnType<typeof keMuatanUbah>;

/**
 * Schema yang berlaku untuk mode form saat ini.
 *
 * Dipisah dari komponen supaya bisa diuji: bentuk ubah adalah subset
 * struktural dari bentuk buat, jadi memasangkan schema yang salah lolos
 * `tsc` tanpa keluhan dan baru ketahuan saat pemakai menekan simpan.
 */
export function schemaUntukMode(isModeUbah: boolean) {
  return isModeUbah ? ubahIklanSchema : buatIklanSchema;
}

/**
 * Pembentuk muatan yang berlaku untuk mode form saat ini.
 *
 * Dipisah dari komponen karena tertukarnya tidak simetris: mode buat dengan
 * pembentuk ubah ditolak di klik pertama (kode hilang), tapi mode ubah dengan
 * pembentuk buat LOLOS SENYAP — `ubahIklanSchema` men-strip `kode` tanpa error,
 * dan tidak ada yang tahu sampai seseorang bertanya kenapa kode UTM-nya tidak
 * pernah berubah.
 */
export function muatanUntukMode(isModeUbah: boolean, nilai: NilaiFormIklan) {
  return isModeUbah ? keMuatanUbah(nilai) : keMuatanBuat(nilai);
}

/** Nilai form dari kampanye yang sudah ada, untuk mode ubah. */
export function keNilaiForm(iklan: IklanDetailDto): NilaiFormIklan {
  return {
    nama: iklan.nama,
    kode: iklan.kode,
    channel: iklan.channel,
    tanggalMulai: iklan.tanggalMulai.slice(0, 10),
    tanggalSelesai: iklan.tanggalSelesai?.slice(0, 10) ?? "",
    // Perbandingan eksplisit terhadap null: biaya 0 harus tampil sebagai "0",
    // bukan medan kosong. Kalau kosong, menyimpan ulang mengubahnya jadi null.
    biaya: iklan.biaya === null ? "" : String(iklan.biaya),
    isAktif: iklan.isAktif,
  };
}
