"use client";

import { FiEdit2, FiEye, FiMinusCircle, FiTrash2 } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import type { StockOpnameRecord } from "@/lib/types/inventory";

const ALASAN_LABELS: Record<string, string> = {
  hilang: "Hilang",
  rusak: "Rusak",
  revisi: "Revisi",
  salah_input: "Salah Input",
  terpakai: "Terpakai",
  expired: "Expired",
  lebih: "Stok Lebih",
  lainnya: "Lainnya",
};

const QUALITY_GOOD_THRESHOLD = 95;
const QUALITY_OK_THRESHOLD = 85;

function getSelisihBadge(selisih: number) {
  if (selisih === 0) {
    return {
      color: "bg-green-100 text-green-800",
      text: "Tidak ada selisih",
    };
  }
  if (selisih > 0) {
    return { color: "bg-blue-100 text-blue-800", text: `+${selisih}` };
  }
  return { color: "bg-red-100 text-red-800", text: `${selisih}` };
}

function getQualityBadge(baik: number, rusak: number, bekas: number) {
  const total = baik + rusak + bekas;
  if (total === 0) return null;
  const persentase = (baik / total) * 100;

  if (persentase >= QUALITY_GOOD_THRESHOLD) {
    return {
      color: "bg-green-100 text-green-800",
      text: `${Math.round(persentase)}% baik`,
    };
  }
  if (persentase >= QUALITY_OK_THRESHOLD) {
    return {
      color: "bg-yellow-100 text-yellow-800",
      text: `${Math.round(persentase)}% baik`,
    };
  }
  return {
    color: "bg-red-100 text-red-800",
    text: `${Math.round(persentase)}% baik`,
  };
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type OpnameHistoryTableProps = {
  data: StockOpnameRecord[];
  loading: boolean;
  deletingId: string | null;
  onView?: (opname: StockOpnameRecord) => void;
  onEdit?: (opname: StockOpnameRecord) => void;
  onDelete: (opname: StockOpnameRecord) => void;
};

export function OpnameHistoryTable({
  data,
  loading,
  deletingId,
  onView,
  onEdit,
  onDelete,
}: OpnameHistoryTableProps) {
  const columns: Column<StockOpnameRecord>[] = [
    {
      key: "createdAt",
      header: "Tanggal",
      priority: "secondary",
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {formatDate(item.createdAt)}
        </div>
      ),
    },
    {
      key: "barang",
      header: "Barang",
      priority: "primary",
      render: (item) => (
        <>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {item.barang.kode}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {item.barang.nama}
          </div>
        </>
      ),
    },
    {
      key: "gudang",
      header: "Gudang",
      priority: "secondary",
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {item.gudang.nama}
        </div>
      ),
    },
    {
      key: "stokSistem",
      header: "Stok Sistem",
      priority: "tertiary",
      render: (item) => (
        <div className="text-center">
          <span className="text-sm font-medium text-blue-600">
            {item.stokSistem}
          </span>
        </div>
      ),
    },
    {
      key: "stokFisik",
      header: "Stok Fisik",
      priority: "primary",
      render: (item) => (
        <div className="text-center">
          <span className="text-sm font-bold text-green-600">
            {item.stokFisik}
          </span>
        </div>
      ),
    },
    {
      key: "selisih",
      header: "Selisih",
      priority: "primary",
      render: (item) => {
        const selisihBadge = getSelisihBadge(item.selisih);
        const isHilang = item.alasanSelisih === "hilang";
        return (
          <div className="flex flex-col items-center gap-1">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selisihBadge.color}`}
            >
              {selisihBadge.text}
            </span>
            {isHilang && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                <FiMinusCircle className="w-3 h-3" /> HILANG
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "alasanSelisih",
      header: "Alasan",
      priority: "secondary",
      render: (item) => {
        if (item.selisih === 0) return <span className="text-gray-400">-</span>;
        return (
          <span className="text-sm text-gray-900 dark:text-white">
            {item.alasanSelisih
              ? ALASAN_LABELS[item.alasanSelisih] || item.alasanSelisih
              : "-"}
          </span>
        );
      },
    },
    {
      key: "kondisi",
      header: "Kondisi",
      priority: "secondary",
      render: (item) => {
        const qualityBadge = getQualityBadge(
          item.kondisiBaik,
          item.kondisiRusak,
          item.kondisiExpire,
        );
        return (
          <div className="flex flex-col space-y-1">
            <div className="text-xs text-gray-600">
              {item.kondisiBaik}/{item.kondisiRusak}/{item.kondisiExpire}
            </div>
            {qualityBadge && (
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${qualityBadge.color}`}
              >
                {qualityBadge.text}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "location",
      header: "Lokasi",
      priority: "tertiary",
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white">
          <div>{item.lokasiPenyimpanan || "-"}</div>
          {item.nomorRak && (
            <div className="text-xs text-gray-500">Rak {item.nomorRak}</div>
          )}
        </div>
      ),
    },
    {
      key: "pic",
      header: "PIC",
      priority: "tertiary",
      render: (item) => (
        <div className="text-sm text-gray-900 dark:text-white">
          {item.pic || "-"}
        </div>
      ),
    },
  ];

  const renderActions = (opname: StockOpnameRecord) => (
    <div className="flex justify-center space-x-2">
      {onView && (
        <Button
          onClick={() => onView(opname)}
          className="inline-flex items-center justify-center w-8 h-8 rounded text-blue-600 hover:bg-blue-50 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200"
          title="View Detail"
        >
          <FiEye className="h-4 w-4" />
        </Button>
      )}
      {onEdit && (
        <Button
          onClick={() => onEdit(opname)}
          className="inline-flex items-center justify-center w-8 h-8 rounded text-yellow-600 hover:bg-yellow-50 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 border border-yellow-200"
          title="Edit"
        >
          <FiEdit2 className="h-4 w-4" />
        </Button>
      )}
      <Button
        onClick={() => onDelete(opname)}
        disabled={deletingId === opname.id}
        className="inline-flex items-center justify-center w-8 h-8 rounded text-red-600 hover:bg-red-50 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 border border-red-200"
        title="Delete"
      >
        <FiTrash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <ResponsiveTable
      data={data}
      columns={columns}
      keyField="id"
      loading={loading}
      emptyMessage="Belum ada data stock opname"
      loadingMessage="Memuat data..."
      renderActions={renderActions}
    />
  );
}
