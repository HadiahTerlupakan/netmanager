"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { formatApiError } from "@/lib/utils/api-response-parser";
import {
  catatKegiatanSchema,
  isButuhIklan,
  isButuhLokasi,
  KEGIATAN_HASIL,
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS,
  KEGIATAN_JENIS_CONFIG,
  TOLERANSI_SKEW_JAM_MENIT,
  type KegiatanHasil,
  type KegiatanJenis,
} from "@/modules/presurvei/client";

import {
  keKesalahanForm,
  keMuatanKegiatan,
  KUNCI_DAFTAR_KEGIATAN,
  KUNCI_KESALAHAN_FORM,
  NILAI_FORM_KOSONG,
  URL_API_KEGIATAN,
  type KesalahanForm,
  type MuatanKegiatan,
  type NilaiFormKegiatan,
} from "./kegiatanFormState";

/**
 * Batas medan, mencerminkan `catatKegiatanSchema`
 * (`modules/presurvei/validators/kegiatan.validator.ts:18-22`). Konstanta
 * validator tidak diekspor, jadi angkanya ditulis ulang di sini — sama seperti
 * `IklanForm.tsx:34-35`. Tanpa batas ini pemakai baru tahu kelebihan panjang
 * setelah menekan Simpan.
 */
const PANJANG_NAMA_MAKS = 120;
const PANJANG_ALAMAT_MAKS = 500;
const PANJANG_CATATAN_MAKS = 1000;

const KELAS_INPUT =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const KELAS_LABEL =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const KELAS_KESALAHAN = "mt-1 text-xs text-red-600";
const KELAS_PETUNJUK = "mt-1 text-xs text-gray-500 dark:text-gray-400";

interface KegiatanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal pencatatan kegiatan presurvei dari web.
 *
 * **Sengaja tanpa medan foto dan tanpa penangkapan GPS.** Keduanya lahir dari
 * perangkat di lapangan; membangkitkannya dari kursi kantor menaruh penanda
 * palsu di peta kunjungan. Pembentuk muatannya
 * (`kegiatanFormState.ts:keMuatanKegiatan`) menjaga ketiadaan itu, dan ada test
 * yang memerahi penambahannya.
 *
 * **Sengaja tanpa medan data teknis survei.** Data teknis hanya diterima pada
 * survei lokasi, dan survei lokasi selalu ditolak dari web karena tak
 * berkoordinat — lihat `kegiatanFormState.ts:keMuatanKegiatan`.
 *
 * **Sengaja tanpa pemilih sales.** `app/api/presurvei/kegiatan/route.ts:57`
 * menimpa `userId` dengan identitas sesi, jadi kegiatan selalu tercatat atas
 * nama pencatatnya sendiri. Pemilih sales hanya akan membohongi pemakai
 * tentang apa yang tersimpan — ini penjaga keamanan Fase 1, bukan medan yang
 * terlupa.
 */
