import {
  buatProspekSchema,
  isSumberButuhIklan,
  isSumberButuhReferral,
  PROSPEK_STATUSES,
  ubahProspekSchema,
  type IklanListItemDto,
  type ProspekDetailDto,
  type ProspekStatus,
  type ProspekSumber,
} from "@/modules/presurvei/client";

import { buildUbahProspekUrl } from "./pindahProspek";
import { KUNCI_KOLOM_PROSPEK } from "./prospekKolomQuery";

/** Endpoint koleksi prospek; `POST` ke sini mencatat prospek baru. */
const URL_API_PROSPEK = "/api/presurvei/prospek";

/**
 * Jumlah kampanye yang diminta pemilih iklan: batas atas `limit` schema daftar
 * iklan (`modules/presurvei/validators/iklan.validator.ts:17`).
 */
const BATAS_PILIHAN_KAMPANYE = 100;

/**
 * Daftar kampanye untuk pemilih iklan.
 *
 * Endpoint ini tidak punya filter "sedang berjalan"
 * (`modules/presurvei/validators/iklan.validator.ts:47-61`), jadi yang diminta
 * hanya yang `isAktif`, lalu disaring lagi dengan `isBerjalan` di
 * `ringkasPilihanKampanye`. Tenant dengan lebih dari seratus kampanye aktif
 * menerima daftar terpotong; pemotongan itu dideteksi dari `meta.total`.
 */
export const URL_PILIHAN_KAMPANYE = `/api/admin/presurvei/iklan?isAktif=true&limit=${BATAS_PILIHAN_KAMPANYE}`;

/**
 * Permission gerbang `GET /api/admin/presurvei/iklan`
 * (`app/api/admin/presurvei/iklan/route.ts:15`). Berbeda dari gerbang
 * `POST /api/presurvei/prospek`, jadi pemakai yang boleh membuat prospek belum
 * tentu boleh membaca daftar kampanye.
 */
export const IZIN_BACA_KAMPANYE = ["presurvei_iklan:read"];

/** Nilai medan form; semuanya string karena berasal dari `<input>`. */
export interface NilaiFormProspek {
  nama: string;
  noTelp: string;
  email: string;
  alamat: string;
  sumber: ProspekSumber;
  iklanId: string;
  referralNama: string;
  paketDiminati: string;
  catatan: string;
}

/**
 * Nilai awal form prospek baru.
 *
 * `sumber` bawaannya `LAPANGAN`, anggota yang tidak menuntut medan tambahan
 * (`isSumberButuhIklan`/`isSumberButuhReferral` sama-sama false), supaya form
 * yang baru dibuka tidak langsung menuntut kampanye atau perujuk.
 */
export const NILAI_FORM_KOSONG: NilaiFormProspek = {
  nama: "",
  noTelp: "",
  email: "",
  alamat: "",
  sumber: "LAPANGAN",
  iklanId: "",
  referralNama: "",
  paketDiminati: "",
  catatan: "",
};

/**
 * Mode form beserta data yang hanya ada pada mode itu.
 *
 * Union bertanda, mengikuti `ModeFormIklan` (`../iklan/iklanFormState.ts`):
 * "ubah tanpa id" bukan keadaan yang bisa ditulis.
 */
export type ModeFormProspek =
  | { jenis: "buat" }
  | { jenis: "ubah"; prospekId: string };

/** Teks yang sudah dirapikan, atau null bila medannya dikosongkan. */
function teksAtauNull(teks: string): string | null {
  const bersih = teks.trim();
  return bersih === "" ? null : bersih;
}

/**
 * Muatan `POST /api/presurvei/prospek` dari nilai form yang seluruhnya string.
 *
 * `iklanId` dan `referralNama` hanya dikirim bila sumbernya menuntutnya. Medan
 * yang tersembunyi tetap menyimpan isiannya — pemakai yang memilih kampanye
 * lalu mengganti sumber ke `WALK_IN` tidak melihatnya lagi — dan tanpa
 * penyaringan ini prospek walk-in tercatat menempel ke kampanye tersebut.
 *
 * **Tidak pernah menyertakan `pemilikId`.** Form ini memberi tahu pemakai
 * bahwa prospek tercatat atas namanya sendiri, dan itu hanya benar selama
 * `pemilikId` tidak dikirim: `tentukanPemilikProspek`
 * (`app/api/presurvei/akses-presurvei.ts:41-48`) memakai
 * `pemilikDiminta ?? idPemanggil` untuk pemegang permission web.
 */
