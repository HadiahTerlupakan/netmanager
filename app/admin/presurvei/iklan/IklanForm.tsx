"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { HiOutlineArrowLeft } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import {
  buatIklanSchema,
  IKLAN_CHANNEL_CONFIG,
  IKLAN_CHANNELS,
  ubahIklanSchema,
  type IklanChannel,
} from "@/modules/presurvei/client";

import {
  keMuatanBuat,
  keMuatanUbah,
  URL_DAFTAR_IKLAN,
  type MuatanBuatIklan,
  type MuatanUbahIklan,
  type NilaiFormIklan,
} from "./iklanFormState";

/**
 * Batas medan, mencerminkan `buatIklanSchema`
 * (`modules/presurvei/validators/iklan.validator.ts`). Konstanta validator
 * tidak diekspor, jadi angkanya ditulis ulang di sini — sama seperti
 * `IklanFilters.tsx`. Tanpa batas ini pemakai baru tahu kelebihan panjang
 * setelah menekan Simpan.
 */
const PANJANG_NAMA_MAKS = 120;
const PANJANG_KODE_MAKS = 60;

/** Biaya terkecil yang diterima schema; nol berarti kampanye organik. */
const BIAYA_MIN = 0;

const KELAS_INPUT =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const KELAS_LABEL =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const KELAS_KESALAHAN = "mt-1 text-xs text-red-600";
const KELAS_PETUNJUK = "mt-1 text-xs text-gray-500 dark:text-gray-400";
const KELAS_KARTU =
  "space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800";

/** Pesan kesalahan per medan, hasil `safeParse` yang gagal. */
type KesalahanForm = Partial<Record<keyof NilaiFormIklan, string>>;

interface IklanFormProps {
  nilai: NilaiFormIklan;
  onUbah: (perubahan: Partial<NilaiFormIklan>) => void;
  onSimpan: (muatan: MuatanBuatIklan | MuatanUbahIklan) => void;
  isMenyimpan: boolean;
  isModeUbah: boolean;
}

/**
 * Form kampanye iklan, dipakai ulang oleh mode buat dan ubah.
 *
 * Pemilihan schema, pembentuk muatan, dan bentuk medan kode semuanya
 * diturunkan dari `isModeUbah` di satu tempat ini. Pemanggil hanya menerima
 * muatan yang sudah lolos validasi dan mengirimkannya — sehingga tidak ada
 * kesempatan memasangkan schema buat dengan muatan ubah, atau sebaliknya.
 */
