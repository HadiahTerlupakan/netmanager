"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { useApi } from "@/lib/hooks/useApi";
import {
  PROSPEK_STATUS_CONFIG,
  type ProspekDetailDto,
} from "@/modules/presurvei/client";

import {
  isPerluTandaiDeal,
  keMuatanKonversi,
  NILAI_FORM_KONVERSI_KOSONG,
  validasiFormKonversi,
  type KesalahanFormKonversi,
  type NilaiFormKonversi,
} from "./konversiFormState";
import { buildUbahProspekUrl } from "./pindahProspek";
import { useJadikanCanvasing } from "./useJadikanCanvasing";

/**
 * Batas panjang medan, mencerminkan `jadikanCanvasingSchema`
 * (`modules/presurvei/validators/konversi.validator.ts:12-14`). Konstanta
 * validator tidak diekspor, jadi angkanya ditulis ulang — seperti
 * `ProspekFormModal.tsx`.
 */
const PANJANG_KTP_MAKS = 20;
const PANJANG_TEKS_MAKS = 120;

/**
 * Petunjuk medan kabel. Benar terhadap `ProspekKonversiService.ts:176`
 * (`input.kabel ?? estimasiKabelSurvei(survei) ?? KABEL_BAWAAN_METER`, dengan
 * `KABEL_BAWAAN_METER = 1` di `:22`) dan `ambilSurveiTerbaru` (`:148-158`),
 * yang mengambil SATU survei lokasi terbaru menurut `waktuMulai`
 * (`KegiatanRepository.ts`, `orderBy` di `findMany`) — survei lebih lama
 * tidak ikut diperiksa.
 *
 * "Mencatat 0 meter" bersumber dari `estimasiKabelSurvei` (`:248-252`):
 * estimasi di bawah minimum canvasing (`KABEL_MINIMAL_CANVASING_METER = 1`,
 * `:28`) diperlakukan sama dengan survei yang tidak mencatat kabel.
 */
export const TEKS_PETUNJUK_KABEL =
  "Kosongkan untuk memakai estimasi kabel dari survei lokasi terakhir prospek ini. Bila survei itu tidak mencatatnya, mencatat 0 meter, atau belum ada survei, dipakai 1 meter.";

/** Petunjuk medan ODP; benar terhadap `ProspekKonversiService.ts:177`. */
export const TEKS_PETUNJUK_ODP =
  "Kosongkan untuk memakai ODP terdekat dari survei lokasi terakhir prospek ini, bila dicatat.";

/**
 * Pemberitahuan untuk prospek yang belum DEAL: simpan menjalankan dua
 * permintaan (`useJadikanCanvasing`).
 */
export const TEKS_DUA_LANGKAH =
  "Menyimpan akan memindahkan prospek ini ke Deal lebih dulu, lalu membuat canvasing.";

/** Pesan untuk prospek yang sudah punya canvasing (`canvasingId` terisi). */
export const TEKS_SUDAH_CANVASING = "Prospek ini sudah dijadikan canvasing.";

const KELAS_INPUT =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const KELAS_LABEL =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const KELAS_KESALAHAN = "mt-1 text-xs text-red-600";
const KELAS_PETUNJUK = "mt-1 text-xs text-gray-500 dark:text-gray-400";

interface KerangkaModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Bingkai modal yang sama untuk form, kerangka muat, dan pesan. */
function KerangkaModal({ isOpen, onClose, children }: KerangkaModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Jadikan Canvasing"
      size="xl"
    >
      {children}
    </Modal>
  );
}

interface MedanTeksProps {
  id: string;
  label: string;
  value: string;
  onChange: (nilai: string) => void;
  kesalahan: string | undefined;
  petunjuk?: string;
  type?: "text" | "url";
  inputMode?: "numeric";
  maxLength?: number;
}

/** Satu medan teks beserta pesan kesalahan dan petunjuknya. */
function MedanTeks({
  id,
  label,
  value,
  onChange,
  kesalahan,
  petunjuk,
  type = "text",
  inputMode,
  maxLength,
}: MedanTeksProps) {
  return (
    <div>
      <label className={KELAS_LABEL} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        className={KELAS_INPUT}
      />
      {kesalahan && <p className={KELAS_KESALAHAN}>{kesalahan}</p>}
      {petunjuk && <p className={KELAS_PETUNJUK}>{petunjuk}</p>}
    </div>
  );
}

interface FormKonversiProps {
  prospek: ProspekDetailDto;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Form konversi beserta state-nya, dengan modal di DALAM komponen ini:
 * `<Modal>` yang tertutup merender null (`components/ui/Modal.tsx:54`).
 */
function FormKonversi({ prospek, isOpen, onClose }: FormKonversiProps) {
  const [nilai, setNilai] = useState<NilaiFormKonversi>(
    NILAI_FORM_KONVERSI_KOSONG,
  );
  const [kesalahan, setKesalahan] = useState<KesalahanFormKonversi>({});
  const { jadikan, isMenyimpan } = useJadikanCanvasing(
    prospek.id,
    prospek.status,
    onClose,
  );

  const ubahMedan = (kunci: keyof NilaiFormKonversi) => (isian: string) => {
    setNilai((lama) => ({ ...lama, [kunci]: isian }));
    setKesalahan((lama) => ({ ...lama, [kunci]: undefined }));
  };

  const kirim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Divalidasi sebelum permintaan apa pun: langkah pertama sudah menulis
    // status DEAL, jadi ISIAN yang pasti ditolak tidak boleh sampai ke sana.
    // Nilai yang diambil server dari survei (kabel kosong) tidak terlihat di
    // sini, dan tidak perlu dijaga: estimasi survei di bawah 1 meter diganti
    // bawaan 1 meter oleh server (`estimasiKabelSurvei`); lihat
    // `TEKS_PETUNJUK_KABEL`.
    const kesalahanBaru = validasiFormKonversi(nilai);
    setKesalahan(kesalahanBaru);
    if (Object.keys(kesalahanBaru).length > 0) return;

    void jadikan(keMuatanKonversi(nilai));
  };