export function KegiatanFormModal({ isOpen, onClose }: KegiatanFormModalProps) {
  const queryClient = useQueryClient();
  const [nilai, setNilai] = useState<NilaiFormKegiatan>(NILAI_FORM_KOSONG);
  const [kesalahan, setKesalahan] = useState<KesalahanForm>({});
  const [isMenyimpan, setIsMenyimpan] = useState(false);

  const ubahMedan = (perubahan: Partial<NilaiFormKegiatan>) => {
    setNilai((lama) => ({ ...lama, ...perubahan }));
    // Kesalahan medan yang baru disunting dihapus supaya teks merahnya tidak
    // bertahan setelah pemakai memperbaikinya; medan lain tetap ditandai.
    setKesalahan((lama) => {
      const berikutnya = { ...lama };
      for (const kunci of Object.keys(
        perubahan,
      ) as (keyof NilaiFormKegiatan)[]) {
        delete berikutnya[kunci];
      }
      // Pesan level-form lahir dari aturan lintas-medan — mengubah `jenis`
      // bisa membuatnya tidak berlaku lagi, jadi ia ikut dibuang.
      delete berikutnya[KUNCI_KESALAHAN_FORM];
      return berikutnya;
    });
  };

  const simpan = async (muatan: MuatanKegiatan) => {
    setIsMenyimpan(true);
    try {
      const respons = await fetch(URL_API_KEGIATAN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(muatan),
      });
      const badan = await respons.json();

      if (!respons.ok) {
        toast.error(formatApiError(badan, "Gagal mencatat kegiatan"));
        return;
      }

      toast.success("Kegiatan berhasil dicatat");

      // Query di-cache 30 detik (`staleTime` di `session-provider.tsx`). Tanpa
      // invalidasi, pemakai menutup modal dan tidak menemukan kegiatan yang
      // baru saja dicatatnya — lalu mencatatnya sekali lagi.
      queryClient.invalidateQueries({ queryKey: [KUNCI_DAFTAR_KEGIATAN] });

      // Direset hanya setelah tersimpan. Menutup modal tanpa menyimpan
      // mempertahankan isian, supaya klik di luar kotak tidak membuang isian
      // yang belum sempat dikirim.
      setNilai(NILAI_FORM_KOSONG);
      setKesalahan({});
      onClose();
    } catch {
      toast.error("Gagal mencatat kegiatan");
    } finally {
      setIsMenyimpan(false);
    }
  };

  const kirim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Muatan dibentuk sekali lalu dipakai ulang: yang divalidasi wajib persis
    // yang dikirim. Dua ekspresi terpisah bisa menyimpang tanpa ditolak `tsc`.
    const muatan = keMuatanKegiatan(nilai);
    const hasil = catatKegiatanSchema.safeParse(muatan);

    if (!hasil.success) {
      setKesalahan(keKesalahanForm(hasil.error.issues));
      return;
    }

    setKesalahan({});
    void simpan(muatan);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Catat Kegiatan"
      description="Kegiatan tercatat atas nama Anda sendiri"
      size="2xl"
    >
      <form onSubmit={kirim} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={KELAS_LABEL} htmlFor="kegiatan-jenis">
              Jenis kegiatan *
            </label>
            <select
              id="kegiatan-jenis"
              value={nilai.jenis}
              onChange={(event) =>
                ubahMedan({ jenis: event.target.value as KegiatanJenis })
              }
              className={`${KELAS_INPUT} cursor-pointer`}
            >
              {KEGIATAN_JENIS.map((jenis) => (
                <option key={jenis} value={jenis}>
                  {KEGIATAN_JENIS_CONFIG[jenis].label}
                </option>
              ))}
            </select>
            {kesalahan.jenis && (
              <p className={KELAS_KESALAHAN}>{kesalahan.jenis}</p>
            )}
          </div>

          <div>
            <label className={KELAS_LABEL} htmlFor="kegiatan-hasil">
              Hasil *
            </label>
            <select
              id="kegiatan-hasil"
              value={nilai.hasil}
              onChange={(event) =>
                ubahMedan({ hasil: event.target.value as KegiatanHasil })
              }
              className={`${KELAS_INPUT} cursor-pointer`}
            >
              {KEGIATAN_HASIL.map((hasil) => (
                <option key={hasil} value={hasil}>
                  {KEGIATAN_HASIL_CONFIG[hasil].label}
                </option>
              ))}
            </select>
            {kesalahan.hasil && (
              <p className={KELAS_KESALAHAN}>{kesalahan.hasil}</p>
            )}
          </div>
        </div>

        {/*
          Peringatan, bukan penghalang — tapi kalimatnya menyebut penolakan
          karena itulah yang benar-benar terjadi. Refine pertama
          `catatKegiatanSchema`
          (`modules/presurvei/validators/kegiatan.validator.ts:92-97`) menolak
          kunjungan dan survei lokasi yang tanpa koordinat, jadi jenis ini tidak
          sekadar "tersimpan tanpa titik di peta": ia tidak tersimpan sama
          sekali. Form tetap memakai schema yang sama, sehingga penolakannya
          muncul di sini tanpa perjalanan ke server.
        */}
        {isButuhLokasi(nilai.jenis) && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            Kegiatan jenis ini wajib menyertakan titik lokasi, sedangkan halaman
            web tidak menangkap GPS — pencatatannya akan ditolak. Catat dari
            aplikasi mobile.
          </p>
        )}

        <div>
          <label className={KELAS_LABEL} htmlFor="kegiatan-waktu-mulai">
            Waktu mulai *
          </label>
          <input
            id="kegiatan-waktu-mulai"
            type="datetime-local"
            value={nilai.waktuMulai}
            onChange={(event) => ubahMedan({ waktuMulai: event.target.value })}
            className={KELAS_INPUT}
          />
          {kesalahan.waktuMulai && (
            <p className={KELAS_KESALAHAN}>{kesalahan.waktuMulai}</p>
          )}
          <p className={KELAS_PETUNJUK}>
            Memakai jam di perangkat Anda, dan tidak boleh lebih dari{" "}
            {TOLERANSI_SKEW_JAM_MENIT} menit di masa depan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={KELAS_LABEL} htmlFor="kegiatan-ditemui">
              Nama yang ditemui
            </label>
            <input
              id="kegiatan-ditemui"
              type="text"
              value={nilai.ditemuiNama}
              onChange={(event) =>
                ubahMedan({ ditemuiNama: event.target.value })
              }
              maxLength={PANJANG_NAMA_MAKS}
              placeholder="Contoh: Budi"
              className={KELAS_INPUT}
            />
            {kesalahan.ditemuiNama && (
              <p className={KELAS_KESALAHAN}>{kesalahan.ditemuiNama}</p>
            )}
          </div>

          <div>
            <label className={KELAS_LABEL} htmlFor="kegiatan-alamat">
              Alamat
            </label>
            <input
              id="kegiatan-alamat"
              type="text"
              value={nilai.alamatDikunjungi}
              onChange={(event) =>
                ubahMedan({ alamatDikunjungi: event.target.value })
              }
              maxLength={PANJANG_ALAMAT_MAKS}
              placeholder="Alamat calon pelanggan"
              className={KELAS_INPUT}
            />
            {kesalahan.alamatDikunjungi && (
              <p className={KELAS_KESALAHAN}>{kesalahan.alamatDikunjungi}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={KELAS_LABEL} htmlFor="kegiatan-iklan">
              ID kampanye iklan {isButuhIklan(nilai.jenis) ? "*" : ""}
            </label>
            <input
              id="kegiatan-iklan"
              type="text"
              value={nilai.iklanId}
              onChange={(event) => ubahMedan({ iklanId: event.target.value })}
              placeholder="Salin dari daftar kampanye"
              className={KELAS_INPUT}
            />
            {kesalahan.iklanId && (
              <p className={KELAS_KESALAHAN}>{kesalahan.iklanId}</p>
            )}
            <p className={KELAS_PETUNJUK}>
              {isButuhIklan(nilai.jenis)
                ? "Wajib untuk kegiatan iklan."
                : "Opsional; isi bila kegiatan ini buntut dari sebuah kampanye."}
            </p>
          </div>

          <div>
            <label className={KELAS_LABEL} htmlFor="kegiatan-prospek">
              ID prospek terkait
            </label>
            <input
              id="kegiatan-prospek"
              type="text"
              value={nilai.prospekId}
              onChange={(event) => ubahMedan({ prospekId: event.target.value })}
              placeholder="Salin dari daftar prospek"
              className={KELAS_INPUT}
            />
            {kesalahan.prospekId && (
              <p className={KELAS_KESALAHAN}>{kesalahan.prospekId}</p>
            )}
            <p className={KELAS_PETUNJUK}>
              Opsional; kosongkan bila kegiatan ini belum menempel ke prospek.
            </p>
          </div>
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="kegiatan-catatan">
            Catatan
          </label>
          <textarea
            id="kegiatan-catatan"
            rows={3}
            value={nilai.catatan}
            onChange={(event) => ubahMedan({ catatan: event.target.value })}
            maxLength={PANJANG_CATATAN_MAKS}
            placeholder="Ringkasan percakapan atau tindak lanjut yang dijanjikan"
            className={KELAS_INPUT}
          />
          {kesalahan.catatan && (
            <p className={KELAS_KESALAHAN}>{kesalahan.catatan}</p>
          )}
        </div>

        {/* Pesan yang tidak menempel ke satu medan pun — ketiga `.refine()`
            schema berpath kosong, dan medan seperti `latitude` tidak punya
            slot pesannya sendiri di form ini. Tanpa tempat ini form menolak
            submit tanpa memberi tahu apa yang salah. */}
        {kesalahan[KUNCI_KESALAHAN_FORM] && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
          >
            {kesalahan[KUNCI_KESALAHAN_FORM]}
          </p>
        )}

        <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={isMenyimpan}>
            Catat Kegiatan
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