export function keMuatanBuatProspek(nilai: NilaiFormProspek) {
  return {
    nama: nilai.nama.trim(),
    noTelp: nilai.noTelp.trim(),
    email: teksAtauNull(nilai.email),
    alamat: nilai.alamat.trim(),
    sumber: nilai.sumber,
    iklanId: isSumberButuhIklan(nilai.sumber)
      ? teksAtauNull(nilai.iklanId)
      : null,
    referralNama: isSumberButuhReferral(nilai.sumber)
      ? teksAtauNull(nilai.referralNama)
      : null,
    paketDiminati: teksAtauNull(nilai.paketDiminati),
    catatan: teksAtauNull(nilai.catatan),
  };
}

/**
 * Muatan `PATCH /api/presurvei/prospek/{id}`.
 *
 * Tanpa `pemilikId` dan `status`: kepemilikan tidak diubah dari form ini, dan
 * status berpindah lewat papan yang menegakkan aturan transisinya.
 *
 * Tanpa `sumber`, `iklanId`, dan `referralNama` karena `ubahProspekSchema`
 * (`modules/presurvei/validators/prospek.validator.ts:60-76`) tidak mengenal
 * ketiganya. `z.object` men-strip kunci tak dikenal tanpa error, jadi
 * mengirimnya menghasilkan 200 sementara atribusinya tidak berubah — form
 * menampilkannya sebagai teks saja pada mode ubah.
 */
export function keMuatanUbahProspek(nilai: NilaiFormProspek) {
  return {
    nama: nilai.nama.trim(),
    noTelp: nilai.noTelp.trim(),
    email: teksAtauNull(nilai.email),
    alamat: nilai.alamat.trim(),
    paketDiminati: teksAtauNull(nilai.paketDiminati),
    catatan: teksAtauNull(nilai.catatan),
  };
}

/** Badan `POST /api/presurvei/prospek`. */
export type MuatanBuatProspek = ReturnType<typeof keMuatanBuatProspek>;

/** Badan `PATCH /api/presurvei/prospek/{id}`. */
export type MuatanUbahProspek = ReturnType<typeof keMuatanUbahProspek>;

/** Muatan yang boleh dikirim form, apa pun modenya. */
export type MuatanProspek =
  | MuatanBuatProspek
  | MuatanUbahProspek
  | MuatanBuatProspekAbaikanDuplikat;

/**
 * Schema yang berlaku untuk mode form saat ini.
 *
 * Tertukarnya asimetris. Mode buat dengan schema ubah hanya melonggarkan
 * validasi klien — server tetap memakai schema buat. Mode ubah dengan schema
 * buat menolak setiap simpan, karena muatan ubah tidak membawa `sumber`.
 */
export function schemaUntukMode(mode: ModeFormProspek) {
  return mode.jenis === "ubah" ? ubahProspekSchema : buatProspekSchema;
}

/**
 * Pembentuk muatan yang berlaku untuk mode form saat ini.
 *
 * Arah yang senyap adalah mode ubah dengan pembentuk buat: `sumber`,
 * `iklanId`, dan `referralNama` ikut terkirim ke `PATCH`, di-strip
 * `ubahProspekSchema` tanpa error, dan pemakai yakin atribusinya berubah.
 */
export function muatanUntukMode(
  mode: ModeFormProspek,
  nilai: NilaiFormProspek,
): MuatanBuatProspek | MuatanUbahProspek {
  return mode.jenis === "ubah"
    ? keMuatanUbahProspek(nilai)
    : keMuatanBuatProspek(nilai);
}

/** Tujuan permintaan simpan beserta teks notifikasinya. */
export interface OpsiSimpanProspek {
  url: string;
  method: "POST" | "PATCH";
  pesanSukses: string;
  pesanGagal: string;
}

