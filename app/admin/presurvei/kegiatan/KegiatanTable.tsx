"use client";

import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import {
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  type KegiatanListItemDto,
} from "@/modules/presurvei/client";

import { teksSalesKegiatan, teksWaktuKegiatan } from "./kegiatanListQuery";

interface Props {
  baris: KegiatanListItemDto[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Definisi kolom daftar kegiatan.
 *
 * Sengaja TIDAK diekspor: array ini mutable, dan reference-nya yang sama persis
 * diteruskan ke `<ResponsiveTable columns={kolom}>` — bukan salinannya. Siapa
 * pun yang mengimpornya bisa memutasi tabel produksi dari luar. Keputusan yang
 * sama diambil dan dicatat di `IklanTable.tsx`.
 *
 * Konsekuensinya diketahui: **baris `render:` di bawah tidak dijaga test mana
 * pun.** Yang diuji adalah `teksWaktuKegiatan` berdiri sendiri di
 * `presurvei-kegiatan-list-query.test.ts`, bukan pemasangannya ke kolom.
 * Yang menahannya tetap benar adalah bentuk penugasannya: `render:
 * teksWaktuKegiatan` adalah reference langsung ke fungsi yang diuji, sehingga
 * pemformatan di layar tidak mungkin menyimpang darinya. **Mengubahnya jadi
 * lambda menghapus proteksi itu — jangan.**
 *
 * Itu keadaan hari ini, bukan batas yang melekat: penutupannya ada. Repo ini
 * punya `jsdom`, dan `tests/app/presurvei-kegiatan-filters.test.tsx` sudah
 * merender komponen tetangga lalu membaca atribut yang keluar. Pekerjaannya
 * cuma belum dilakukan.
 *
 * `alamatDikunjungi` dan `jumlahFoto` tidak perlu `render`: `safeRender` di
 * `ResponsiveTable` sudah memetakan `null` ke "-" dan mencetak angka 0 apa
 * adanya, jadi menambahkan lambda di sini justru membuka jebakan falsy.
 */
const kolom: Column<KegiatanListItemDto>[] = [
  {
    key: "waktuMulai",
    header: "Waktu",
    priority: "primary",
    render: teksWaktuKegiatan,
  },
  {
    key: "userId",
    header: "Sales",
    priority: "primary",
    render: teksSalesKegiatan,
  },
  {
    key: "jenis",
    header: "Jenis",
    priority: "secondary",
    render: (item) => {
      const tampilan = KEGIATAN_JENIS_CONFIG[item.jenis];
      return (
        <span className={`rounded px-2 py-0.5 text-xs ${tampilan.warna}`}>
          {tampilan.label}
        </span>
      );
    },
  },
  {
    key: "hasil",
    header: "Hasil",
    priority: "primary",
    render: (item) => {
      const tampilan = KEGIATAN_HASIL_CONFIG[item.hasil];
      return (
        <span className={`rounded px-2 py-0.5 text-xs ${tampilan.warna}`}>
          {tampilan.label}
        </span>
      );
    },
  },
  { key: "alamatDikunjungi", header: "Alamat", priority: "tertiary" },
  {
    key: "jumlahFoto",
    header: "Foto",
    priority: "tertiary",
    align: "right",
  },
];

/** Tabel daftar kegiatan sales beserta paginasinya. */
export function KegiatanTable({
  baris,
  isLoading,
  page,
  totalPages,
  onPageChange,
}: Props) {
  return (
    <ResponsiveTable
      data={baris}
      columns={kolom}
      keyField="id"
      loading={isLoading}
      emptyMessage="Belum ada kegiatan pada filter ini."
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
    />
  );
}
