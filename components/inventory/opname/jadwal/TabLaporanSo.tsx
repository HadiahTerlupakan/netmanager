"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { MonthSelect } from "@/components/ui/MonthSelect";
import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";
import { TabelKepatuhanSo } from "./TabelKepatuhanSo";
import { periodeSekarang, type LaporanKepatuhanSo } from "./jadwalSoTypes";
import { unduhLaporanSoPdf } from "./laporanSoPdf";

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
  const [isMengunduh, setIsMengunduh] = useState(false);

  const unduhPdf = async () => {
    if (!data) return;
    setIsMengunduh(true);
    try {
      await unduhLaporanSoPdf(data);
    } catch {
      toast.error("Gagal membuat PDF laporan SO");
    } finally {
      setIsMengunduh(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
          Periode
          <MonthSelect
            value={periode}
            onChange={setPeriode}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Jadwal SO diatur per site di menu Site.
          </p>
          <button
            type="button"
            onClick={unduhPdf}
            disabled={!data || isLoading || isMengunduh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isMengunduh ? "Menyiapkan…" : "Unduh PDF"}
          </button>
        </div>
      </div>
      {isLoading || !data ? (
        <p className="text-sm text-gray-500">Memuat…</p>
      ) : (
        <TabelKepatuhanSo laporan={data} canAturJadwal={hasPermission("site:update")} />
      )}
    </div>
  );
}
