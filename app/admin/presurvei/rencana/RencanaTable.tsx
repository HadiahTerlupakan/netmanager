"use client";

import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import {
  KEGIATAN_JENIS_CONFIG,
  type RencanaDto,
} from "@/modules/presurvei/client";

import { Badge, BadgeStatusRencana, BadgeSumberRencana } from "./BadgeRencana";
import { labelWaktuRencana, teksNama } from "./tampilanRencana";

interface RencanaTableProps {
  baris: readonly RencanaDto[];
  isLoading: boolean;
  isError: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPilih: (rencana: RencanaDto) => void;
}

const PESAN_KOSONG = "Belum ada rencana pada filter ini.";
const PESAN_GAGAL = "Rencana gagal dimuat.";

/**
 * Definisi kolom daftar rencana. Tidak diekspor: reference-nya dipakai
 * langsung oleh `<ResponsiveTable>` (alasan yang sama di `IklanTable.tsx`).
 */
const kolom: Column<RencanaDto>[] = [
  {
    key: "tanggal",
    header: "Tanggal & jam",
    priority: "primary",
    render: (item) => labelWaktuRencana(item),
  },
  {
    key: "namaSales",
    header: "Sales",
    priority: "primary",
    render: (item) => teksNama(item.namaSales),
  },
  {
    key: "jenis",
    header: "Jenis",
    priority: "secondary",
    render: (item) => <Badge tampilan={KEGIATAN_JENIS_CONFIG[item.jenis]} />,
  },
  {
    key: "tujuan",
    header: "Tujuan",
    priority: "secondary",
    render: (item) => (
      <span className="block max-w-xs truncate" title={item.tujuan}>
        {item.tujuan}
      </span>
    ),
  },
  { key: "namaProspek", header: "Prospek", priority: "tertiary" },
  {
    key: "sumber",
    header: "Sumber",
    priority: "tertiary",
    render: (item) => <BadgeSumberRencana rencana={item} />,
  },
  {
    key: "statusTampil",
    header: "Status",
    priority: "primary",
    render: (item) => <BadgeStatusRencana rencana={item} />,
  },
];

/** Tabel daftar rencana; klik baris membuka rinciannya. */
export function RencanaTable({
  baris,
  isLoading,
  isError,
  page,
  totalPages,
  onPageChange,
  onPilih,
}: RencanaTableProps) {
  return (
    <ResponsiveTable
      data={[...baris]}
      columns={kolom}
      keyField="id"
      loading={isLoading}
      emptyMessage={isError ? PESAN_GAGAL : PESAN_KOSONG}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      onRowClick={onPilih}
    />
  );
}
