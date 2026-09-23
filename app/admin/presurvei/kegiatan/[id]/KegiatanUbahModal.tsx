"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import {
  KEGIATAN_HASIL_CONFIG,
  type KegiatanDetailDto,
  type KegiatanHasil,
} from "@/modules/presurvei/client";

import { penutupModalTarget } from "../../target/targetFormState";
import {
  nilaiFormDariKegiatan,
  periksaFormUbah,
  pilihanHasilUbah,
  type NilaiFormUbahKegiatan,
} from "./ubahKegiatanState";
import { useUbahKegiatan } from "./useUbahKegiatan";

/** Batas medan, mencerminkan `ubahKegiatanSchema` (sama dengan form catat). */
const PANJANG_NAMA_MAKS = 120;
const PANJANG_CATATAN_MAKS = 1000;

const KELAS_INPUT =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const KELAS_LABEL =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const KELAS_PETUNJUK = "mt-1 text-xs text-gray-500 dark:text-gray-400";
const KELAS_PERINGATAN =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400";

interface KegiatanUbahModalProps {
  kegiatan: KegiatanDetailDto;
  onClose: () => void;
}

/**
 * Modal ubah kegiatan: catatan, nama yang ditemui, dan hasil saja.
 *
 * Terpisah dari `KegiatanFormModal` (catat) karena medan dan penjaganya
 * berbeda. Dipasang pemanggil hanya saat terbuka (`Modal` sendiri tidak
 * merender apa pun saat tertutup, `components/ui/Modal.tsx:54`), sehingga
 * nilai awalnya selalu dari kegiatan yang sedang tampil.
 */
export function KegiatanUbahModal({
  kegiatan,
  onClose,
}: KegiatanUbahModalProps) {
  const { simpan, isMenyimpan, pesanServer, bersihkanPesanServer } =
    useUbahKegiatan(kegiatan.id, onClose);
  const [nilai, setNilai] = useState<NilaiFormUbahKegiatan>(() =>
    nilaiFormDariKegiatan(kegiatan),
  );
  const [pesanForm, setPesanForm] = useState<string | null>(null);
  const tutup = penutupModalTarget(isMenyimpan, onClose);
  const pesan = pesanForm ?? pesanServer;

  const ubahMedan = (perubahan: Partial<NilaiFormUbahKegiatan>) => {
    setNilai((lama) => ({ ...lama, ...perubahan }));
    setPesanForm(null);
    bersihkanPesanServer();
  };

  const kirim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const hasil = periksaFormUbah(kegiatan, nilai);
    if (hasil.success === false) {
      setPesanForm(hasil.pesan);
      return;
    }

    setPesanForm(null);
    void simpan(hasil.muatan);
  };

  return (
    <Modal
      isOpen
      onClose={tutup}
      title="Ubah Kegiatan"
      description="Hanya catatan, nama yang ditemui, dan hasil yang bisa diubah"
      size="lg"
    >
      <form onSubmit={kirim} className="space-y-4">
        <div>
          <label className={KELAS_LABEL} htmlFor="ubah-kegiatan-hasil">
            Hasil *
          </label>
          <select
            id="ubah-kegiatan-hasil"
            value={nilai.hasil}
            onChange={(event) =>
              ubahMedan({ hasil: event.target.value as KegiatanHasil })
            }
            className={`${KELAS_INPUT} cursor-pointer`}
          >
            {pilihanHasilUbah(kegiatan.hasil).map((hasil) => (
              <option key={hasil} value={hasil}>
                {KEGIATAN_HASIL_CONFIG[hasil].label}
              </option>
            ))}
          </select>
          <p className={KELAS_PETUNJUK}>
            Hasil hanya bisa diganti dalam kelompok yang sama (berminat atau
            belum). Untuk melintasinya, catat kegiatan baru.
          </p>
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="ubah-kegiatan-ditemui">
            Nama yang ditemui
          </label>
          <input
            id="ubah-kegiatan-ditemui"
            type="text"
            value={nilai.ditemuiNama}
            onChange={(event) => ubahMedan({ ditemuiNama: event.target.value })}
            maxLength={PANJANG_NAMA_MAKS}
            className={KELAS_INPUT}
          />
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="ubah-kegiatan-catatan">
            Catatan
          </label>
          <textarea
            id="ubah-kegiatan-catatan"
            rows={4}
            value={nilai.catatan}
            onChange={(event) => ubahMedan({ catatan: event.target.value })}
            maxLength={PANJANG_CATATAN_MAKS}
            className={KELAS_INPUT}
          />
        </div>

        {pesan && (
          <p role="alert" className={KELAS_PERINGATAN}>
            {pesan}
          </p>
        )}

        <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
          <Button type="button" variant="outline" onClick={tutup}>
            Batal
          </Button>
          <Button type="submit" loading={isMenyimpan}>
            Simpan Perubahan
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
