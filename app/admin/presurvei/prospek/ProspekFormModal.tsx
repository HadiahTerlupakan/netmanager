"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";
import {
  isSumberButuhIklan,
  isSumberButuhReferral,
  PROSPEK_STATUS_CONFIG,
  PROSPEK_SUMBER,
  PROSPEK_SUMBER_CONFIG,
  type IklanListItemDto,
  type ProspekDetailDto,
  type ProspekSumber,
} from "@/modules/presurvei/client";

import { TEKS_TAK_BERTUAN } from "./ProspekCard";
import { buildUbahProspekUrl } from "./pindahProspek";
import {
  IZIN_BACA_KAMPANYE,
  keKesalahanForm,
  keNilaiForm,
  KUNCI_KESALAHAN_FORM,
  muatanUntukMode,
  NILAI_FORM_KOSONG,
  pilihanKampanye,
  schemaUntukMode,
  URL_PILIHAN_KAMPANYE,
  type KesalahanForm,
  type ModeFormProspek,
  type NilaiFormProspek,
} from "./prospekFormState";
import { isTakBertuan } from "./prospekKolomQuery";
import { useSimpanProspek, type DuplikatTertunda } from "./useSimpanProspek";

/**
 * Batas medan, mencerminkan `buatProspekSchema`
 * (`modules/presurvei/validators/prospek.validator.ts:18-24`). Konstanta
 * validator tidak diekspor, jadi angkanya ditulis ulang di sini — sama seperti
 * `../kegiatan/KegiatanFormModal.tsx`.
 */
const PANJANG_NAMA_MAKS = 120;
const PANJANG_TELP_MAKS = 20;
const PANJANG_ALAMAT_MAKS = 500;
const PANJANG_CATATAN_MAKS = 1000;

/**
 * Pemberitahuan kepemilikan pada mode buat.
 *
 * Form tidak mengirim `pemilikId` (`prospekFormState.ts:keMuatanBuatProspek`),
 * dan `tentukanPemilikProspek` (`app/api/presurvei/akses-presurvei.ts:41-48`)
 * lalu memakai id pemanggil — untuk pemegang permission web lewat
 * `pemilikDiminta ?? idPemanggil`, untuk yang lain tanpa syarat. Penugasan ke
 * sales menunggu sumber nama sales (Task 20).
 */
export const TEKS_PEMILIK_PROSPEK_BARU =
  "Prospek ini akan tercatat atas nama Anda. Penugasan ke sales belum bisa dilakukan dari halaman ini.";

const KELAS_INPUT =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const KELAS_LABEL =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300";
const KELAS_KESALAHAN = "mt-1 text-xs text-red-600";
const KELAS_PETUNJUK = "mt-1 text-xs text-gray-500 dark:text-gray-400";

/** Pesan kesalahan satu medan, bila ada. */
function PesanMedan({ pesan }: { pesan: string | undefined }) {
  return pesan ? <p className={KELAS_KESALAHAN}>{pesan}</p> : null;
}

interface PemilihKampanyeProps {
  iklanId: string;
  onUbah: (iklanId: string) => void;
  kesalahan: string | undefined;
}

/**
 * Pemilih kampanye yang sedang berjalan.
 *
 * Daftar kampanye dijaga `presurvei_iklan:read`, permission yang berbeda dari
 * gerbang pembuatan prospek. Pemakai tanpanya, atau yang daftarnya gagal
 * dimuat, tetap bisa menyalin ID kampanye secara manual — seperti form
 * kegiatan — alih-alih terhalang membuat prospek dari iklan.
 */