export function IklanForm({
  nilai,
  onUbah,
  onSimpan,
  isMenyimpan,
  isModeUbah,
}: IklanFormProps) {
  const [kesalahan, setKesalahan] = useState<KesalahanForm>({});

  const ubahMedan = (perubahan: Partial<NilaiFormIklan>) => {
    onUbah(perubahan);
    // Kesalahan medan yang baru disunting dihapus supaya teks merahnya tidak
    // bertahan setelah pemakai memperbaikinya; medan lain tetap ditandai.
    setKesalahan((lama) => {
      const berikutnya = { ...lama };
      for (const kunci of Object.keys(perubahan) as (keyof NilaiFormIklan)[]) {
        delete berikutnya[kunci];
      }
      return berikutnya;
    });
  };

  const kirim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const hasil = isModeUbah
      ? ubahIklanSchema.safeParse(keMuatanUbah(nilai))
      : buatIklanSchema.safeParse(keMuatanBuat(nilai));

    if (!hasil.success) {
      setKesalahan(
        Object.fromEntries(
          hasil.error.issues.map((masalah) => [
            String(masalah.path[0]),
            masalah.message,
          ]),
        ),
      );
      return;
    }

    setKesalahan({});
    // Muatan mentah, bukan `hasil.data`: Zod meng-coerce tanggal jadi objek
    // `Date`, dan `JSON.stringify` pada `Date` menghasilkan ISO dengan jam
    // lokal ikut tergeser. Server memvalidasi ulang dengan schema yang sama.
    onSimpan(isModeUbah ? keMuatanUbah(nilai) : keMuatanBuat(nilai));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={URL_DAFTAR_IKLAN}>
          <Button variant="ghost" size="icon" aria-label="Kembali ke daftar">
            <HiOutlineArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {isModeUbah ? "Ubah Kampanye" : "Kampanye Baru"}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Kampanye iklan menjadi sumber atribusi prospek presurvei
          </p>
        </div>
      </div>

      <form onSubmit={kirim} className="space-y-6">
        <div className={KELAS_KARTU}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Identitas Kampanye
          </h2>

          <div>
            <label className={KELAS_LABEL} htmlFor="iklan-nama">
              Nama kampanye *
            </label>
            <input
              id="iklan-nama"
              type="text"
              value={nilai.nama}
              onChange={(event) => ubahMedan({ nama: event.target.value })}
              maxLength={PANJANG_NAMA_MAKS}
              placeholder="Contoh: Promo Ramadan"
              className={KELAS_INPUT}
            />
            {kesalahan.nama && (
              <p className={KELAS_KESALAHAN}>{kesalahan.nama}</p>
            )}
          </div>

          {isModeUbah ? (
            <div>
              <span className={KELAS_LABEL}>Kode UTM</span>
              <p className="rounded-lg bg-gray-50 px-3 py-2.5 font-mono text-sm text-gray-900 dark:bg-gray-900 dark:text-white">
                {nilai.kode}
              </p>
              <p className={KELAS_PETUNJUK}>
                Kode UTM tidak bisa diubah setelah kampanye dibuat
              </p>
            </div>
          ) : (
            <div>
              <label className={KELAS_LABEL} htmlFor="iklan-kode">
                Kode UTM *
              </label>
              <input
                id="iklan-kode"
                type="text"
                value={nilai.kode}
                onChange={(event) => ubahMedan({ kode: event.target.value })}
                maxLength={PANJANG_KODE_MAKS}
                placeholder="promo-ramadan"
                className={KELAS_INPUT}
              />
              {kesalahan.kode && (
                <p className={KELAS_KESALAHAN}>{kesalahan.kode}</p>
              )}
              <p className={KELAS_PETUNJUK}>
                Huruf kecil, angka, dan tanda hubung. Dipakai sebagai
                utm_campaign di tautan iklan dan tidak bisa diubah lagi setelah
                disimpan.
              </p>
            </div>
          )}

          <div>
            <label className={KELAS_LABEL} htmlFor="iklan-channel">
              Channel *
            </label>
            <select
              id="iklan-channel"
              value={nilai.channel}
              onChange={(event) =>
                ubahMedan({ channel: event.target.value as IklanChannel })
              }
              className={`${KELAS_INPUT} cursor-pointer`}
            >
              {IKLAN_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {IKLAN_CHANNEL_CONFIG[channel].label}
                </option>
              ))}
            </select>
            {kesalahan.channel && (
              <p className={KELAS_KESALAHAN}>{kesalahan.channel}</p>
            )}
          </div>
        </div>

        <div className={KELAS_KARTU}>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Periode & Biaya
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={KELAS_LABEL} htmlFor="iklan-tanggal-mulai">
                Tanggal mulai *
              </label>
              <input
                id="iklan-tanggal-mulai"
                type="date"
                value={nilai.tanggalMulai}
                onChange={(event) =>
                  ubahMedan({ tanggalMulai: event.target.value })
                }
                className={KELAS_INPUT}
              />
              {kesalahan.tanggalMulai && (
                <p className={KELAS_KESALAHAN}>{kesalahan.tanggalMulai}</p>
              )}
            </div>

            <div>
              <label className={KELAS_LABEL} htmlFor="iklan-tanggal-selesai">
                Tanggal selesai
              </label>
              <input
                id="iklan-tanggal-selesai"
                type="date"
                value={nilai.tanggalSelesai}
                onChange={(event) =>
                  ubahMedan({ tanggalSelesai: event.target.value })
                }
                className={KELAS_INPUT}
              />
              {kesalahan.tanggalSelesai && (
                <p className={KELAS_KESALAHAN}>{kesalahan.tanggalSelesai}</p>
              )}
              <p className={KELAS_PETUNJUK}>
                Kosongkan bila kampanye berjalan sampai dimatikan manual.
              </p>
            </div>

            <div>
              <label className={KELAS_LABEL} htmlFor="iklan-biaya">
                Biaya (Rp)
              </label>
              <input
                id="iklan-biaya"
                type="number"
                min={BIAYA_MIN}
                value={nilai.biaya}
                onChange={(event) => ubahMedan({ biaya: event.target.value })}
                placeholder="1500000"
                className={KELAS_INPUT}
              />
              {kesalahan.biaya && (
                <p className={KELAS_KESALAHAN}>{kesalahan.biaya}</p>
              )}
              <p className={KELAS_PETUNJUK}>
                Isi 0 untuk kampanye organik; kosongkan bila biayanya belum
                diketahui.
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={nilai.isAktif}
              onChange={(event) => ubahMedan({ isAktif: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Kampanye aktif
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href={URL_DAFTAR_IKLAN}>
            <Button type="button" variant="outline">
              Batal
            </Button>
          </Link>
          <Button type="submit" loading={isMenyimpan}>
            {isModeUbah ? "Simpan Perubahan" : "Buat Kampanye"}
          </Button>
        </div>
      </form>
    </div>
  );
}
