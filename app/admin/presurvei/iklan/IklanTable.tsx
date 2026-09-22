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

const kolom: Column<IklanListItemDto>[] = [
  { key: "nama", header: "Nama kampanye", priority: "primary" },
  { key: "kode", header: "Kode UTM", priority: "primary" },
  {
    key: "channel",
    header: "Channel",
    priority: "secondary",
    render: (item) => {
      const tampilan =
        IKLAN_CHANNEL_CONFIG[item.channel as keyof typeof IKLAN_CHANNEL_CONFIG];
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
    render: (item) => formatDateDisplay(item.tanggalMulai),
  },
  {
    key: "tanggalSelesai",
    header: "Selesai",
    priority: "tertiary",
    render: (item) => formatDateDisplay(item.tanggalSelesai),
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
