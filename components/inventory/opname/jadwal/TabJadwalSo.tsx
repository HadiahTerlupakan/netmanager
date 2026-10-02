"use client";

import { useState } from "react";

import { usePermission } from "@/hooks/use-permission";
import { PanelJadwalSo } from "./PanelJadwalSo";
import { TabelKepatuhanSo } from "./TabelKepatuhanSo";
import { periodeSekarang } from "./jadwalSoTypes";
import { useJadwalSo } from "./useJadwalSo";

/**
 * Tab "Jadwal & Kepatuhan": jadwal SO per bulan (bisa diubah khusus tiap
 * bulan) dan gudang per site yang sudah/belum di-SO di bulan itu.
 */
export function TabJadwalSo({ periodeAwal }: { periodeAwal?: string | null }) {
  const { hasPermission } = usePermission();
  const [periode, setPeriode] = useState(periodeAwal || periodeSekarang());
  const so = useJadwalSo(periode);

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
        Bulan
        <input
          type="month"
          value={periode}
          onChange={(e) => e.target.value && setPeriode(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </label>

      {so.isMemuat || !so.jadwal ? (
        <p className="text-sm text-gray-500">Memuat…</p>
      ) : (
        <>
          <PanelJadwalSo
            jadwal={so.jadwal}
            keadaan={so.kepatuhan?.keadaan}
            canManage={hasPermission("opname:manage")}
            isMenyimpan={so.isMenyimpan}
            onSimpanKhusus={(isian) => void so.simpanJadwalKhusus(isian)}
            onPakaiBawaan={() => void so.pakaiAturanBawaan()}
            onSimpanAturan={(aturan) => void so.simpanAturan(aturan)}
          />
          {so.kepatuhan && <TabelKepatuhanSo laporan={so.kepatuhan} />}
        </>
      )}
    </div>
  );
}
