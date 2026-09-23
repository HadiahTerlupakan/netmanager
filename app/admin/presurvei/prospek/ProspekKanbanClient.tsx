"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { usePermission } from "@/hooks/use-permission";
import {
  daftarKolomHidup,
  daftarKolomMati,
  PROSPEK_STATUS_CONFIG,
  type ProspekStatus,
} from "@/modules/presurvei/client";

import { PESAN_KONVERSI_BELUM_TERSEDIA } from "./pindahProspek";
import { ProspekCard } from "./ProspekCard";
import {
  keadaanKolom,
  teksJumlahKolom,
  type KeadaanKolom,
} from "./prospekKolomQuery";
import { usePindahProspek } from "./usePindahProspek";
import { useProspekKolom } from "./useProspekKolom";
import {
  isKartuDapatDiseret,
  useSeretProspek,
  type KartuDiangkat,
  type TampilanKolomSeret,
} from "./useSeretProspek";

/** Jumlah kerangka kartu yang mengisi kolom selama halaman pertamanya dimuat. */
const JUMLAH_KERANGKA_KARTU = 3;

/** Label sakelar kolom mati; juga dipakai test sebagai selektor. */
export const LABEL_SAKELAR_KOLOM_MATI = "Tampilkan prospek yang gugur";

/** Pesan badan kolom yang halaman pertamanya gagal dimuat. */
export const TEKS_KOLOM_GAGAL = "Kolom ini gagal dimuat";

/** Pesan badan kolom yang memang tidak punya prospek. */
export const TEKS_KOLOM_KOSONG = "Belum ada prospek di tahap ini";

/** Pesan kecil saat kartu sudah ada tetapi halaman berikutnya gagal. */
const TEKS_SEBAGIAN_GAGAL = "Sebagian kartu gagal dimuat";

/**
 * Permission yang boleh memindahkan kartu; dicocokkan ke gerbang
 * `PATCH /api/presurvei/prospek/[id]` (`app/api/presurvei/prospek/[id]/route.ts:40`),
 * bukan dipilih. Halaman sendiri hanya menuntut `read` (`page.tsx:13`).
 */
const IZIN_UBAH_PROSPEK = ["presurvei:update", "m_presurvei:update"];

/** Id toast jatuhan ke DEAL, supaya jatuhan berulang tidak menumpuk. */
const ID_TOAST_KONVERSI = "presurvei-prospek-konversi";

/** Kelas bingkai kolom per rupa seret. */
const KELAS_KOLOM_SERET: Record<TampilanKolomSeret, string> = {
  netral: "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50",
  tujuan:
    "border-indigo-400 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/30",
  redup:
    "border-gray-200 bg-gray-50 opacity-40 dark:border-gray-700 dark:bg-gray-800/50",
};

type ProspekKolomData = ReturnType<typeof useProspekKolom>;

/** Kabel seret yang diteruskan papan ke setiap kolom. */
interface SeretKolom {
  tampilanKolom: (status: ProspekStatus) => TampilanKolomSeret;
  isBolehUbah: boolean;
  mulaiSeret: (kartu: KartuDiangkat) => void;
  selesaiSeret: () => void;
  jatuhkan: (status: ProspekStatus) => void;
  isSedangDipindah: (prospekId: string) => boolean;
}

