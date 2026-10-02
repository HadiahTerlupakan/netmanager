"use client";

import Link from "next/link";

import {
  formatTanggalSo,
  LABEL_KEADAAN,
  labelJendela,
  TAMPILAN_STATUS_SO,
  type LaporanKepatuhanSo,
  type StatusSoGudang,
} from "./jadwalSoTypes";

const URUTAN_STATUS: StatusSoGudang[] = ["BELUM", "DI_LUAR_JADWAL", "SEBAGIAN", "LENGKAP", "TANPA_STOK"];

interface TabelKepatuhanSoProps {
  laporan: LaporanKepatuhanSo;
  /** Tampilkan tautan "Atur jadwal" ke halaman site. */
  canAturJadwal: boolean;
}

/** Gudang per site beserta jadwal site & status SO bulan terpilih. */
export function TabelKepatuhanSo({ laporan, canAturJadwal }: TabelKepatuhanSoProps) {
  if (laporan.site.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada gudang aktif.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {URUTAN_STATUS.map((status) => (
          <span key={status} className={`px-3 py-1 rounded-full text-xs font-semibold ${TAMPILAN_STATUS_SO[status].kelas}`}>
            {TAMPILAN_STATUS_SO[status].label}: {laporan.jumlahPerStatus[status]}
          </span>
        ))}
      </div>
      {laporan.site.map((site) => (
        <div key={site.siteId ?? "tanpa-site"} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">{site.namaSite}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {labelJendela(site.jendela)} · {LABEL_KEADAAN[site.keadaan]}
                {site.siteId && !site.isPengingatAktif ? " · Pengingat mati" : ""}
              </div>
            </div>
            {canAturJadwal && site.siteId && (
              <Link
                href={`/admin/workorders/sites/${site.siteId}#jadwal-so`}
                className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                Atur jadwal
              </Link>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-500 dark:text-gray-400 uppercase">
              <tr>
                <th className="text-left px-5 py-2">Gudang</th>
                <th className="text-left px-5 py-2">Status</th>
                <th className="text-right px-5 py-2">Barang dihitung (dalam jadwal)</th>
                <th className="text-left px-5 py-2">SO terakhir bulan ini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {site.gudang.map((gudang) => (
                <tr key={gudang.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{gudang.nama}</div>
                    <div className="text-xs text-gray-500">{gudang.kode}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${TAMPILAN_STATUS_SO[gudang.status].kelas}`}>
                      {TAMPILAN_STATUS_SO[gudang.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-200">
                    {gudang.jumlahDihitungDalamJadwal} / {gudang.jumlahBarangBerstok}
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                    {gudang.soTerakhir
                      ? `${formatTanggalSo(gudang.soTerakhir.tanggal)}${gudang.soTerakhir.pic ? ` · ${gudang.soTerakhir.pic}` : ""}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
