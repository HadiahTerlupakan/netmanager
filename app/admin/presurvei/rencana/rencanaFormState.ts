import {
  ALAMAT_RENCANA_MAKS,
  ALASAN_BATAL_MAKS,
  ALASAN_BATAL_MIN,
  TUJUAN_RENCANA_MAKS,
  type RencanaDto,
  type RencanaJenis,
} from "@/modules/presurvei/client";

/** Jenis bawaan penugasan baru. */
export const JENIS_BAWAAN: RencanaJenis = "KUNJUNGAN";

export const PESAN_SALES_WAJIB = "Pilih sales yang ditugasi.";
export const PESAN_TANGGAL_WAJIB = "Isi tanggal rencana.";
export const PESAN_TANGGAL_LAMPAU =
  "Tanggal rencana tidak boleh sebelum hari ini.";
export const PESAN_TUJUAN_WAJIB = "Tujuan kunjungan wajib diisi.";
export const PESAN_TUJUAN_PANJANG = `Tujuan maksimal ${TUJUAN_RENCANA_MAKS} karakter.`;
export const PESAN_ALAMAT_PANJANG = `Alamat maksimal ${ALAMAT_RENCANA_MAKS} karakter.`;
export const PESAN_TANPA_PERUBAHAN = "Belum ada perubahan untuk disimpan.";
export const PESAN_JAM_TIDAK_SAH = "Format jam harus HH:mm.";

/** Jam 24 jam "HH:mm" — sama dengan `POLA_JAM` di domain rencana. */
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PESAN_ALASAN_PENDEK = `Alasan minimal ${ALASAN_BATAL_MIN} karakter.`;
export const PESAN_ALASAN_PANJANG = `Alasan maksimal ${ALASAN_BATAL_MAKS} karakter.`;

/** Kunci pesan yang tidak menempel ke satu medan pun. */
export const KUNCI_KESALAHAN_FORM = "_form";

/** Hasil pemeriksaan form: muatan siap kirim, atau pesan per medan. */
export type HasilPeriksa<Muatan, Medan extends string> =
  | { success: true; muatan: Muatan }
  | {
      success: false;
      kesalahan: Partial<Record<Medan | typeof KUNCI_KESALAHAN_FORM, string>>;
    };

// --- Buat penugasan ---------------------------------------------------------

/** Isian form penugasan; semuanya string karena berasal dari medan form. */
export interface NilaiFormPenugasan {
  salesId: string;
  tanggal: string;
  /** "HH:mm" atau "" (tanpa jam). */
  jam: string;
  jenis: RencanaJenis;
  tujuan: string;
  alamat: string;
}

/** Badan `POST /api/presurvei/rencana` dari layar admin. */
export interface MuatanPenugasan {
  salesId: string;
  tanggal: string;
  jam?: string;
  jenis: RencanaJenis;
  tujuan: string;
  alamat?: string;
}

export type KesalahanFormPenugasan = Extract<
  HasilPeriksa<MuatanPenugasan, keyof NilaiFormPenugasan>,
  { success: false }
>["kesalahan"];

/** Isian awal form penugasan, bertanggal hari ini. */
export function nilaiAwalPenugasan(hariIni: string): NilaiFormPenugasan {
  return {
    salesId: "",
    tanggal: hariIni,
    jam: "",
    jenis: JENIS_BAWAAN,
    tujuan: "",
    alamat: "",
  };
}

/** Pesan medan tanggal, atau null bila sah. Tanggal lampau ditolak server. */
function periksaTanggal(tanggal: string, hariIni: string): string | null {
  if (tanggal.trim().length === 0) return PESAN_TANGGAL_WAJIB;
  if (tanggal < hariIni) return PESAN_TANGGAL_LAMPAU;
  return null;
}

/** Pesan medan jam, atau null bila sah. Jam kosong berarti tanpa jam. */
function periksaJam(jam: string): string | null {
  if (jam.length === 0) return null;
  return POLA_JAM.test(jam) ? null : PESAN_JAM_TIDAK_SAH;
}

/** Pesan medan tujuan, atau null bila sah. */
function periksaTujuan(tujuan: string): string | null {
  const bersih = tujuan.trim();
  if (bersih.length === 0) return PESAN_TUJUAN_WAJIB;
  if (bersih.length > TUJUAN_RENCANA_MAKS) return PESAN_TUJUAN_PANJANG;
  return null;
}

/**
 * Periksa form penugasan dan bentuk muatannya.
 *
 * Aturannya cermin `buatRencanaSchema` + `isTanggalBolehDirencanakan`,
 * ditambah sales wajib dipilih: tanpa `salesId` server membuat rencana
 * MANDIRI untuk pemanggil, bukan penugasan.
 */
