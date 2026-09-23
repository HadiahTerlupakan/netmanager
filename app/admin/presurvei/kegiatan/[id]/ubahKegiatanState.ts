import {
  daftarHasilSekelompok,
  hitungPerubahanKegiatan,
  nilaiBaruDariPerubahan,
  ubahKegiatanSchema,
  type KegiatanDetailDto,
  type KegiatanHasil,
  type UbahKegiatanInput,
} from "@/modules/presurvei/client";

/**
 * Keadaan murni modal ubah kegiatan di halaman rincian.
 *
 * Hanya tiga medan yang bisa diubah (`modules/presurvei/domain/kegiatan-perubahan.ts`);
 * jenis, waktu, pelaku, koordinat, foto, dan data teknis sengaja tidak punya
 * tempat di sini — server menolaknya 400 (`ubahKegiatanSchema`, `.strict()`).
 */

/**
 * Dicocokkan ke gerbang `PATCH /api/presurvei/kegiatan/[id]`
 * (`app/api/presurvei/kegiatan/[id]/route.ts`), bukan dipilih: tombol yang
 * lebih longgar dari endpoint-nya menyodorkan form yang pasti berakhir 403.
 */
export const IZIN_UBAH_KEGIATAN = ["presurvei:update", "m_presurvei:update"];

/** Endpoint rincian satu kegiatan; juga kunci `useApi` halaman rincian. */
export function urlRincianKegiatan(kegiatanId: string): string {
  return `/api/presurvei/kegiatan/${kegiatanId}`;
}

/** Nilai medan form; teks selalu string karena berasal dari `<input>`. */
export interface NilaiFormUbahKegiatan {
  hasil: KegiatanHasil;
  ditemuiNama: string;
  catatan: string;
}

/** Pesan saat pemakai menekan Simpan tanpa mengubah apa pun. */
export const PESAN_TANPA_PERUBAHAN = "Belum ada yang diubah.";

/** Nilai awal form dari kegiatan tersimpan; null menjadi isian kosong. */
export function nilaiFormDariKegiatan(
  kegiatan: KegiatanDetailDto,
): NilaiFormUbahKegiatan {
  return {
    hasil: kegiatan.hasil,
    ditemuiNama: kegiatan.ditemuiNama ?? "",
    catatan: kegiatan.catatan ?? "",
  };
}

/** Teks yang sudah dirapikan, atau null bila medannya dikosongkan. */
function teksAtauNull(teks: string): string | null {
  const bersih = teks.trim();
  return bersih === "" ? null : bersih;
}

/**
 * Muatan `PATCH` yang hanya membawa medan yang benar-benar berubah.
 *
 * Memakai diff domain yang sama dengan server (`hitungPerubahanKegiatan`),
 * setelah isian dirapikan — spasi tambahan atau isian kosong di atas nilai
 * null bukan perubahan, dan tidak boleh jadi baris jejak audit.
 */
export function keMuatanUbahKegiatan(
  kegiatan: KegiatanDetailDto,
  nilai: NilaiFormUbahKegiatan,
): UbahKegiatanInput {
  const perubahan = hitungPerubahanKegiatan(
    {
      hasil: kegiatan.hasil,
      ditemuiNama: kegiatan.ditemuiNama,
      catatan: kegiatan.catatan,
    },
    {
      hasil: nilai.hasil,
      ditemuiNama: teksAtauNull(nilai.ditemuiNama),
      catatan: teksAtauNull(nilai.catatan),
    },
  );
  return nilaiBaruDariPerubahan(perubahan);
}

/** Hasil pemeriksaan form sebelum dikirim. */
export type HasilPeriksaUbah =
  | { success: true; muatan: UbahKegiatanInput }
  | { success: false; pesan: string };

/**
 * Periksa form dengan schema yang sama dengan server. Tanpa perubahan
 * ditolak di sini, bukan dikirim: server menolak badan kosong 400.
 */
export function periksaFormUbah(
  kegiatan: KegiatanDetailDto,
  nilai: NilaiFormUbahKegiatan,
): HasilPeriksaUbah {
  const muatan = keMuatanUbahKegiatan(kegiatan, nilai);
  if (Object.keys(muatan).length === 0) {
    return { success: false, pesan: PESAN_TANPA_PERUBAHAN };
  }

  const hasil = ubahKegiatanSchema.safeParse(muatan);
  if (!hasil.success) {
    return { success: false, pesan: hasil.error.issues[0].message };
  }
  return { success: true, muatan };
}

/**
 * Pilihan hasil di modal: hanya yang sekelompok menurut
 * `isHasilMelahirkanProspek`, karena server menolak yang melintasi batas.
 */
export function pilihanHasilUbah(hasil: KegiatanHasil): KegiatanHasil[] {
  return daftarHasilSekelompok(hasil);
}
