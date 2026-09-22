"use client";

import type { ChangeEvent } from "react";
import { HiOutlineFunnel, HiOutlineMagnifyingGlass } from "react-icons/hi2";

import {
  IKLAN_CHANNEL_CONFIG,
  IKLAN_CHANNELS,
  type IklanChannel,
} from "@/modules/presurvei/client";

import {
  kunciStatusDari,
  STATUS_PILIHAN,
  URUTAN_STATUS,
  type FilterIklan,
  type KunciStatus,
} from "./iklanListQuery";

/** Nilai `<option>` yang berarti "tidak menyaring channel". */
const CHANNEL_SEMUA = "";

/**
 * Batas panjang kotak pencarian.
 *
 * Mencerminkan `search: z.string().max(120)` pada `daftarIklanSchema`
 * (`modules/presurvei/validators/iklan.validator.ts`). Angkanya ditulis ulang
 * di sini karena konstanta validator tidak diekspor; tanpa batas ini, teks
 * yang lebih panjang ditolak Zod dengan 400 dan pemakai melihat toast
 * "Gagal memuat daftar iklan", bukan "tidak ada hasil".
 */
const PANJANG_PENCARIAN_MAKS = 120;

const KELAS_SELECT =
  "appearance-none cursor-pointer rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-8 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

interface IklanFiltersProps {
  filter: FilterIklan;
  onUbah: (perubahan: Partial<Omit<FilterIklan, "page">>) => void;
}

/** Kotak pencarian, pemilih channel, dan pemilih status daftar kampanye. */
export function IklanFilters({ filter, onUbah }: IklanFiltersProps) {
  const ubahPencarian = (event: ChangeEvent<HTMLInputElement>) =>
    onUbah({ search: event.target.value });

  const ubahChannel = (event: ChangeEvent<HTMLSelectElement>) =>
    onUbah({ channel: event.target.value as IklanChannel | "" });

  const ubahStatus = (event: ChangeEvent<HTMLSelectElement>) =>
    onUbah({
      isAktif: STATUS_PILIHAN[event.target.value as KunciStatus].isAktif,
    });

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={filter.search}
          onChange={ubahPencarian}
          maxLength={PANJANG_PENCARIAN_MAKS}
          placeholder="Cari nama atau kode kampanye..."
          aria-label="Cari kampanye iklan"
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div className="relative">
        <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          value={filter.channel}
          onChange={ubahChannel}
          aria-label="Filter channel iklan"
          className={KELAS_SELECT}
        >
          <option value={CHANNEL_SEMUA}>Semua channel</option>
          {IKLAN_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {IKLAN_CHANNEL_CONFIG[channel].label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <HiOutlineFunnel className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <select
          value={kunciStatusDari(filter.isAktif)}
          onChange={ubahStatus}
          aria-label="Filter status kampanye"
          className={KELAS_SELECT}
        >
          {URUTAN_STATUS.map((kunci) => (
            <option key={kunci} value={kunci}>
              {STATUS_PILIHAN[kunci].label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