export function periksaFormPenugasan(
  nilai: NilaiFormPenugasan,
  hariIni: string,
): HasilPeriksa<MuatanPenugasan, keyof NilaiFormPenugasan> {
  const kesalahan: KesalahanFormPenugasan = {};
  const alamat = nilai.alamat.trim();

  if (nilai.salesId.trim().length === 0) kesalahan.salesId = PESAN_SALES_WAJIB;
  const pesanTanggal = periksaTanggal(nilai.tanggal, hariIni);
  if (pesanTanggal) kesalahan.tanggal = pesanTanggal;
  const pesanJam = periksaJam(nilai.jam);
  if (pesanJam) kesalahan.jam = pesanJam;
  const pesanTujuan = periksaTujuan(nilai.tujuan);
  if (pesanTujuan) kesalahan.tujuan = pesanTujuan;
  if (alamat.length > ALAMAT_RENCANA_MAKS)
    kesalahan.alamat = PESAN_ALAMAT_PANJANG;

  if (Object.keys(kesalahan).length > 0) return { success: false, kesalahan };

  return {
    success: true,
    muatan: {
      salesId: nilai.salesId.trim(),
      tanggal: nilai.tanggal,
      ...(nilai.jam.length > 0 ? { jam: nilai.jam } : {}),
      jenis: nilai.jenis,
      tujuan: nilai.tujuan.trim(),
      ...(alamat.length > 0 ? { alamat } : {}),
    },
  };
}

// --- Jadwal ulang / ubah ----------------------------------------------------

/** Isian form jadwal ulang. */
export interface NilaiFormUbahRencana {
  tanggal: string;
  /** "HH:mm" atau "" (tanpa jam). */
  jam: string;
  tujuan: string;
}

/** Badan `PATCH /api/presurvei/rencana/[id]` — hanya medan yang berubah; jam null = hapus jam. */
export type MuatanUbahRencana = Partial<Omit<NilaiFormUbahRencana, "jam">> & {
  jam?: string | null;
};

/** Isian awal form ubah dari rencana yang sedang dibuka. */
export function nilaiUbahDariRencana(
  rencana: Pick<RencanaDto, "tanggal" | "jam" | "tujuan">,
): NilaiFormUbahRencana {
  return {
    tanggal: rencana.tanggal,
    jam: rencana.jam ?? "",
    tujuan: rencana.tujuan,
  };
}

/**
 * Periksa form ubah dan bentuk muatan berisi medan yang berubah saja.
 *
 * `ubahRencanaSchema` menolak badan kosong, jadi "tidak ada perubahan"
 * dijawab di sini sebagai pesan form, bukan dikirim lalu ditolak.
 */
export function periksaFormUbahRencana(
  nilai: NilaiFormUbahRencana,
  asal: Pick<RencanaDto, "tanggal" | "jam" | "tujuan">,
  hariIni: string,
): HasilPeriksa<MuatanUbahRencana, keyof NilaiFormUbahRencana> {
  const muatan: MuatanUbahRencana = {};
  const tujuan = nilai.tujuan.trim();

  if (nilai.tanggal !== asal.tanggal) {
    const pesan = periksaTanggal(nilai.tanggal, hariIni);
    if (pesan) return { success: false, kesalahan: { tanggal: pesan } };
    muatan.tanggal = nilai.tanggal;
  }
  if (nilai.jam !== (asal.jam ?? "")) {
    const pesan = periksaJam(nilai.jam);
    if (pesan) return { success: false, kesalahan: { jam: pesan } };
    muatan.jam = nilai.jam.length > 0 ? nilai.jam : null;
  }
  if (tujuan !== asal.tujuan) {
    const pesan = periksaTujuan(tujuan);
    if (pesan) return { success: false, kesalahan: { tujuan: pesan } };
    muatan.tujuan = tujuan;
  }

  if (Object.keys(muatan).length === 0) {
    return {
      success: false,
      kesalahan: { [KUNCI_KESALAHAN_FORM]: PESAN_TANPA_PERUBAHAN },
    };
  }
  return { success: true, muatan };
}

// --- Batal ------------------------------------------------------------------

/** Periksa alasan batal; aturannya cermin `batalRencanaSchema`. */
export function periksaAlasanBatal(
  alasan: string,
): HasilPeriksa<{ alasan: string }, "alasan"> {
  const bersih = alasan.trim();
  if (bersih.length < ALASAN_BATAL_MIN) {
    return { success: false, kesalahan: { alasan: PESAN_ALASAN_PENDEK } };
  }
  if (bersih.length > ALASAN_BATAL_MAKS) {
    return { success: false, kesalahan: { alasan: PESAN_ALASAN_PANJANG } };
  }
  return { success: true, muatan: { alasan: bersih } };
}
