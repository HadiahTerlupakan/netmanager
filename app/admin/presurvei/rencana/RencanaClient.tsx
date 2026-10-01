"use client";

import { useState } from "react";
import { HiOutlinePlus } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { usePermission } from "@/hooks/use-permission";
import { PERMISSIONS } from "@/lib/permissions";

import { PenugasanFormModal } from "./PenugasanFormModal";
import { RekapRencanaPanel } from "./RekapRencanaPanel";
import { RencanaDetailModal } from "./RencanaDetailModal";
import { RencanaFilters } from "./RencanaFilters";
import {
  HALAMAN_PERTAMA,
  TAB_RENCANA_LABEL,
  URUTAN_TAB_RENCANA,
  type TabRencana,
} from "./rencanaQuery";
import { RencanaTable } from "./RencanaTable";
import { useRencanaListQuery } from "./useRencanaListQuery";
import {
  useSalesTersediaQuery,
  type KeadaanSalesTersedia,
} from "./useSalesTersediaQuery";

const KELAS_TAB_AKTIF = "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500";
const KELAS_TAB_DIAM =
  "text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white";

/** Tab daftar: filter, tabel berhalaman, dan modal rincian baris terpilih. */
function DaftarRencanaPanel({
  canUbah,
  salesTersedia,
}: {
  canUbah: boolean;
  /** Kosong bila pemakai tidak berhak menugasi (`useSalesTersediaQuery`). */
  salesTersedia: KeadaanSalesTersedia["daftar"];
}) {
  const { filter, ubahFilter, ubahHalaman, baris, meta, isLoading, isError } =
    useRencanaListQuery();
  const [rencanaTerpilihId, setRencanaTerpilihId] = useState<string | null>(
    null,
  );

  return (
    <div className="space-y-4">
      <RencanaFilters
        filter={filter}
        salesTersedia={salesTersedia}
        onUbah={ubahFilter}
      />
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <RencanaTable
          baris={baris}
          isLoading={isLoading}
          isError={isError}
          page={filter.page}
          totalPages={meta?.totalPages ?? HALAMAN_PERTAMA}
          onPageChange={ubahHalaman}
          onPilih={(rencana) => setRencanaTerpilihId(rencana.id)}
        />
      </div>
      {rencanaTerpilihId !== null && (
        <RencanaDetailModal
          rencanaId={rencanaTerpilihId}
          canUbah={canUbah}
          onClose={() => setRencanaTerpilihId(null)}
        />
      )}
    </div>
  );
}

/** Layar rencana kunjungan & penugasan: tab daftar dan rekap. */
export function RencanaClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission(
    PERMISSIONS.MARKETING.PRESURVEI_RENCANA.CREATE,
  );
  const canUbah = hasPermission(PERMISSIONS.MARKETING.PRESURVEI_RENCANA.UPDATE);
  const salesTersedia = useSalesTersediaQuery(canCreate);

  const [tabAktif, setTabAktif] = useState<TabRencana>("daftar");
  const [isPenugasanTerbuka, setIsPenugasanTerbuka] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Rencana & Penugasan
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Agenda kunjungan sales dan realisasinya
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsPenugasanTerbuka(true)}>
            <HiOutlinePlus className="h-4 w-4" />
            Buat Penugasan
          </Button>
        )}
      </div>

      <div
        role="tablist"
        aria-label="Tampilan rencana"
        className="inline-flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-700"
      >
        {URUTAN_TAB_RENCANA.map((tab) => (
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
            {TAB_RENCANA_LABEL[tab]}
          </button>
        ))}
      </div>

      {/* Kedua panel tetap terpasang dan hanya disembunyikan, supaya filter
          dan rentang masing-masing tidak kembali ke awal saat berpindah tab. */}
      <div hidden={tabAktif !== "daftar"}>
        <DaftarRencanaPanel
          canUbah={canUbah}
          salesTersedia={salesTersedia.daftar}
        />
      </div>
      <div hidden={tabAktif !== "rekap"}>
        <RekapRencanaPanel />
      </div>

      {/* Dirender hanya saat terbuka, supaya isian lahir ulang tiap dibuka. */}
      {isPenugasanTerbuka && (
        <PenugasanFormModal
          salesTersedia={salesTersedia}
          onClose={() => setIsPenugasanTerbuka(false)}
        />
      )}
    </div>
  );
}
