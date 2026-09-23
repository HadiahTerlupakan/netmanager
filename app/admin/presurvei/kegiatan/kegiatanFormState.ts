import type { KegiatanHasil, KegiatanJenis } from "@/modules/presurvei/client";

/** Endpoint koleksi kegiatan; `POST` ke sini mencatat kegiatan baru. */
export const URL_API_KEGIATAN = "/api/presurvei/kegiatan";

/** Awalan `queryKey` daftar kegiatan; lihat `useKegiatanListQuery.ts:60`. */
export const KUNCI_DAFTAR_KEGIATAN = "presurvei-kegiatan-list";

/** Nilai medan form; semuanya string karena berasal dari `<input>`. */
export interface NilaiFormKegiatan {
  jenis: KegiatanJenis;
  hasil: KegiatanHasil;
  /** Format `YYYY-MM-DDTHH:mm` dari `<input type="datetime-local">`. */
  waktuMulai: string;
  alamatDikunjungi: string;
  ditemuiNama: string;
  catatan: string;
  prospekId: string;
  iklanId: string;
}

/**
 * Nilai awal form kegiatan baru.
 *
 * `jenis` bawaannya `TELEPON`, bukan anggota pertama `KEGIATAN_JENIS`
 * (`KUNJUNGAN`). Alasannya bukan selera: `KUNJUNGAN` dan `SURVEI_LOKASI`
 * menuntut koordinat lewat refine pertama `catatKegiatanSchema`
 * (`modules/presurvei/validators/kegiatan.validator.ts:88-93`), sedangkan form
 * ini sengaja tidak menangkap GPS — jadi membuka modal pada jenis itu berarti
 * menyodorkan form yang pasti ditolak sebelum pemakai mengetik apa pun.
 */
export const NILAI_FORM_KOSONG: NilaiFormKegiatan = {
  jenis: "TELEPON",
  hasil: "PERLU_FOLLOWUP",
  waktuMulai: "",
  alamatDikunjungi: "",
  ditemuiNama: "",
  catatan: "",
  prospekId: "",
  iklanId: "",
};

/** Teks yang sudah dirapikan, atau null bila medannya dikosongkan. */
function teksAtauNull(teks: string): string | null {
  const bersih = teks.trim();
  return bersih === "" ? null : bersih;
}

/**
 * Instan absolut (ISO ber-`Z`) dari medan `datetime-local`.
 *
 * Berbeda dari `iklanFormState.ts` yang mengirim medan tanggalnya apa adanya,
 * dan perbedaannya diukur, bukan ditebak. ECMAScript menafsirkan bentuk
 * date-only sebagai UTC tapi bentuk date-time tanpa offset sebagai waktu
 * LOKAL, jadi `"2026-09-10T09:00"` yang dikirim mentah menjadi `02:00Z` bila
 * diurai di Jakarta dan `09:00Z` bila diurai server ber-TZ UTC — tujuh jam
 * selisih untuk kegiatan yang sama. Mengubahnya di sini menaruh satu-satunya
 * penafsiran di tempat ambiguitasnya memang berada: jam dinding pemakai.
 *
 * Medan kosong atau tak terurai dikembalikan apa adanya, bukan dilempar:
 * `new Date("").toISOString()` melempar `RangeError` dan akan merobohkan
 * render. Dibiarkan sebagai string, `z.coerce.date()` menolaknya sebagai
 * masalah validasi biasa yang punya tempat tampil di form.
 */
function keInstanIso(teks: string): string {
  const bersih = teks.trim();
  if (bersih === "") return bersih;

  const waktu = new Date(bersih);
  return Number.isNaN(waktu.getTime()) ? bersih : waktu.toISOString();
}

