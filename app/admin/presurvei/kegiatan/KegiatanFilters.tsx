"use client";

import type { ChangeEvent } from "react";
import { HiOutlineFunnel, HiOutlineUser } from "react-icons/hi2";

import {
  KEGIATAN_HASIL,
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS,
  KEGIATAN_JENIS_CONFIG,
  type KegiatanHasil,
  type KegiatanJenis,
} from "@/modules/presurvei/client";

import { batasRentangTanggal, type FilterKegiatan } from "./kegiatanListQuery";

/** Nilai `<option>` yang berarti "tidak menyaring". */
const TANPA_SARING = "";

const KELAS_SELECT =
  "appearance-none cursor-pointer rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-8 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

const KELAS_TANGGAL =
  "rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

interface KegiatanFiltersProps {
  filter: FilterKegiatan;
  /** Id sales yang boleh dipilih; lihat `opsiSales` untuk asal-usulnya. */
  idSalesTersedia: string[];
  onUbah: (perubahan: Partial<Omit<FilterKegiatan, "page">>) => void;
}

/** Pemilih sales, jenis, hasil, dan rentang tanggal daftar kegiatan. */
export function KegiatanFilters({
  filter,
  idSalesTersedia,
  onUbah,
}: KegiatanFiltersProps) {
  const ubahSales = (event: ChangeEvent<HTMLSelectElement>) =>
    onUbah({ userId: event.target.value });

  const ubahJenis = (event: ChangeEvent<HTMLSelectElement>) =>
    onUbah({ jenis: event.target.value as KegiatanJenis | "" });

  const ubahHasil = (event: ChangeEvent<HTMLSelectElement>) =>
    onUbah({ hasil: event.target.value as KegiatanHasil | "" });

  const ubahDariTanggal = (event: ChangeEvent<HTMLInputElement>) =>
    onUbah({ dariTanggal: event.target.value });

  const ubahSampaiTanggal = (event: ChangeEvent<HTMLInputElement>) =>
    onUbah({ sampaiTanggal: event.target.value });

  // Kedua medan saling membatasi supaya rentang terbalik tidak bisa dibentuk
  // lewat widget-nya. Aturannya fungsi murni di `kegiatanListQuery.ts`; di sini
  // tersisa pemasangannya, dan nama medan menyebut atribut tujuannya supaya
  // tertukarnya terbaca salah.
  const batas = batasRentangTanggal(filter);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <div className="relative">
        <HiOutlineUser className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          value={filter.userId}
          onChange={ubahSales}
          aria-label="Filter sales"
          className={KELAS_SELECT}
        >
          <option value={TANPA_SARING}>Semua sales</option>
          {idSalesTersedia.map((idSales) => (
            <option key={idSales} value={idSales}>
              {idSales}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          value={filter.jenis}
          onChange={ubahJenis}
          aria-label="Filter jenis kegiatan"
          className={KELAS_SELECT}
        >
          <option value={TANPA_SARING}>Semua jenis</option>
          {KEGIATAN_JENIS.map((jenis) => (
            <option key={jenis} value={jenis}>
              {KEGIATAN_JENIS_CONFIG[jenis].label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          value={filter.hasil}
          onChange={ubahHasil}
          aria-label="Filter hasil kegiatan"
          className={KELAS_SELECT}
        >
          <option value={TANPA_SARING}>Semua hasil</option>
          {KEGIATAN_HASIL.map((hasil) => (
            <option key={hasil} value={hasil}>
              {KEGIATAN_HASIL_CONFIG[hasil].label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={filter.dariTanggal}
          onChange={ubahDariTanggal}
          max={batas.maksDariTanggal}
          aria-label="Kegiatan sejak tanggal"
          className={KELAS_TANGGAL}
        />
        <span className="text-sm text-gray-500 dark:text-gray-400">s/d</span>
        <input
          type="date"
          value={filter.sampaiTanggal}
          onChange={ubahSampaiTanggal}
          min={batas.minSampaiTanggal}
          aria-label="Kegiatan sampai tanggal"
          className={KELAS_TANGGAL}
        />
      </div>
    </div>
  );
}
