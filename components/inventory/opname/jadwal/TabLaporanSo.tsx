"use client";

import { useState } from "react";

import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";
import { TabelKepatuhanSo } from "./TabelKepatuhanSo";
import { periodeSekarang, type LaporanKepatuhanSo } from "./jadwalSoTypes";

/**
 * Tab "Laporan SO Bulanan": per site, jadwal yang berlaku dan gudang yang
 * sudah/belum di-SO. Jadwal diatur di halaman masing-masing site.
 */
export function TabLaporanSo({ periodeAwal }: { periodeAwal?: string | null }) {
  const { hasPermission } = usePermission();
  const [periode, setPeriode] = useState(periodeAwal || periodeSekarang());
  const { data, isLoading } = useApi<LaporanKepatuhanSo>(
    `/api/inventory/opname/kepatuhan?periode=${periode}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
          Bulan
          <input
            type="month"
            value={periode}
            onChange={(e) => e.target.value && setPeriode(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Jadwal SO diatur per site di menu Site.
        </p>
      </div>
      {isLoading || !data ? (
        <p className="text-sm text-gray-500">Memuat…</p>
      ) : (
        <TabelKepatuhanSo laporan={data} canAturJadwal={hasPermission("site:update")} />
      )}
    </div>
  );
}
