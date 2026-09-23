"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";

import {
  useKeadaanDaftarSalesPresurvei,
  type KeadaanDaftarSales,
} from "../useDaftarSalesPresurvei";
import type { BarisTarget } from "./barisTarget";
import { namaBulan, type Periode } from "./periodeQuery";
import {
  isSimpanTargetTerbuka,
  KUNCI_KESALAHAN_FORM,
  MEDAN_ANGKA,
  nilaiFormDariTarget,
  NILAI_FORM_KOSONG,
  periksaFormTarget,
  TARGET_MAKS,
  type KesalahanFormTarget,
  type MedanAngka,
  type NilaiFormTarget,
} from "./targetFormState";
import { useSimpanTarget } from "./useSimpanTarget";

const KELAS_INPUT =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const KELAS_LABEL =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const KELAS_KESALAHAN = "mt-1 text-xs text-red-600";
const KELAS_TEKS_TETAP =
  "rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-900 dark:bg-gray-900/40 dark:text-white";
const KELAS_PERINGATAN =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400";

/** `Record` memaksa medan angka baru diberi label saat kompilasi. */
const LABEL_MEDAN_ANGKA: Record<MedanAngka, string> = {
  targetKunjungan: "Target kunjungan",
  targetProspek: "Target prospek",
  targetKonversi: "Target konversi",
};

interface TargetFormModalProps {
  /** Periode yang sedang tampil di layar; tidak bisa diubah dari modal. */
  periode: Periode;
  /** Baris yang diubah, atau null untuk menetapkan target baru. */
  targetDiubah: BarisTarget | null;
  onClose: () => void;
}

/** Pemilih sales pada mode buat, sadar keadaan pengambilan daftarnya. */
function PemilihSales({
  keadaan: { status, daftar },
  nilai,
  onUbah,
}: {
  keadaan: KeadaanDaftarSales;
  nilai: string;
  onUbah: (userId: string) => void;
}) {
  if (status === "gagal") {
    return (
      <p role="alert" className={KELAS_PERINGATAN}>
        Daftar sales gagal dimuat, jadi target baru belum bisa ditetapkan. Muat
        ulang halaman untuk mencoba lagi.
      </p>
    );
  }

  return (
    <>
      <select
        id="target-sales"
        value={nilai}
        onChange={(event) => onUbah(event.target.value)}
        disabled={status === "memuat"}
        className={`${KELAS_INPUT} cursor-pointer`}
      >
        <option value="">
          {status === "memuat" ? "Memuat daftar sales…" : "Pilih sales"}
        </option>
        {daftar.map((sales) => (
          <option key={sales.id} value={sales.id}>
            {sales.nama}
          </option>
        ))}
      </select>
      {status === "siap" && daftar.length === 0 && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Belum ada sales aktif di tenant ini.
        </p>
      )}
    </>
  );
}

/**
 * Modal menetapkan atau mengubah target seorang sales pada periode yang
 * sedang tampil. Keduanya `POST` yang sama; menyimpan sales dan periode yang
 * sama menimpa target lama
 * (`modules/presurvei/repositories/TargetRepository.ts:45-63`).
 */
export function TargetFormModal({
  periode,
  targetDiubah,
  onClose,
}: TargetFormModalProps) {
  const isUbah = targetDiubah !== null;
  const keadaanDaftarSales = useKeadaanDaftarSalesPresurvei();
  const { simpan, isMenyimpan } = useSimpanTarget(onClose);
  const [nilai, setNilai] = useState<NilaiFormTarget>(() =>
    isUbah ? nilaiFormDariTarget(targetDiubah) : NILAI_FORM_KOSONG,
  );
  const [kesalahan, setKesalahan] = useState<KesalahanFormTarget>({});

  const ubahMedan = (perubahan: Partial<NilaiFormTarget>) => {
    setNilai((lama) => ({ ...lama, ...perubahan }));
    setKesalahan((lama) => {
      const berikutnya = { ...lama };
      for (const kunci of Object.keys(perubahan) as (keyof NilaiFormTarget)[]) {
        delete berikutnya[kunci];
      }
      delete berikutnya[KUNCI_KESALAHAN_FORM];
      return berikutnya;
    });
  };

  const kirim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const hasil = periksaFormTarget(nilai, periode);
    if (hasil.success === false) {
      setKesalahan(hasil.kesalahan);
      return;
    }

    setKesalahan({});
    void simpan(hasil.muatan);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isUbah ? "Ubah Target" : "Tetapkan Target"}
      size="lg"
    >
      <form onSubmit={kirim} className="space-y-4">
        <p className="text-sm text-gray-500">
          Menyimpan target untuk sales dan periode yang sama akan menimpa target
          sebelumnya, bukan menambah baris baru.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className={KELAS_LABEL}>Periode</span>
            <p className={KELAS_TEKS_TETAP}>
              {namaBulan(periode.bulan)} {periode.tahun}
            </p>
          </div>

          <div>
            <label className={KELAS_LABEL} htmlFor="target-sales">
              Sales *
            </label>
            {isUbah ? (
              <p className={KELAS_TEKS_TETAP}>{targetDiubah.namaSales}</p>
            ) : (
              <PemilihSales
                keadaan={keadaanDaftarSales}
                nilai={nilai.userId}
                onUbah={(userId) => ubahMedan({ userId })}
              />
            )}
            {kesalahan.userId && (
              <p className={KELAS_KESALAHAN}>{kesalahan.userId}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {MEDAN_ANGKA.map((kunci) => (
            <div key={kunci}>
              <label className={KELAS_LABEL} htmlFor={`target-${kunci}`}>
                {LABEL_MEDAN_ANGKA[kunci]} *
              </label>
              <input
                id={`target-${kunci}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={TARGET_MAKS}
                step={1}
                value={nilai[kunci]}
                onChange={(event) => ubahMedan({ [kunci]: event.target.value })}
                className={KELAS_INPUT}
              />
              {kesalahan[kunci] && (
                <p className={KELAS_KESALAHAN}>{kesalahan[kunci]}</p>
              )}
            </div>
          ))}
        </div>

        {kesalahan[KUNCI_KESALAHAN_FORM] && (
          <p role="alert" className={KELAS_PERINGATAN}>
            {kesalahan[KUNCI_KESALAHAN_FORM]}
          </p>
        )}

        <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            loading={isMenyimpan}
            disabled={
              !isSimpanTargetTerbuka({
                isUbah,
                statusDaftarSales: keadaanDaftarSales.status,
              })
            }
          >
            Simpan Target
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