function PemilihKampanye({ iklanId, onUbah, kesalahan }: PemilihKampanyeProps) {
  const { hasAnyPermission } = usePermission();
  const isBolehBacaKampanye = hasAnyPermission(IZIN_BACA_KAMPANYE);
  const daftar = useApi<IklanListItemDto[]>(
    isBolehBacaKampanye ? URL_PILIHAN_KAMPANYE : null,
  );
  const isPakaiIsianManual = !isBolehBacaKampanye || daftar.error !== null;
  const pilihan = pilihanKampanye(daftar.data ?? []);

  return (
    <div>
      <label className={KELAS_LABEL} htmlFor="prospek-iklan">
        Kampanye iklan *
      </label>
      {isPakaiIsianManual ? (
        <input
          id="prospek-iklan"
          type="text"
          value={iklanId}
          onChange={(event) => onUbah(event.target.value)}
          placeholder="Salin ID dari daftar kampanye"
          className={KELAS_INPUT}
        />
      ) : (
        <select
          id="prospek-iklan"
          value={iklanId}
          onChange={(event) => onUbah(event.target.value)}
          disabled={daftar.isLoading}
          className={`${KELAS_INPUT} cursor-pointer`}
        >
          <option value="">
            {daftar.isLoading ? "Memuat kampanye…" : "Pilih kampanye"}
          </option>
          {pilihan.map((iklan) => (
            <option key={iklan.id} value={iklan.id}>
              {iklan.nama} ({iklan.kode})
            </option>
          ))}
        </select>
      )}
      <PesanMedan pesan={kesalahan} />
      <p className={KELAS_PETUNJUK}>
        {isPakaiIsianManual
          ? "Daftar kampanye tidak bisa dimuat untuk akun Anda; isi ID kampanye secara manual."
          : "Hanya kampanye yang sedang berjalan yang ditampilkan."}
      </p>
    </div>
  );
}

interface PanelDuplikatProps {
  duplikat: DuplikatTertunda;
  isMenyimpan: boolean;
  onTetapSimpan: () => void;
  onBatal: () => void;
}

/**
 * Prospek aktif yang bentrok nomor teleponnya, dengan pilihan tetap menyimpan.
 *
 * Dua orang memang bisa berbagi nomor (`ProspekService.buat`), jadi keputusan
 * akhirnya milik pemakai, bukan tebakan sistem.
 */
