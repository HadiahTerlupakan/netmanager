"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { HiOutlinePlus } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/LoadingSkeleton";
import { usePermission } from "@/hooks/use-permission";

import { KegiatanFilters } from "./KegiatanFilters";
import { KegiatanFormModal } from "./KegiatanFormModal";
import { KegiatanTable } from "./KegiatanTable";
import {
  HALAMAN_PERTAMA,
  TAB_KEGIATAN_LABEL,
  URUTAN_TAB,
  type TabKegiatan,
} from "./kegiatanListQuery";
import { jumlahDiLuarBatas, keTitikPeta } from "./titikPeta";
import { useKegiatanListQuery } from "./useKegiatanListQuery";

/**
 * Peta dimuat tanpa SSR: OpenLayers menyentuh `window` saat modulnya dimuat,
 * dan render di server gagal dengan `window is not defined`. Pola yang sama
 * dipakai `app/admin/kehadiran/live-map/LiveMapClient.tsx:24`.
 */
const KegiatanPeta = dynamic(() => import("./KegiatanPeta"), {
  ssr: false,
  loading: () => <Skeleton className="m-4 h-[480px] w-auto" />,
});

/** Tab yang terbuka saat halaman dimuat. */
const TAB_AWAL: TabKegiatan = "daftar";

/**
 * Izin yang membuka tombol catat kegiatan.
 *
 * Dicocokkan ke gerbang `POST /api/presurvei/kegiatan`
 * (`app/api/presurvei/kegiatan/route.ts:51`), bukan dipilih — sama seperti
 * alasan yang sudah ditulis di `page.tsx:9-11` untuk gerbang baca. Tombol yang
 * lebih longgar dari endpoint-nya menyodorkan form yang pasti berakhir 403.
 */
const IZIN_CATAT_KEGIATAN = ["presurvei:create", "m_presurvei:create"];

const KELAS_TAB_AKTIF = "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500";
const KELAS_TAB_DIAM =
  "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";

/** Shell layar kegiatan sales: judul, filter bersama, dan sakelar tab. */
export function KegiatanClient() {
  const [tabAktif, setTabAktif] = useState<TabKegiatan>(TAB_AWAL);
  const [isModalTerbuka, setIsModalTerbuka] = useState(false);
  const isTabPeta = tabAktif === "peta";

  const { hasAnyPermission } = usePermission();
  const canCreate = hasAnyPermission(IZIN_CATAT_KEGIATAN);

  const {
    filter,
    ubahFilter,
    ubahHalaman,
    baris,
    salesTersedia,
    meta,
    isLoading,
  } = useKegiatanListQuery({ untukPeta: isTabPeta });

  const totalPages = meta?.totalPages ?? HALAMAN_PERTAMA;

  // Dimemo bukan demi kecepatan pemetaannya — seratus baris murah — tapi demi
  // reference-nya: `titik` yang baru tiap render membuat effect penggambar
  // penanda di `KegiatanPeta` membangun ulang seluruh lapisan setiap kali
  // apa pun di layar ini berubah.
  const petaKegiatan = useMemo(() => keTitikPeta(baris), [baris]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Kegiatan Sales
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kunjungan, survei lokasi, dan kontak yang dicatat tim di lapangan
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsModalTerbuka(true)}>
            <HiOutlinePlus className="h-4 w-4" />
            Catat kegiatan
          </Button>
        )}
      </div>

      {/*
        Filter berada di luar panel tab supaya daftar dan peta selalu menyaring
        himpunan yang sama, dan supaya `isLoading` — yang hanya diteruskan ke
        tabel — tidak pernah melepas medan filter dari DOM. Skeleton yang
        menggantikan seluruh halaman membuat medan ter-unmount tiap perubahan;
        akibatnya tercatat di `app/admin/planning/PlanningKanbanClient.tsx:45-52`.
      */}
      <KegiatanFilters
        filter={filter}
        salesTersedia={salesTersedia}
        onUbah={ubahFilter}
      />

      <div
        role="tablist"
        aria-label="Tampilan kegiatan"
        className="inline-flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-700"
      >
        {URUTAN_TAB.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={tab === tabAktif}
            onClick={() => setTabAktif(tab)}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === tabAktif ? KELAS_TAB_AKTIF : KELAS_TAB_DIAM
            }`}
          >
            {TAB_KEGIATAN_LABEL[tab]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {isTabPeta ? (
          <KegiatanPeta
            titik={petaKegiatan.titik}
            tanpaKoordinat={petaKegiatan.tanpaKoordinat}
            diLuarBatas={jumlahDiLuarBatas({
              totalCocok: meta?.total,
              jumlahTerambil: baris.length,
            })}
          />
        ) : (
          <KegiatanTable
            baris={baris}
            isLoading={isLoading}
            page={filter.page}
            totalPages={totalPages}
            onPageChange={ubahHalaman}
          />
        )}
      </div>

      <KegiatanFormModal
        isOpen={isModalTerbuka}
        onClose={() => setIsModalTerbuka(false)}
      />
    </div>
  );
}