/** Tujuan permintaan simpan untuk mode form saat ini. */
export function opsiSimpanUntukMode(mode: ModeFormProspek): OpsiSimpanProspek {
  if (mode.jenis === "ubah") {
    return {
      url: buildUbahProspekUrl(mode.prospekId),
      method: "PATCH",
      pesanSukses: "Prospek berhasil diperbarui",
      pesanGagal: "Gagal memperbarui prospek",
    };
  }

  return {
    url: URL_API_PROSPEK,
    method: "POST",
    pesanSukses: "Prospek berhasil dicatat",
    pesanGagal: "Gagal mencatat prospek",
  };
}

/** Muatan buat yang dikirim ulang setelah pemakai menyetujui duplikat. */
export type MuatanBuatProspekAbaikanDuplikat = MuatanBuatProspek & {
  abaikanDuplikat: true;
};

/**
 * Muatan yang sama persis, ditambah izin melewati pemeriksaan duplikat.
 *
 * `abaikanDuplikat` diterima `buatProspekSchema` dan diteruskan route ke
 * `ProspekService.buat` (`app/api/presurvei/prospek/route.ts:55-67`).
 */
export function denganAbaikanDuplikat(
  muatan: MuatanBuatProspek,
): MuatanBuatProspekAbaikanDuplikat {
  return { ...muatan, abaikanDuplikat: true };
}

/** Status HTTP penolakan duplikat (`modules/presurvei/services/ProspekService.ts:75-83`). */
const STATUS_HTTP_KONFLIK = 409;

/** Kode penolakan duplikat (`modules/presurvei/services/ProspekService.ts:81`). */
const KODE_DUPLIKAT = "DUPLIKAT";

/** Prospek aktif yang nomor teleponnya bentrok dengan isian form. */
export interface ProspekBentrok {
  id: string;
  nama: string;
  status: ProspekStatus;
  pemilikId: string | null;
}

/**
 * Prospek yang bentrok bila respons ini penolakan duplikat, atau null bila
 * ini kesalahan lain.
 *
 * Bentuk kawatnya dibaca dari `lib/api/handler.ts:369-379`: `AppError` menjadi
 * `{ success: false, error, code, details }` — `code` di akar badan dan
 * lampiran service utuh di `details`, sehingga daftarnya ada di
 * `details.duplikat`. 409 saja tidak cukup: `ProspekService.ubah` juga
 * menjawab 409 untuk transisi status tak sah, berkode `INVALID_STATE`.
 */
export function bacaDuplikat(
  statusHttp: number,
  badan: unknown,
): ProspekBentrok[] | null {
  if (statusHttp !== STATUS_HTTP_KONFLIK) return null;
  if (typeof badan !== "object" || badan === null) return null;

  const { code, details } = badan as { code?: unknown; details?: unknown };
  if (code !== KODE_DUPLIKAT) return null;
  if (typeof details !== "object" || details === null) return null;

  const { duplikat } = details as { duplikat?: unknown };
  if (!Array.isArray(duplikat) || duplikat.length === 0) return null;

  return duplikat as ProspekBentrok[];
}

/**
 * Kunci cache yang diinvalidasi setelah simpan berhasil.
 *
 * Status diambil dari prospek yang dikembalikan server (`apiSuccess` membalas
 * `{ success, data }` berisi `ProspekDetailDto`), bukan ditebak dari mode:
 * prospek baru berstatus bawaan skema, dan prospek yang diubah bisa sudah
 * dipindah orang lain sejak kartunya dimuat. Bila statusnya tak terbaca,
 * seluruh kolom diinvalidasi — lebih mahal, tapi tidak meninggalkan kolom basi.
 */
export function kunciKolomSetelahSimpan(badan: unknown): readonly string[] {
  const status = (badan as { data?: { status?: unknown } } | null)?.data
    ?.status;
  const isStatusDikenal =
    typeof status === "string" &&
    (PROSPEK_STATUSES as readonly string[]).includes(status);

  return isStatusDikenal
    ? [KUNCI_KOLOM_PROSPEK, status]
    : [KUNCI_KOLOM_PROSPEK];
}

