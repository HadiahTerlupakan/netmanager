"use client";

import { useState } from "react";
import { FiDownload } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { clientLogger } from "@/lib/client-logger";
import { useToast } from "@/hooks/use-toast";

import { OpnameHistoryFiltersBar } from "./opname/history/OpnameHistoryFilters";
import { OpnameHistoryPaginationBar } from "./opname/history/OpnameHistoryPagination";
import { OpnameHistoryTable } from "./opname/history/OpnameHistoryTable";
import { OpnameStatsCards } from "./opname/history/OpnameStatsCards";
import {
  buildOpnameListQuery,
  readJsonOrThrow,
  useOpnameHistory,
  type OpnameHistoryFilters,
  type OpnameHistoryRecord,
} from "./opname/history/useOpnameHistory";

interface OpnameReportTableProps {
  onEdit?: ((opname: OpnameHistoryRecord) => void) | undefined;
  refreshTrigger?: number;
}

const EXPORT_PAGE_LIMIT = 1000;
const FIRST_PAGE = 1;
const ISO_DATE_LENGTH = 10;

const CSV_HEADERS = [
  "Tanggal",
  "Barang",
  "Gudang",
  "Stok Sistem",
  "Stok Fisik",
  "Selisih",
  "Kondisi",
  "Lokasi",
  "PIC",
];

function escapeCsvCell(value: string | number | null | undefined) {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsvContent(items: OpnameHistoryRecord[]) {
  const rows = items.map((item) => [
    new Date(item.createdAt).toLocaleDateString("id-ID"),
    `${item.barang.kode} - ${item.barang.nama}`,
    item.gudang.nama,
    item.stokSistem,
    item.stokFisik,
    item.selisih,
    `${item.kondisiBaik}/${item.kondisiRusak}/${item.kondisiExpire}`,
    item.lokasiPenyimpanan || "-",
    item.pic || "-",
  ]);
  return [CSV_HEADERS, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
    .join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type OpnameListPage = {
  opnameList?: OpnameHistoryRecord[];
  pagination?: { totalPages?: number };
};

/** Ambil seluruh halaman list opname (per 1000) agar export tidak terpotong. */
async function fetchAllOpnameRecords(filters: OpnameHistoryFilters) {
  const items: OpnameHistoryRecord[] = [];
  let page = FIRST_PAGE;
  let totalPages = FIRST_PAGE;

  do {
    const query = buildOpnameListQuery(filters, page, EXPORT_PAGE_LIMIT);
    const response = await fetch(`/api/inventory/opname/list?${query}`);
    const result: OpnameListPage = await readJsonOrThrow(
      response,
      "Gagal mengambil data export",
    );
    items.push(...(result.opnameList ?? []));
    totalPages = result.pagination?.totalPages ?? FIRST_PAGE;
    page += 1;
  } while (page <= totalPages);

  return items;
}

function buildDeleteDescription(target: OpnameHistoryRecord | null) {
  if (!target)
    return "Apakah Anda yakin ingin menghapus catatan stock opname ini?";
  return (
    `Hapus catatan opname ${target.barang.kode} - ${target.barang.nama} di ${target.gudang.nama}? ` +
    `Stok akan disesuaikan kembali sebesar selisih opname ini (${target.selisih}), ` +
    "dan mutasi stok (barang masuk/keluar) yang dibuat opname ini ikut dihapus."
  );
}

/** Halaman Riwayat Opname: statistik, filter, tabel, hapus, dan export CSV. */
export function OpnameReportTable({
  onEdit,
  refreshTrigger = 0,
}: OpnameReportTableProps) {
  const { showToast } = useToast();
  const {
    opnameList,
    stats,
    filters,
    pagination,
    loading,
    error,
    setCurrentPage,
    updateFilters,
    resetFilters,
    refetch,
  } = useOpnameHistory(refreshTrigger);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] =
    useState<OpnameHistoryRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleDelete = async () => {
    if (!confirmTarget) return;
    const id = confirmTarget.id?.trim();
    setConfirmTarget(null);

    if (!id) {
      showToast("error", "ID tidak valid, tidak dapat menghapus record");
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/inventory/opname/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Gagal menghapus stock opname (${response.status}): ${errorText}`,
        );
      }
      showToast("success", "Stock opname berhasil dihapus");
      refetch();
    } catch (err) {
      clientLogger.error("Error deleting stock opname:", err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal menghapus stock opname",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const items = await fetchAllOpnameRecords(filters);

      if (items.length === 0) {
        showToast("warning", "Tidak ada data untuk di-export");
        return;
      }

      const content = buildCsvContent(items);
      const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
      downloadCsv(content, `stock_opname_${today}.csv`);
      showToast("success", `Berhasil export ${items.length} record`);
    } catch (err) {
      clientLogger.error("Error exporting opname:", err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal export data",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <OpnameStatsCards stats={stats} />

      <OpnameHistoryFiltersBar
        filters={filters}
        onFilterChange={updateFilters}
        onFilterReset={resetFilters}
      />

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={exporting}
        >
          <FiDownload className="mr-2 h-4 w-4" />
          {exporting ? "Mengekspor..." : "Export CSV"}
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Detail Laporan Stock Opname
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {pagination.total} records found
          </span>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
            <Button onClick={() => refetch()} className="mt-2">
              Retry
            </Button>
          </div>
        ) : (
          <OpnameHistoryTable
            data={opnameList}
            loading={loading}
            deletingId={deletingId}
            onEdit={onEdit}
            onDelete={(opname) => setConfirmTarget(opname)}
          />
        )}

        <OpnameHistoryPaginationBar
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageSelect={setCurrentPage}
        />
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Hapus Stock Opname"
        description={buildDeleteDescription(confirmTarget)}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
