"use client";

import { Fragment, useState } from "react";

import type { PenilaianSales } from "@/modules/presurvei/client";

import { Badge } from "../rencana/BadgeRencana";
import { DaftarBilahIndikator } from "./BilahIndikator";
import {
  anggotaTim,
  daftarIndikator,
  hitungPerPredikat,
  LABEL_INDIKATOR_SALES,
  PREDIKAT_CONFIG,
  tampilanPredikat,
  teksSkor,
  TAMPILAN_BELUM_TERUKUR,
  type FilterPredikat,
} from "./tampilanPenilaian";

const PILIHAN_FILTER: { nilai: FilterPredikat; label: string }[] = [
  { nilai: "SEMUA", label: "Semua" },
  { nilai: "SANGAT_BAIK", label: PREDIKAT_CONFIG.SANGAT_BAIK.label },
  { nilai: "BAIK", label: PREDIKAT_CONFIG.BAIK.label },
  { nilai: "CUKUP", label: PREDIKAT_CONFIG.CUKUP.label },
  { nilai: "PERLU_PEMBINAAN", label: PREDIKAT_CONFIG.PERLU_PEMBINAAN.label },
  { nilai: "BELUM_TERUKUR", label: TAMPILAN_BELUM_TERUKUR.label },
];

interface TabelAnggotaProps {
  sales: readonly PenilaianSales[];
  kepalaId: string;
  namaKepala: string;
}

/** Target "tercapai/target" satu metrik, atau "—" bila belum ada target. */
function teksCapaian(item: PenilaianSales, metrik: "kunjungan" | "prospek" | "konversi"): string {
  const baris = item.pencapaian?.[metrik];
  return baris ? `${baris.tercapai}/${baris.target}` : "—";
}

/** Tabel anggota tim seorang kepala sales: filter predikat, klik baris untuk rincian. */
export function TabelAnggota({ sales, kepalaId, namaKepala }: TabelAnggotaProps) {
  const [filter, setFilter] = useState<FilterPredikat>("SEMUA");
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const jumlah = hitungPerPredikat(sales, kepalaId);
  const daftar = anggotaTim(sales, kepalaId, filter);

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 p-4 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white">Tim {namaKepala}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {PILIHAN_FILTER.filter((opsi) => opsi.nilai === "SEMUA" || jumlah[opsi.nilai] > 0).map((opsi) => (
            <button
              key={opsi.nilai}
              type="button"
              onClick={() => setFilter(opsi.nilai)}
              className={`rounded-full px-3 py-1 text-xs ${
                filter === opsi.nilai
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
              }`}
            >
              {opsi.label} ({jumlah[opsi.nilai]})
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40">
            <tr>
              <th className="px-4 py-2">Sales</th>
              <th className="px-4 py-2">Skor</th>
              <th className="px-4 py-2">Kunjungan</th>
              <th className="px-4 py-2">Prospek</th>
              <th className="px-4 py-2">Konversi</th>
              <th className="px-4 py-2">Rencana (tepat / telat / terlewat)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {daftar.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Tidak ada anggota pada filter ini.
                </td>
              </tr>
            )}
            {daftar.map((item) => (
              <Fragment key={item.salesId}>
                <tr
                  onClick={() => setTerbuka(terbuka === item.salesId ? null : item.salesId)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900 dark:text-white">{item.nama}</div>
                    {item.pencapaian === null && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">Target belum ditetapkan</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className="mr-2 font-semibold">{teksSkor(item.skor)}</span>
                    <Badge tampilan={tampilanPredikat(item.predikat)} />
                  </td>
                  <td className="px-4 py-2">{teksCapaian(item, "kunjungan")}</td>
                  <td className="px-4 py-2">{teksCapaian(item, "prospek")}</td>
                  <td className="px-4 py-2">{teksCapaian(item, "konversi")}</td>
                  <td className="px-4 py-2">
                    <span className="text-emerald-600">{item.rencana.tepatWaktu}</span>
                    {" / "}
                    <span className="text-amber-600">{item.rencana.terlambat}</span>
                    {" / "}
                    <span className="text-red-600">{item.rencana.terlewat}</span>
                  </td>
                </tr>
                {terbuka === item.salesId && (
                  <tr>
                    <td colSpan={6} className="bg-gray-50 px-4 py-3 dark:bg-gray-900/40">
                      <div className="max-w-md">
                        <DaftarBilahIndikator daftar={daftarIndikator(item.indikator, LABEL_INDIKATOR_SALES)} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