function PanelDuplikat({
  duplikat,
  isMenyimpan,
  onTetapSimpan,
  onBatal,
}: PanelDuplikatProps) {
  return (
    <div
      role="alert"
      className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <p className="font-medium">
        Sudah ada prospek aktif dengan nomor telepon ini:
      </p>
      <ul className="space-y-1">
        {duplikat.bentrok.map((prospek) => (
          <li key={prospek.id} data-prospek-bentrok={prospek.id}>
            <span className="font-medium">{prospek.nama}</span> —{" "}
            {PROSPEK_STATUS_CONFIG[prospek.status]?.label ?? prospek.status} —{" "}
            {isTakBertuan(prospek)
              ? TEKS_TAK_BERTUAN
              : `pemilik ${prospek.pemilikId}`}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          loading={isMenyimpan}
          onClick={onTetapSimpan}
        >
          Tetap simpan
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onBatal}>
          Periksa lagi
        </Button>
      </div>
    </div>
  );
}

interface IsiFormProspekProps {
  mode: ModeFormProspek;
  nilaiAwal: NilaiFormProspek;
  onClose: () => void;
}

/** Medan form dan pengirimannya; dipasang setelah nilai awalnya tersedia. */
function IsiFormProspek({ mode, nilaiAwal, onClose }: IsiFormProspekProps) {
  const [nilai, setNilai] = useState<NilaiFormProspek>(nilaiAwal);
  const [kesalahan, setKesalahan] = useState<KesalahanForm>({});
  const { simpan, tetapSimpan, lupakanDuplikat, duplikat, isMenyimpan } =
    useSimpanProspek(mode, onClose);
  const isModeBuat = mode.jenis === "buat";

  const ubahMedan = (perubahan: Partial<NilaiFormProspek>) => {
    setNilai((lama) => ({ ...lama, ...perubahan }));
    // Penolakan duplikat berlaku untuk isian yang ditolak, bukan isian yang
    // sudah diubah; "Tetap simpan" tidak boleh mengirim isian lama.
    lupakanDuplikat();
    setKesalahan((lama) => {
      const berikutnya = { ...lama };
      for (const kunci of Object.keys(
        perubahan,
      ) as (keyof NilaiFormProspek)[]) {
        delete berikutnya[kunci];
      }
      delete berikutnya[KUNCI_KESALAHAN_FORM];
      return berikutnya;
    });
  };

  const kirim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Yang divalidasi wajib persis yang dikirim.
    const muatan = muatanUntukMode(mode, nilai);
    const hasil = schemaUntukMode(mode).safeParse(muatan);

    if (!hasil.success) {
      setKesalahan(keKesalahanForm(hasil.error.issues));
      return;
    }

    setKesalahan({});
    void simpan(muatan);
  };

  return (
    <form onSubmit={kirim} className="space-y-4">
      {isModeBuat && (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          {TEKS_PEMILIK_PROSPEK_BARU}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={KELAS_LABEL} htmlFor="prospek-nama">
            Nama *
          </label>
          <input
            id="prospek-nama"
            type="text"
            value={nilai.nama}
            onChange={(event) => ubahMedan({ nama: event.target.value })}
            maxLength={PANJANG_NAMA_MAKS}
            className={KELAS_INPUT}
          />
          <PesanMedan pesan={kesalahan.nama} />
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="prospek-telp">
            Nomor telepon *
          </label>
          <input
            id="prospek-telp"
            type="tel"
            value={nilai.noTelp}
            onChange={(event) => ubahMedan({ noTelp: event.target.value })}
            maxLength={PANJANG_TELP_MAKS}
            placeholder="08xxxxxxxxxx"
            className={KELAS_INPUT}
          />
          <PesanMedan pesan={kesalahan.noTelp} />
        </div>
      </div>

      <div>
        <label className={KELAS_LABEL} htmlFor="prospek-alamat">
          Alamat *
        </label>
        <input
          id="prospek-alamat"
          type="text"
          value={nilai.alamat}
          onChange={(event) => ubahMedan({ alamat: event.target.value })}
          maxLength={PANJANG_ALAMAT_MAKS}
          className={KELAS_INPUT}
        />
        <PesanMedan pesan={kesalahan.alamat} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={KELAS_LABEL} htmlFor="prospek-email">
            Email
          </label>
          <input
            id="prospek-email"
            type="email"
            value={nilai.email}
            onChange={(event) => ubahMedan({ email: event.target.value })}
            className={KELAS_INPUT}
          />
          <PesanMedan pesan={kesalahan.email} />
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="prospek-paket">
            Paket diminati
          </label>
          <input
            id="prospek-paket"
            type="text"
            value={nilai.paketDiminati}
            onChange={(event) =>
              ubahMedan({ paketDiminati: event.target.value })
            }
            maxLength={PANJANG_NAMA_MAKS}
            className={KELAS_INPUT}
          />
          <PesanMedan pesan={kesalahan.paketDiminati} />
        </div>
      </div>

      {isModeBuat ? (
        <div>
          <label className={KELAS_LABEL} htmlFor="prospek-sumber">
            Sumber *
          </label>
          <select
            id="prospek-sumber"
            value={nilai.sumber}
            onChange={(event) =>
              ubahMedan({ sumber: event.target.value as ProspekSumber })
            }
            className={`${KELAS_INPUT} cursor-pointer`}
          >
            {PROSPEK_SUMBER.map((sumber) => (
              <option key={sumber} value={sumber}>
                {PROSPEK_SUMBER_CONFIG[sumber].label}
              </option>
            ))}
          </select>
          <PesanMedan pesan={kesalahan.sumber} />
        </div>
      ) : (
        // `ubahProspekSchema` tidak menerima sumber maupun atribusinya
        // (`prospekFormState.ts:keMuatanUbahProspek`), jadi pada mode ubah
        // ia hanya ditampilkan, bukan medan yang bisa disunting.
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Sumber:{" "}
          <span className="font-medium">
            {PROSPEK_SUMBER_CONFIG[nilai.sumber].label}
          </span>{" "}
          — tidak bisa diubah setelah prospek tercatat.
        </p>
      )}

      {isModeBuat && isSumberButuhIklan(nilai.sumber) && (
        <PemilihKampanye
          iklanId={nilai.iklanId}
          onUbah={(iklanId) => ubahMedan({ iklanId })}
          kesalahan={kesalahan.iklanId}
        />
      )}

      {isModeBuat && isSumberButuhReferral(nilai.sumber) && (
        <div>
          <label className={KELAS_LABEL} htmlFor="prospek-referral">
            Nama perujuk *
          </label>
          <input
            id="prospek-referral"
            type="text"
            value={nilai.referralNama}
            onChange={(event) =>
              ubahMedan({ referralNama: event.target.value })
            }
            maxLength={PANJANG_NAMA_MAKS}
            className={KELAS_INPUT}
          />
          <PesanMedan pesan={kesalahan.referralNama} />
        </div>
      )}

      <div>
        <label className={KELAS_LABEL} htmlFor="prospek-catatan">
          Catatan
        </label>
        <textarea
          id="prospek-catatan"
          rows={3}
          value={nilai.catatan}
          onChange={(event) => ubahMedan({ catatan: event.target.value })}
          maxLength={PANJANG_CATATAN_MAKS}
          className={KELAS_INPUT}
        />
        <PesanMedan pesan={kesalahan.catatan} />
      </div>

      {/* Refine `buatProspekSchema` berpath kosong; tanpa tempat ini form
          menolak submit tanpa memberi tahu apa yang salah. */}
      {kesalahan[KUNCI_KESALAHAN_FORM] && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          {kesalahan[KUNCI_KESALAHAN_FORM]}
        </p>
      )}

      {duplikat !== null && (
        <PanelDuplikat
          duplikat={duplikat}
          isMenyimpan={isMenyimpan}
          onTetapSimpan={tetapSimpan}
          onBatal={lupakanDuplikat}
        />
      )}

      <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
        <Button type="button" variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button
          type="submit"
          loading={isMenyimpan}
          disabled={duplikat !== null}
        >
          {isModeBuat ? "Catat Prospek" : "Simpan Perubahan"}
        </Button>
      </ModalFooter>
    </form>
  );
}

/** Isi modal mode ubah: menunggu rincian prospek sebelum memasang form. */
function FormUbahProspek({
  mode,
  onClose,
}: {
  mode: Extract<ModeFormProspek, { jenis: "ubah" }>;
  onClose: () => void;
}) {
  // Kartu papan hanya membawa `ProspekListItemDto`; email, catatan, dan
  // atribusi hanya ada di rincian.
  const rincian = useApi<ProspekDetailDto>(buildUbahProspekUrl(mode.prospekId));

  if (rincian.error !== null) {
    return (
      <p role="alert" className="py-6 text-center text-sm text-red-600">
        Rincian prospek gagal dimuat.
      </p>
    );
  }

  if (rincian.data === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <IsiFormProspek
      mode={mode}
      nilaiAwal={keNilaiForm(rincian.data)}
      onClose={onClose}
    />
  );
}

interface ProspekFormModalProps {
  mode: ModeFormProspek;
  onClose: () => void;
}

/**
 * Modal buat dan ubah prospek dari web.
 *
 * Modal, bukan halaman: menavigasi keluar dari papan lalu kembali memutus
 * konteks dan menghilangkan posisi guliran tiap kolom.
 *
 * Dipasang hanya selama terbuka (lihat `ProspekKanbanClient`), jadi isian
 * yang belum disimpan hilang saat modal ditutup.
 *
 * **Sengaja tanpa pemilih sales.** Nama sales belum tersedia di modul ini
 * (Task 20); lihat `TEKS_PEMILIK_PROSPEK_BARU`.
 */
export function ProspekFormModal({ mode, onClose }: ProspekFormModalProps) {
  const isModeBuat = mode.jenis === "buat";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isModeBuat ? "Tambah Prospek" : "Ubah Prospek"}
      size="2xl"
    >
      {mode.jenis === "ubah" ? (
        <FormUbahProspek mode={mode} onClose={onClose} />
      ) : (
        <IsiFormProspek
          mode={mode}
          nilaiAwal={NILAI_FORM_KOSONG}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