/**
 * Muatan `POST /api/presurvei/kegiatan` dari nilai form yang seluruhnya string.
 *
 * **Tidak pernah menyertakan `latitude`, `longitude`, maupun `fotoUrls`.**
 * Ketiganya lahir dari perangkat di lapangan; membangkitkannya dari kursi
 * kantor menaruh penanda palsu di peta kunjungan. Ketiadaannya bukan celah
 * yang belum ditambal — ia dijaga test dan wajib tetap begitu.
 *
 * **Tidak pernah menyertakan data teknis survei** (`odpTerdekat`,
 * `estimasiKabelMeter`, `catatanTeknis`). Refine kedua `catatKegiatanSchema`
 * (`modules/presurvei/validators/kegiatan.validator.ts:94-101`) hanya
 * menerimanya pada survei lokasi, dan survei lokasi selalu ditolak dari web
 * karena tak berkoordinat (refine pertama, baris 88-93). Medan yang tidak
 * pernah bisa tersimpan tidak punya tempat di form ini; ketiadaannya dijaga
 * test untuk setiap jenis.
 *
 * **Tidak ada pemilih sales, dan itu penjaga keamanan, bukan medan yang
 * terlupa.** `app/api/presurvei/kegiatan/route.ts:57` menetapkan
 * `userId: ctx.session!.user.id`, menimpa apa pun yang dikirim klien, sehingga
 * kegiatan yang dicatat dari web selalu tercatat atas nama pencatatnya sendiri.
 * Menambahkan pemilih sales di sini tidak akan berpengaruh apa pun selain
 * membohongi pemakai tentang apa yang tersimpan.
 */
export function keMuatanKegiatan(nilai: NilaiFormKegiatan) {
  return {
    jenis: nilai.jenis,
    hasil: nilai.hasil,
    waktuMulai: keInstanIso(nilai.waktuMulai),
    alamatDikunjungi: teksAtauNull(nilai.alamatDikunjungi),
    ditemuiNama: teksAtauNull(nilai.ditemuiNama),
    catatan: teksAtauNull(nilai.catatan),
    prospekId: teksAtauNull(nilai.prospekId),
    iklanId: teksAtauNull(nilai.iklanId),
  };
}

/** Badan `POST /api/presurvei/kegiatan`. */
export type MuatanKegiatan = ReturnType<typeof keMuatanKegiatan>;

/** Kunci pesan yang tidak menempel ke satu medan pun. */
export const KUNCI_KESALAHAN_FORM = "_form";

/** Pesan kesalahan per medan, hasil `safeParse` yang gagal. */
export type KesalahanForm = Partial<
  Record<keyof NilaiFormKegiatan | typeof KUNCI_KESALAHAN_FORM, string>
>;

/**
 * Medan yang punya tempat menampilkan pesan kesalahan di form.
 *
 * `Record` memaksa setiap medan dijawab saat kompilasi: medan baru tidak bisa
 * masuk `NilaiFormKegiatan` tanpa memutuskan ke mana pesannya pergi.
 */
const MEDAN_BERSLOT_PESAN: Record<keyof NilaiFormKegiatan, boolean> = {
  jenis: true,
  hasil: true,
  waktuMulai: true,
  alamatDikunjungi: true,
  ditemuiNama: true,
  catatan: true,
  prospekId: true,
  iklanId: true,
};

/** Bentuk minimal issue Zod yang dibaca form; menghindari tipe internal Zod. */
interface IssueValidasi {
  path: readonly PropertyKey[];
  message: string;
}

/**
 * Kunci tempat sebuah issue ditampilkan.
 *
 * Path kosong berarti issue level-akar. Ketiga `.refine()` di
 * `catatKegiatanSchema` berada di level akar, jadi pesan seperti "Kunjungan dan
 * survei lokasi wajib menyertakan koordinat" tidak menempel ke medan mana pun —
 * dan medan yang memang tidak ada di form ini (`latitude`, `longitude`,
 * `fotoUrls`) tidak punya slot pesan sama sekali. Tanpa pengalihan ini pemakai
 * menekan Simpan, form menolak, dan tidak ada pesan apa pun yang muncul.
 */
function kunciKesalahan(path: readonly PropertyKey[]): keyof KesalahanForm {
  const kunci = path.length === 0 ? "" : String(path[0]);

  return MEDAN_BERSLOT_PESAN[kunci as keyof NilaiFormKegiatan] === true
    ? (kunci as keyof NilaiFormKegiatan)
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