/** Bagian amplop daftar kampanye yang dibaca pemilih iklan. */
export interface AmplopPilihanKampanye {
  data: IklanListItemDto[];
  meta: { total: number };
}

/** Kampanye yang bisa dipilih beserta apakah daftarnya lengkap. */
export interface RingkasanPilihanKampanye {
  pilihan: IklanListItemDto[];
  /**
   * Server punya lebih banyak kampanye aktif daripada yang dikirim. Kampanye
   * yang dicari mungkin tidak ada di `pilihan`, jadi pemakai harus bisa
   * mengisi ID-nya langsung.
   */
  isTerpotong: boolean;
}

/**
 * Kampanye yang boleh dipilih — hanya yang sedang berjalan menurut server —
 * dan apakah daftar aktifnya terpotong.
 *
 * Pemotongan dibandingkan dengan jumlah yang diterima SEBELUM disaring
 * `isBerjalan`: `meta.total` menghitung kampanye aktif, bukan yang berjalan.
 */
export function ringkasPilihanKampanye(
  amplop: AmplopPilihanKampanye,
): RingkasanPilihanKampanye {
  return {
    pilihan: amplop.data.filter((iklan) => iklan.isBerjalan),
    isTerpotong: amplop.meta.total > amplop.data.length,
  };
}

/** Nilai form dari prospek yang sudah ada, untuk mode ubah. */
export function keNilaiForm(prospek: ProspekDetailDto): NilaiFormProspek {
  return {
    nama: prospek.nama,
    noTelp: prospek.noTelp,
    email: prospek.email ?? "",
    alamat: prospek.alamat,
    sumber: prospek.sumber,
    iklanId: prospek.iklanId ?? "",
    referralNama: prospek.referralNama ?? "",
    paketDiminati: prospek.paketDiminati ?? "",
    catatan: prospek.catatan ?? "",
  };
}

/** Kunci pesan yang tidak menempel ke satu medan pun. */
export const KUNCI_KESALAHAN_FORM = "_form";

/** Pesan kesalahan per medan, hasil `safeParse` yang gagal. */
export type KesalahanForm = Partial<
  Record<keyof NilaiFormProspek | typeof KUNCI_KESALAHAN_FORM, string>
>;

/**
 * Medan yang punya tempat menampilkan pesan kesalahan di form.
 *
 * `Record` memaksa setiap medan dijawab saat kompilasi.
 */
const MEDAN_BERSLOT_PESAN: Record<keyof NilaiFormProspek, boolean> = {
  nama: true,
  noTelp: true,
  email: true,
  alamat: true,
  sumber: true,
  iklanId: true,
  referralNama: true,
  paketDiminati: true,
  catatan: true,
};

/** Bentuk minimal issue Zod yang dibaca form; menghindari tipe internal Zod. */
interface IssueValidasi {
  path: readonly PropertyKey[];
  message: string;
}

/**
 * Kunci tempat sebuah issue ditampilkan.
 *
 * Kedua `.refine()` `buatProspekSchema`
 * (`modules/presurvei/validators/prospek.validator.ts:49-58`) berpath kosong,
 * jadi pesan "wajib menunjuk ke sebuah iklan" tidak menempel ke medan mana
 * pun dan dialihkan ke pesan level-form.
 */
function kunciKesalahan(path: readonly PropertyKey[]): keyof KesalahanForm {
  const kunci = path.length === 0 ? "" : String(path[0]);

  return MEDAN_BERSLOT_PESAN[kunci as keyof NilaiFormProspek] === true
    ? (kunci as keyof NilaiFormProspek)
    : KUNCI_KESALAHAN_FORM;
}

/** Pesan kesalahan per medan dari daftar issue Zod. */
export function keKesalahanForm(
  issues: readonly IssueValidasi[],
): KesalahanForm {
  const kesalahan: KesalahanForm = {};

  for (const masalah of issues) {
    kesalahan[kunciKesalahan(masalah.path)] = masalah.message;
  }

  return kesalahan;
}
