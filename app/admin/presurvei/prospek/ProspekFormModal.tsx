"use client";

import { useState, type FormEvent, type ReactNode } from "react";

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
  type ProspekDetailDto,
  type ProspekSumber,
} from "@/modules/presurvei/client";

import { isCakupanTenantPresurvei } from "../ringkasanDashboard";
import {
  useKeadaanDaftarSalesPresurvei,
  type StatusDaftarSales,
} from "../useDaftarSalesPresurvei";
import { TEKS_TAK_BERTUAN } from "./ProspekCard";
import { buildUbahProspekUrl } from "./pindahProspek";
import {
  IZIN_BACA_KAMPANYE,
  keKesalahanForm,
  keNilaiForm,
  KUNCI_KESALAHAN_FORM,
  muatanUntukMode,
  NILAI_FORM_KOSONG,
  opsiPemilikUntukMode,
  schemaUntukMode,
  tentukanKetersediaanPemilih,
  type KesalahanForm,
  type ModeFormProspek,
  type NilaiFormProspek,
} from "./prospekFormState";
import { isTakBertuan } from "./prospekKolomQuery";
import { useKampanyeBerjalan } from "./useKampanyeBerjalan";
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
 * Pemberitahuan kepemilikan pada mode buat, untuk pemakai yang tidak boleh
 * menugaskan pemilik.
 *
 * Tanpa pemilih pemilik, form tidak mengirim `pemilikId`, dan
 * `tentukanPemilikProspek` (`app/api/presurvei/akses-presurvei.ts`) memakai id
 * pemanggil — untuk pemanggil tanpa permission web tanpa syarat.
 */
export const TEKS_PEMILIK_PROSPEK_BARU =
  "Prospek ini akan tercatat atas nama Anda.";

/**
 * Petunjuk mode buat bagi super admin tanpa tenant sesi
 * (`tentukanKetersediaanPemilih`): server memakai id pembuat bila
 * `pemilikId` tidak dikirim.
 */
const TEKS_PEMILIH_TANPA_TENANT_SESI =
  "Tanpa tenant sesi, pemilik tidak bisa ditugaskan saat membuat prospek; prospek tercatat atas nama Anda.";

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

/** Alasan pemilih kampanye jatuh ke isian ID manual; null bila memakai daftar. */
function alasanIsianManual(
  isBolehBacaKampanye: boolean,
  kampanye: ReturnType<typeof useKampanyeBerjalan>,
): string | null {
  if (!isBolehBacaKampanye || kampanye.isGagal) {
    return "Daftar kampanye tidak bisa dimuat untuk akun Anda; isi ID kampanye secara manual.";
  }
  if (kampanye.ringkasan?.isTerpotong === true) {
    return TEKS_KAMPANYE_TERPOTONG;
  }
  return null;
}

/**
 * Petunjuk saat daftar kampanye aktif lebih panjang dari yang dikirim server
 * (`prospekFormState.ts:ringkasPilihanKampanye`). Daftar yang tidak lengkap
 * tidak ditampilkan sebagai pilihan sama sekali: kampanye yang dicari bisa
 * jadi yang terpotong, dan pemilih yang tampak lengkap menyembunyikannya.
 */
export const TEKS_KAMPANYE_TERPOTONG =
  "Kampanye aktif terlalu banyak untuk ditampilkan semuanya; isi ID kampanye langsung dari daftar kampanye.";

/**
 * Pemilih kampanye yang sedang berjalan.
 *
 * Daftar kampanye dijaga `presurvei_iklan:read`, permission yang berbeda dari
 * gerbang pembuatan prospek. Pemakai tanpanya, yang daftarnya gagal dimuat,
 * atau yang daftarnya terpotong tetap bisa mengisi ID kampanye secara manual —
 * seperti form kegiatan — alih-alih terhalang membuat prospek dari iklan.
 */
