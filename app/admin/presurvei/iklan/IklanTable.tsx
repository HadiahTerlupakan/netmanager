"use client";

import Link from "next/link";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { formatDateDisplay } from "@/lib/utils/datetime";
import {
  IKLAN_CHANNEL_CONFIG,
  type IklanListItemDto,
} from "@/modules/presurvei/client";

interface Props {
  baris: IklanListItemDto[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** Teks kolom "Mulai"; diekspor supaya pemformatannya bisa diuji tanpa DOM. */
export function teksTanggalMulai(item: IklanListItemDto): string {
  return formatDateDisplay(item.tanggalMulai);
}

/** Teks kolom "Selesai"; kampanye tanpa tanggal akhir tampil sebagai "-". */
export function teksTanggalSelesai(item: IklanListItemDto): string {
  return formatDateDisplay(item.tanggalSelesai);
}

/**
 * Definisi kolom daftar iklan.
 *
 * Sengaja TIDAK diekspor: array ini mutable, dan reference-nya yang sama persis
 * diteruskan ke `<ResponsiveTable columns={kolom}>` — bukan salinannya. Siapa
 * pun yang mengimpornya bisa memutasi tabel produksi dari luar.
 *
 * Harga yang dibayar untuk itu, disengaja dan perlu diketahui: **baris `render:`
 * di bawah tidak dijaga test mana pun.** Yang diuji adalah `teksTanggalMulai`
 * dan `teksTanggalSelesai` secara berdiri sendiri, bukan pemasangannya ke
 * kolom. Mengganti `render: teksTanggalMulai` dengan lambda yang memformat
 * sendiri — atau yang mengembalikan `item.tanggalMulai` mentah — akan lolos
 * seluruh test, `tsc`, maupun lint tanpa satu pun keluhan.
 *
 * Yang menahannya tetap benar hanyalah bentuk penugasannya: `render:
 * teksTanggalMulai` adalah reference langsung ke fungsi yang diuji, sehingga
 * pemformatan di layar tidak mungkin menyimpang dari yang dikunci test.
 * **Mengubahnya jadi lambda menghapus proteksi itu — jangan.**
 */
const kolom: Column<IklanListItemDto>[] = [
  { key: "nama", header: "Nama kampanye", priority: "primary" },
  { key: "kode", header: "Kode UTM", priority: "primary" },
  {
    key: "channel",
    header: "Channel",
    priority: "secondary",
    render: (item) => {
      const tampilan = IKLAN_CHANNEL_CONFIG[item.channel];
      return (
        <span className={`rounded px-2 py-0.5 text-xs ${tampilan.warna}`}>
          {tampilan.label}
        </span>
      );
    },
  },
  {
    key: "isBerjalan",
    header: "Status",
    priority: "primary",
    render: (item) =>
      item.isBerjalan ? (
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
          Berjalan
        </span>
      ) : (
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {item.isAktif ? "Belum mulai / sudah lewat" : "Dimatikan"}
        </span>
      ),
  },
  {
    key: "tanggalMulai",
    header: "Mulai",
    priority: "tertiary",
    render: teksTanggalMulai,
  },
  {
    key: "tanggalSelesai",
    header: "Selesai",
    priority: "tertiary",
    render: teksTanggalSelesai,
  },
];

/** Tabel daftar kampanye iklan beserta paginasinya. */
export function IklanTable({
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
      emptyMessage="Belum ada kampanye iklan."
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      renderActions={(item) => (
        <Link
          href={`/admin/presurvei/iklan/${item.id}/edit`}
          className="text-sm text-indigo-600 hover:underline"
        >
          Ubah
        </Link>
      )}
    />
  );
}
