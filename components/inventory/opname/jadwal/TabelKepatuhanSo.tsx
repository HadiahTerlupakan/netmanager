"use client";

import Link from "next/link";
import { useState } from "react";

import {
  formatTanggalSo,
  keteranganJendelaSite,
  namaPengubahTerakhir,
  TAMPILAN_STATUS_SO,
  URUTAN_PRIORITAS_STATUS_SO,
  type KepatuhanGudang,
  type LaporanKepatuhanSo,
} from "./jadwalSoTypes";
import { ModalRiwayatSo } from "./ModalRiwayatSo";

const PENANDA_KOSONG = "—";

interface TabelKepatuhanSoProps {
  laporan: LaporanKepatuhanSo;
  /** Tampilkan tautan "Atur jadwal" ke halaman site. */
  canAturJadwal: boolean;
}

interface SelSoTerakhirProps {
  gudang: KepatuhanGudang;
  onBukaRiwayat: () => void;
}

/**
 * Tanggal SO terakhir dan nama orang yang terakhir mengubahnya.
 *
 * Namanya adalah tombol: pertanyaan yang menyusul "siapa yang mengubah" selalu
 * "apa yang ia ubah", dan jawabannya ada di jejak perubahan.
 */
function SelSoTerakhir({ gudang, onBukaRiwayat }: SelSoTerakhirProps) {
  if (!gudang.soTerakhir) return <>{PENANDA_KOSONG}</>;
  const nama = namaPengubahTerakhir(gudang.soTerakhir);

  return (
    <>
      {formatTanggalSo(gudang.soTerakhir.tanggal)}
      {nama && (
        <>
          {" · "}
          <button
            type="button"
            onClick={onBukaRiwayat}
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            title={`Lihat riwayat perubahan SO ${gudang.nama}`}
          >
            {nama}
          </button>
        </>
      )}
    </>
  );
}

/** Gudang per site beserta jadwal site & status SO bulan terpilih. */
export function TabelKepatuhanSo({
  laporan,
  canAturJadwal,
}: TabelKepatuhanSoProps) {
  const [gudangRiwayat, setGudangRiwayat] = useState<{
    id: string;
    nama: string;
  } | null>(null);

  if (laporan.site.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Tidak ada gudang aktif.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {URUTAN_PRIORITAS_STATUS_SO.map((status) => (
          <span
            key={status}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${TAMPILAN_STATUS_SO[status].kelas}`}
          >
            {TAMPILAN_STATUS_SO[status].label}:{" "}
            {laporan.jumlahPerStatus[status]}
          </span>
        ))}
      </div>
      {laporan.site.map((site) => (
        <div
          key={site.siteId ?? "tanpa-site"}
          className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
        >
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {site.namaSite}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {keteranganJendelaSite(site)}
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
                <th className="text-right px-5 py-2">
                  Barang dihitung (dalam jadwal)
                </th>
                <th className="text-left px-5 py-2">SO terakhir bulan ini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {site.gudang.map((gudang) => (
                <tr key={gudang.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {gudang.nama}
                    </div>
                    <div className="text-xs text-gray-500">{gudang.kode}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${TAMPILAN_STATUS_SO[gudang.status].kelas}`}
                    >
                      {TAMPILAN_STATUS_SO[gudang.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-200">
                    {gudang.jumlahDihitungDalamJadwal} /{" "}
                    {gudang.jumlahBarangBerstok}
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                    <SelSoTerakhir
                      gudang={gudang}
                      onBukaRiwayat={() =>
                        setGudangRiwayat({ id: gudang.id, nama: gudang.nama })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <ModalRiwayatSo
        gudang={gudangRiwayat}
        periode={laporan.periode}
        onClose={() => setGudangRiwayat(null)}
      />
    </div>
  );
}
