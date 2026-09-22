import {
  buatIklanSchema,
  ubahIklanSchema,
  type IklanChannel,
  type IklanDetailDto,
} from "@/modules/presurvei/client";

/** Tujuan tombol Batal dan tujuan kembali setelah kampanye tersimpan. */
export const URL_DAFTAR_IKLAN = "/admin/presurvei/iklan";

/** Endpoint koleksi kampanye; endpoint detail adalah ini ditambah `/{id}`. */
const URL_API_IKLAN = "/api/admin/presurvei/iklan";

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
 * Mode form beserta data yang hanya ada pada mode itu.
 *
 * Union bertanda, bukan `isModeUbah: boolean` + `iklanId?: string` terpisah.
 * Bentuk form dan tujuan permintaannya dulu dua nilai berbeda yang diikat
 * tangan di dua berkas: mengubah salah satunya saja lolos `tsc` dan lolos
 * seluruh suite. Arah yang senyap adalah form mode buat di layar ubah —
 * `kode` ikut terkirim ke `PATCH`, `ubahIklanSchema` men-strip-nya tanpa
 * error, server menjawab 200, dan pemakai yakin kode UTM-nya sudah berubah.
 *
 * Dengan satu nilai, keduanya tidak bisa lagi berbeda pendapat; `iklanId`
 * yang hanya ada pada mode ubah juga jadi mustahil tertinggal.
 */
export type ModeFormIklan =
  | { jenis: "buat" }
  | { jenis: "ubah"; iklanId: string };

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
export function schemaUntukMode(mode: ModeFormIklan) {
  return mode.jenis === "ubah" ? ubahIklanSchema : buatIklanSchema;
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
export function muatanUntukMode(mode: ModeFormIklan, nilai: NilaiFormIklan) {
  return mode.jenis === "ubah" ? keMuatanUbah(nilai) : keMuatanBuat(nilai);
}

/** Tujuan permintaan simpan beserta teks notifikasinya. */
export interface OpsiSimpanIklan {
  /** Endpoint tujuan; untuk mode ubah ini sekaligus key cache detailnya. */
  url: string;
  method: "POST" | "PATCH";
  pesanSukses: string;
  pesanGagal: string;
}

/**
 * Tujuan permintaan simpan untuk mode form saat ini.
 *
 * Diturunkan dari `ModeFormIklan` yang sama dengan schema dan pembentuk
 * muatannya, supaya endpoint, metode, dan bentuk form tidak bisa berselisih.
 * `iklanId` ikut di dalam mode, jadi endpoint detail tanpa id bukan keadaan
 * yang bisa ditulis — bukan sesuatu yang perlu dijaga saat berjalan.
 */
export function opsiSimpanUntukMode(mode: ModeFormIklan): OpsiSimpanIklan {
  if (mode.jenis === "ubah") {
    return {
      url: `${URL_API_IKLAN}/${mode.iklanId}`,
      method: "PATCH",
      pesanSukses: "Kampanye berhasil diperbarui",
      pesanGagal: "Gagal memperbarui kampanye",
    };
  }

  return {
    url: URL_API_IKLAN,
    method: "POST",
    pesanSukses: "Kampanye berhasil dibuat",
    pesanGagal: "Gagal membuat kampanye",
  };
}

/** Kunci pesan yang tidak menempel ke satu medan pun. */
export const KUNCI_KESALAHAN_FORM = "_form";

/** Pesan kesalahan per medan, hasil `safeParse` yang gagal. */
export type KesalahanForm = Partial<
  Record<keyof NilaiFormIklan | typeof KUNCI_KESALAHAN_FORM, string>
>;

/**
 * Medan yang punya tempat menampilkan pesan kesalahan di form.
 *
 * `Record` memaksa setiap medan dijawab saat kompilasi: medan baru tidak bisa
 * masuk `NilaiFormIklan` tanpa memutuskan ke mana pesannya pergi. `isAktif`
 * adalah checkbox tanpa slot pesan, jadi issue untuknya dialihkan ke pesan
 * level-form alih-alih menguap.
 */
const MEDAN_BERSLOT_PESAN: Record<keyof NilaiFormIklan, boolean> = {
  nama: true,
  kode: true,
  channel: true,
  tanggalMulai: true,
  tanggalSelesai: true,
  biaya: true,
  isAktif: false,
};

/** Bentuk minimal issue Zod yang dibaca form; menghindari tipe internal Zod. */
interface IssueValidasi {
  path: readonly PropertyKey[];
  message: string;
}

/**
 * Kunci tempat sebuah issue ditampilkan.
 *
 * Path kosong berarti issue level-akar — aturan lintas-medan seperti "tanggal
 * selesai tidak boleh mendahului mulai" tidak menempel ke satu medan pun.
 * `String(path[0])` atas path kosong menghasilkan kunci `"undefined"`, dan
 * medan yang tidak punya slot pesan menghasilkan kunci yang tak pernah
 * dirender; keduanya berakhir sama: pemakai menekan Simpan, form menolak, dan
 * tidak ada pesan apa pun yang muncul. Keduanya dialihkan ke pesan level-form.
 */
function kunciKesalahan(path: readonly PropertyKey[]): keyof KesalahanForm {
  const kunci = path.length === 0 ? "" : String(path[0]);

  return MEDAN_BERSLOT_PESAN[kunci as keyof NilaiFormIklan] === true
    ? (kunci as keyof NilaiFormIklan)
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