function PemilihKampanye({ iklanId, onUbah, kesalahan }: PemilihKampanyeProps) {
  const { hasAnyPermission } = usePermission();
  const isBolehBacaKampanye = hasAnyPermission(IZIN_BACA_KAMPANYE);
  const kampanye = useKampanyeBerjalan(isBolehBacaKampanye);
  const alasanManual = alasanIsianManual(isBolehBacaKampanye, kampanye);
  const pilihan = kampanye.ringkasan?.pilihan ?? [];

  return (
    <div>
      <label className={KELAS_LABEL} htmlFor="prospek-iklan">
        Kampanye iklan *
      </label>
      {alasanManual !== null ? (
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
          disabled={kampanye.isLoading}
          className={`${KELAS_INPUT} cursor-pointer`}
        >
          <option value="">
            {kampanye.isLoading ? "Memuat kampanye…" : "Pilih kampanye"}
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
        {alasanManual ??
          "Hanya kampanye yang sedang berjalan yang ditampilkan."}
      </p>
    </div>
  );
}

/** Petunjuk di bawah pemilih pemilik menurut keadaan daftar sales. */
const PETUNJUK_DAFTAR_SALES: Record<StatusDaftarSales, string> = {
  memuat: "Memuat daftar sales…",
  gagal:
    "Daftar sales gagal dimuat; pemilik tidak bisa diganti sekarang, tetapi perubahan lain tetap bisa disimpan.",
  siap: "Hanya sales aktif yang bisa dipilih.",
  "tanpa-tenant": "Prospek ini tidak bertenant; pemilik tidak bisa ditugaskan.",
};

/** Keadaan daftar yang petunjuknya ditampilkan sebagai peringatan. */
const STATUS_PETUNJUK_PERINGATAN: ReadonlySet<StatusDaftarSales> = new Set([
  "gagal",
  "tanpa-tenant",
]);

interface PemilihPemilikProps {
  mode: ModeFormProspek;
  /** `pemilikId` nilai awal form; kosong pada mode buat. */
  pemilikAwal: string;
  pemilikId: string;
  onUbah: (pemilikId: string) => void;
  kesalahan: string | undefined;
}

/**
 * Pemilih pemilik prospek — opsional, hanya dipasang untuk pemakai yang boleh
 * menugaskan, sehingga daftar sales tidak pernah diminta oleh yang lain.
 *
 * Daftar yang belum tiba atau gagal mengunci pilihan pada nilai awalnya:
 * medan ini opsional, jadi form tetap bisa disimpan tanpa mengubah pemilik.
 */
function PemilihPemilik({
  mode,
  pemilikAwal,
  pemilikId,
  onUbah,
  kesalahan,
}: PemilihPemilikProps) {
  // Mode ubah: tenant diturunkan server dari prospeknya, bukan dari sesi —
  // super admin bisa membuka prospek tenant lain.
  const keadaan = useKeadaanDaftarSalesPresurvei(
    mode.jenis === "ubah" ? mode.prospekId : undefined,
  );
  const opsi = opsiPemilikUntukMode(mode, pemilikAwal, keadaan.daftar);

  return (
    <div>
      <label className={KELAS_LABEL} htmlFor="prospek-pemilik">
        Pemilik
      </label>
      <select
        id="prospek-pemilik"
        value={pemilikId}
        onChange={(event) => onUbah(event.target.value)}
        disabled={keadaan.status !== "siap"}
        className={`${KELAS_INPUT} cursor-pointer`}
      >
        {opsi.map((pilihan) => (
          <option key={pilihan.nilai} value={pilihan.nilai}>
            {pilihan.label}
          </option>
        ))}
      </select>
      <PesanMedan pesan={kesalahan} />
      <p
        className={
          STATUS_PETUNJUK_PERINGATAN.has(keadaan.status)
            ? KELAS_KESALAHAN
            : KELAS_PETUNJUK
        }
      >
        {PETUNJUK_DAFTAR_SALES[keadaan.status]}
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

interface KerangkaModalProps {
  mode: ModeFormProspek;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Bingkai modal yang sama untuk form, kerangka muat, dan pesan gagal. */
function KerangkaModal({
  mode,
  isOpen,
  onClose,
  children,
}: KerangkaModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode.jenis === "buat" ? "Tambah Prospek" : "Ubah Prospek"}
      size="2xl"
    >
      {children}
    </Modal>
  );
}

interface FormProspekProps {
  mode: ModeFormProspek;
  nilaiAwal: NilaiFormProspek;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Form beserta state-nya, dengan modal di DALAM komponen ini.
 *
 * State sengaja tinggal di atas `<Modal>`: modal yang tertutup merender null
 * (`components/ui/Modal.tsx:54`), sehingga state di dalamnya ikut hilang. Di
 * sini isian bertahan selama komponen ini terpasang, dan direset hanya
 * setelah simpan berhasil.
 */
function FormProspek({ mode, nilaiAwal, isOpen, onClose }: FormProspekProps) {
  const [nilai, setNilai] = useState<NilaiFormProspek>(nilaiAwal);
  const [kesalahan, setKesalahan] = useState<KesalahanForm>({});
  const setelahTersimpan = () => {
    setNilai(nilaiAwal);
    setKesalahan({});
    onClose();
  };
  // Penolakan server atas pemilik yang dipilih tampil di medannya sendiri;
  // mengganti pilihan membuangnya lewat `ubahMedan`.
  const tampilkanPenolakanPemilik = (pesan: string) =>
    setKesalahan((lama) => ({ ...lama, pemilikId: pesan }));
  const { simpan, tetapSimpan, lupakanDuplikat, duplikat, isMenyimpan } =
    useSimpanProspek(mode, setelahTersimpan, tampilkanPenolakanPemilik);
  const { hasPermission, isSuperAdmin, user } = usePermission();
  const isBolehTugaskanPemilik = isCakupanTenantPresurvei(hasPermission);
  const ketersediaanPemilih = tentukanKetersediaanPemilih(mode, {
    isSuperAdmin,
    tenantId: (user as { tenantId?: string | null } | undefined)?.tenantId,
  });
  const isModeBuat = mode.jenis === "buat";

  const ubahMedan = (perubahan: Partial<NilaiFormProspek>) => {
    setNilai((lama) => ({ ...lama, ...perubahan }));
    // Penolakan duplikat berlaku untuk isian yang ditolak. Medan dikunci
    // selama permintaan berjalan (`<fieldset disabled>` di bawah), jadi isian
    // tidak bisa berubah antara pengiriman dan tibanya penolakan; perubahan
    // sesudahnya membuang penolakan, sehingga "Tetap simpan" hanya pernah
    // mengirim isian yang memang ditolak.
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
    const muatan = muatanUntukMode(mode, nilai, nilaiAwal.pemilikId);
    const hasil = schemaUntukMode(mode).safeParse(muatan);

    if (!hasil.success) {
      setKesalahan(keKesalahanForm(hasil.error.issues));
      return;
    }

    setKesalahan({});
    void simpan(muatan);
  };

  return (
    <KerangkaModal mode={mode} isOpen={isOpen} onClose={onClose}>
      <form onSubmit={kirim}>
        <fieldset disabled={isMenyimpan} className="min-w-0 space-y-4">
          {isModeBuat && !isBolehTugaskanPemilik && (
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

          {isBolehTugaskanPemilik &&
            ketersediaanPemilih === "tanpa-tenant-sesi" && (
              <p className={KELAS_PETUNJUK}>{TEKS_PEMILIH_TANPA_TENANT_SESI}</p>
            )}

          {isBolehTugaskanPemilik && ketersediaanPemilih === "tersedia" && (
            <PemilihPemilik
              mode={mode}
              pemilikAwal={nilaiAwal.pemilikId}
              pemilikId={nilai.pemilikId}
              onUbah={(pemilikId) => ubahMedan({ pemilikId })}
              kesalahan={kesalahan.pemilikId}
            />
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
        </fieldset>

        <ModalFooter className="-mx-5 -mb-5 mt-6 sm:-mx-6 sm:-mb-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          {/* Selama panel duplikat tampil, keputusannya lewat panel itu:
            simpan biasa hanya akan ditolak 409 lagi. */}
          <Button
            type="submit"
            loading={isMenyimpan}
            disabled={duplikat !== null}
          >
            {isModeBuat ? "Catat Prospek" : "Simpan Perubahan"}
          </Button>
        </ModalFooter>
      </form>
    </KerangkaModal>
  );
}

/** Modal mode ubah: menunggu rincian prospek sebelum memasang form. */
function FormUbahProspek({
  mode,
  isOpen,
  onClose,
}: {
  mode: Extract<ModeFormProspek, { jenis: "ubah" }>;
  isOpen: boolean;
  onClose: () => void;
}) {
  // Kartu papan hanya membawa `ProspekListItemDto`; email, catatan, dan
  // atribusi hanya ada di rincian.
  const rincian = useApi<ProspekDetailDto>(buildUbahProspekUrl(mode.prospekId));

  if (rincian.error !== null) {
    return (
      <KerangkaModal mode={mode} isOpen={isOpen} onClose={onClose}>
        <p role="alert" className="py-6 text-center text-sm text-red-600">
          Rincian prospek gagal dimuat.
        </p>
      </KerangkaModal>
    );
  }

  if (rincian.data === undefined) {
    return (
      <KerangkaModal mode={mode} isOpen={isOpen} onClose={onClose}>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </KerangkaModal>
    );
  }

  return (
    <FormProspek
      mode={mode}
      nilaiAwal={keNilaiForm(rincian.data)}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}

interface ProspekFormModalProps {
  mode: ModeFormProspek;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal buat dan ubah prospek dari web.
 *
 * Modal, bukan halaman: menavigasi keluar dari papan lalu kembali memutus
 * konteks dan menghilangkan posisi guliran tiap kolom.
 *
 * Isian bertahan selama komponen ini terpasang, termasuk saat modal ditutup
 * lewat overlay atau Escape; ia direset hanya setelah simpan berhasil.
 * `ProspekKanbanClient` membiarkan modal buat tetap terpasang dan memasang
 * modal ubah per prospek.
 *
 * Pemilih pemilik hanya untuk pemakai bercakupan tenant
 * (`isCakupanTenantPresurvei`, definisi yang sama dengan dashboard); yang lain
 * melihat `TEKS_PEMILIK_PROSPEK_BARU` pada mode buat.
 */
export function ProspekFormModal({
  mode,
  isOpen,
  onClose,
}: ProspekFormModalProps) {
  if (mode.jenis === "ubah") {
    return <FormUbahProspek mode={mode} isOpen={isOpen} onClose={onClose} />;
  }

  return (
    <FormProspek
      mode={mode}
      nilaiAwal={NILAI_FORM_KOSONG}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}