/** Badan kolom sesuai keadaannya; kartu hanya dirender saat `berisi`. */
function BadanKolom({
  status,
  keadaan,
  kartu,
  seret,
}: {
  status: ProspekStatus;
  keadaan: KeadaanKolom;
  kartu: ProspekKolomData["kartu"];
  seret: SeretKolom;
}) {
  switch (keadaan) {
    case "memuat":
      return (
        <>
          {Array.from({ length: JUMLAH_KERANGKA_KARTU }, (_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </>
      );
    case "gagal":
      return (
        <p role="alert" className="px-3 py-8 text-center text-xs text-red-600">
          {TEKS_KOLOM_GAGAL}
        </p>
      );
    case "kosong":
      return (
        <p className="px-3 py-8 text-center text-xs text-gray-400">
          {TEKS_KOLOM_KOSONG}
        </p>
      );
    case "berisi":
      return (
        <>
          {kartu.map((prospek) => (
            <ProspekCard
              key={prospek.id}
              prospek={prospek}
              isDapatDiseret={isKartuDapatDiseret(status, seret.isBolehUbah)}
              isSedangDipindah={seret.isSedangDipindah(prospek.id)}
              onMulaiSeret={() =>
                seret.mulaiSeret({ id: prospek.id, dari: status })
              }
              onSelesaiSeret={seret.selesaiSeret}
            />
          ))}
        </>
      );
  }
}

/**
 * Tombol kaki kolom: satu jalan untuk memuat lebih maupun mencoba lagi.
 *
 * Bila ada halaman yang gagal, `muatLebih` mengambil ulang halaman itu alih-
 * alih maju (`useProspekKolom`), jadi labelnya ikut berganti.
 */
function TombolKakiKolom({ kolom }: { kolom: ProspekKolomData }) {
  const isAdaGagal = kolom.halamanGagal !== null;
  if (kolom.isLoading || (!isAdaGagal && !kolom.adaLagi)) return null;

  return (
    <>
      {isAdaGagal && kolom.kartu.length > 0 && (
        <p role="alert" className="text-center text-xs text-red-600">
          {TEKS_SEBAGIAN_GAGAL}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        loading={kolom.isMemuatLebih}
        disabled={kolom.isMemuatLebih}
        onClick={kolom.muatLebih}
      >
        {isAdaGagal ? "Coba lagi" : "Muat lebih"}
      </Button>
    </>
  );
}

/**
 * Satu kolom papan: mengambil datanya sendiri dan memuat lebih sendiri.
 *
 * Kolom yang bukan tujuan sah tidak memanggil `preventDefault()` pada
 * `dragover`, jadi tidak menyatakan diri bisa dijatuhi — mekanisme yang sama
 * dengan `app/admin/planning/PlanningKanbanClient.tsx:168-172`. `jatuhkan`
 * tetap memeriksa ulang keputusannya bila `drop` sampai juga.
 */
function ProspekKolom({
  status,
  seret,
}: {
  status: ProspekStatus;
  seret: SeretKolom;
}) {
  const kolom = useProspekKolom(status);
  const tampilan = PROSPEK_STATUS_CONFIG[status];
  const tampilanSeret = seret.tampilanKolom(status);
  const keadaan = keadaanKolom({
    isLoading: kolom.isLoading,
    halamanGagal: kolom.halamanGagal,
    jumlahKartu: kolom.kartu.length,
  });
  // Tanpa meta, "0 dari 0" di kolom yang gagal akan berbohong.
  const isJumlahDiketahui = keadaan === "kosong" || keadaan === "berisi";

  return (
    <section
      aria-label={tampilan.label}
      data-status={status}
      data-seret={tampilanSeret}
      onDragOver={(event) => {
        if (tampilanSeret !== "tujuan") return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        seret.jatuhkan(status);
      }}
      className={`flex max-h-[calc(100vh-240px)] w-72 flex-shrink-0 flex-col rounded-xl border transition-colors ${KELAS_KOLOM_SERET[tampilanSeret]}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2.5 dark:border-gray-700">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tampilan.warna}`}
        >
          {tampilan.label}
        </span>
        {isJumlahDiketahui && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {teksJumlahKolom(kolom.kartu.length, kolom.total)}
          </span>
        )}
      </header>

      <div className="min-h-32 flex-1 space-y-2 overflow-y-auto p-2">
        <BadanKolom
          status={status}
          keadaan={keadaan}
          kartu={kolom.kartu}
          seret={seret}
        />
        <TombolKakiKolom kolom={kolom} />
      </div>
    </section>
  );
}

/**
 * Papan prospek: satu kolom per status corong.
 *
 * Kolom mati (`TIDAK_MINAT`, `TIDAK_LAYAK`) disembunyikan di balik sakelar:
 * keduanya tumbuh tanpa batas dan menenggelamkan corong kerja. Kolom yang
 * tidak dirender tidak memasang hook-nya, jadi sakelar yang mati juga berarti
 * dua permintaan lebih sedikit.
 *
 * Tidak ada skeleton yang menggantikan seluruh papan. Kerangka dirender di
 * dalam tiap kolom, supaya kontrol di atas papan tetap terpasang selama kolom
 * memuat — akibat sebaliknya tercatat di
 * `app/admin/planning/PlanningKanbanClient.tsx:45-52`.
 *
 * Kartu diseret antar kolom dengan HTML5 drag-drop native, hanya ke kolom
 * yang sah menurut `resolveAksiKanban`. Jatuhan ke DEAL belum memindahkan
 * status: formulir konversinya belum ada, jadi pemakai diberi tahu alih-alih
 * dibiarkan menebak.
 */
export function ProspekKanbanClient() {
  const [isKolomMatiTampil, setIsKolomMatiTampil] = useState(false);
  const { hasAnyPermission } = usePermission();
  const pindah = usePindahProspek();
  const seret = useSeretProspek({
    onUbahStatus: (perpindahan) => void pindah.pindahkan(perpindahan),
    onBukaKonversi: () =>
      toast(PESAN_KONVERSI_BELUM_TERSEDIA, { id: ID_TOAST_KONVERSI }),
  });
  const seretKolom: SeretKolom = {
    tampilanKolom: seret.tampilanKolom,
    isBolehUbah: hasAnyPermission(IZIN_UBAH_PROSPEK),
    mulaiSeret: seret.mulaiSeret,
    selesaiSeret: seret.selesaiSeret,
    jatuhkan: seret.jatuhkan,
    isSedangDipindah: pindah.isSedangDipindah,
  };

  const kolom = isKolomMatiTampil
    ? [...daftarKolomHidup(), ...daftarKolomMati()]
    : daftarKolomHidup();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Papan Prospek
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Calon pelanggan yang sedang digarap tim sales, per tahap corong
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={isKolomMatiTampil}
            onChange={(event) => setIsKolomMatiTampil(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          {LABEL_SAKELAR_KOLOM_MATI}
        </label>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {kolom.map((status) => (
          <ProspekKolom key={status} status={status} seret={seretKolom} />
        ))}
      </div>
    </div>
  );
}