  return (
    <KerangkaModal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={kirim}>
        <fieldset disabled={isMenyimpan} className="min-w-0 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">
              {prospek.nama}
            </span>{" "}
            — {PROSPEK_STATUS_CONFIG[prospek.status].label}
          </p>

          {isPerluTandaiDeal(prospek.status) && (
            <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
              {TEKS_DUA_LANGKAH}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MedanTeks
              id="konversi-ktp"
              label="Nomor KTP *"
              value={nilai.noKtp}
              onChange={ubahMedan("noKtp")}
              kesalahan={kesalahan.noKtp}
              inputMode="numeric"
              maxLength={PANJANG_KTP_MAKS}
            />
            <MedanTeks
              id="konversi-paket"
              label="Paket *"
              value={nilai.paket}
              onChange={ubahMedan("paket")}
              kesalahan={kesalahan.paket}
              maxLength={PANJANG_TEKS_MAKS}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MedanTeks
              id="konversi-kabel"
              label="Panjang kabel (meter)"
              value={nilai.kabel}
              onChange={ubahMedan("kabel")}
              kesalahan={kesalahan.kabel}
              petunjuk={TEKS_PETUNJUK_KABEL}
              inputMode="numeric"
            />
            <MedanTeks
              id="konversi-odp"
              label="ODP"
              value={nilai.odp}
              onChange={ubahMedan("odp")}
              kesalahan={kesalahan.odp}
              petunjuk={TEKS_PETUNJUK_ODP}
              maxLength={PANJANG_TEKS_MAKS}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MedanTeks
              id="konversi-sn"
              label="Nomor seri perangkat"
              value={nilai.sn}
              onChange={ubahMedan("sn")}
              kesalahan={kesalahan.sn}
              maxLength={PANJANG_TEKS_MAKS}
            />
            <MedanTeks
              id="konversi-foto-ktp"
              label="Tautan foto KTP"
              type="url"
              value={nilai.fotoKtp}
              onChange={ubahMedan("fotoKtp")}
              kesalahan={kesalahan.fotoKtp}
            />
          </div>
        </fieldset>

        <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={isMenyimpan}>
            Jadikan Canvasing
          </Button>
        </ModalFooter>
      </form>
    </KerangkaModal>
  );
}

interface KonversiModalProps {
  prospekId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal promosi prospek ke canvasing — ujung corong papan prospek.
 *
 * Dibuka dari jatuhan kartu ke kolom DEAL maupun tombol di kartu DEAL.
 * Membuka dan membatalkannya tidak menulis apa pun: status baru dipindah ke
 * DEAL saat pemakai menyimpan (`useJadikanCanvasing`).
 *
 * `kabel` dan `odp` dibiarkan kosong, tidak diisi awal dari survei: server
 * sudah memakai survei lokasi terakhir untuk medan yang kosong
 * (`ProspekKonversiService.ts:176-177`) saat konversi dijalankan. Mengisi
 * awal di klien berarti dua permintaan tambahan (daftar kegiatan tidak
 * membawa data teknis), dan daftar kegiatan bagi pemakai tanpa izin lihat-
 * semua hanya memuat kegiatannya sendiri (`app/api/presurvei/kegiatan/route.ts:31-37`)
 * — angka yang tampil bisa berasal dari survei yang berbeda dengan yang
 * dipakai server, lalu mengalahkannya karena terkirim sebagai isian.
 */
export function KonversiModal({
  prospekId,
  isOpen,
  onClose,
}: KonversiModalProps) {
  const rincian = useApi<ProspekDetailDto>(buildUbahProspekUrl(prospekId));

  if (rincian.error !== null) {
    return (
      <KerangkaModal isOpen={isOpen} onClose={onClose}>
        <p role="alert" className="py-6 text-center text-sm text-red-600">
          Rincian prospek gagal dimuat.
        </p>
      </KerangkaModal>
    );
  }

  if (rincian.data === undefined) {
    return (
      <KerangkaModal isOpen={isOpen} onClose={onClose}>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </KerangkaModal>
    );
  }

  if (rincian.data.canvasingId !== null) {
    return (
      <KerangkaModal isOpen={isOpen} onClose={onClose}>
        <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {TEKS_SUDAH_CANVASING}
        </p>
      </KerangkaModal>
    );
  }

  return (
    <FormKonversi prospek={rincian.data} isOpen={isOpen} onClose={onClose} />
  );
}
