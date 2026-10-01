"use client";

import { HiOutlineFunnel, HiOutlineUser } from "react-icons/hi2";

import {
  RENCANA_STATUS_TAMPIL,
  type RencanaStatusTampil,
  type SalesPresurveiDto,
} from "@/modules/presurvei/client";

import { PemilihRentang } from "./PemilihRentang";
import type { FilterRencana } from "./rencanaQuery";
import { RENCANA_STATUS_TAMPIL_CONFIG } from "./tampilanRencana";

/** Nilai `<option>` yang berarti "tidak menyaring". */
const TANPA_SARING = "";

const KELAS_SELECT =
  "appearance-none cursor-pointer rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-8 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";
const KELAS_IKON =
  "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400";

interface RencanaFiltersProps {
  filter: FilterRencana;
  /**
   * Sales yang boleh dipilih; kosong bila pemakai tidak berhak menugasi —
   * pemilih sales lalu tidak ditampilkan.
   */
  salesTersedia: readonly SalesPresurveiDto[];
  onUbah: (perubahan: Partial<Omit<FilterRencana, "page">>) => void;
}

/** Rentang tanggal, sales, dan status daftar rencana. */
export function RencanaFilters({
  filter,
  salesTersedia,
  onUbah,
}: RencanaFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <PemilihRentang rentang={filter} onUbah={onUbah} labelAwalan="Rencana" />

      {salesTersedia.length > 0 && (
        <div className="relative">
          <HiOutlineUser className={KELAS_IKON} />
          <select
            value={filter.salesId}
            onChange={(event) => onUbah({ salesId: event.target.value })}
            aria-label="Filter sales"
            className={KELAS_SELECT}
          >
            <option value={TANPA_SARING}>Semua sales</option>
            {salesTersedia.map((sales) => (
              <option key={sales.id} value={sales.id}>
                {sales.nama}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative">
        <HiOutlineFunnel className={KELAS_IKON} />
        <select
          value={filter.status}
          onChange={(event) =>
            onUbah({ status: event.target.value as RencanaStatusTampil | "" })
          }
          aria-label="Filter status rencana"
          className={KELAS_SELECT}
        >
          <option value={TANPA_SARING}>Semua status</option>
          {RENCANA_STATUS_TAMPIL.map((status) => (
            <option key={status} value={status}>
              {RENCANA_STATUS_TAMPIL_CONFIG[status].label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
