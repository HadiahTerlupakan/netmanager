"use client";

import { useState } from "react";
import { FiDownload } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { clientLogger } from "@/lib/client-logger";
import { useToast } from "@/hooks/use-toast";
import type { StockOpnameRecord } from "@/lib/types/inventory";

import { OpnameHistoryFiltersBar } from "./opname/history/OpnameHistoryFilters";
import { OpnameHistoryPaginationBar } from "./opname/history/OpnameHistoryPagination";
import { OpnameHistoryTable } from "./opname/history/OpnameHistoryTable";
import { OpnameStatsCards } from "./opname/history/OpnameStatsCards";
import { useOpnameHistory } from "./opname/history/useOpnameHistory";

interface OpnameReportTableProps {
  onEdit?: ((opname: StockOpnameRecord) => void) | undefined;
  onView?: ((opname: StockOpnameRecord) => void) | undefined;
  refreshTrigger?: number;
}

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

function buildCsvContent(items: StockOpnameRecord[]) {
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

export function OpnameReportTable({
  onEdit,
  onView,
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
  const [confirmTarget, setConfirmTarget] = useState<StockOpnameRecord | null>(
    null,
  );
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
      const params = new URLSearchParams({ page: "1", limit: "10000" });
      if (filters.barangId) params.set("barangId", filters.barangId);
      if (filters.gudangId) params.set("gudangId", filters.gudangId);
      if (filters.tanggalMulai)
        params.set("tanggalMulai", filters.tanggalMulai);
      if (filters.tanggalSelesai)
        params.set("tanggalSelesai", filters.tanggalSelesai);
      if (filters.alasanSelisih)
        params.set("alasanSelisih", filters.alasanSelisih);

      const response = await fetch(`/api/inventory/opname/list?${params}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal mengambil data export");
      }
      const data = await response.json();
      const items: StockOpnameRecord[] = (data.data || data).opnameList || [];

      if (items.length === 0) {
        showToast("warning", "Tidak ada data untuk di-export");
        return;
      }

      const content = buildCsvContent(items);
      const today = new Date().toISOString().split("T")[0];
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
            onView={onView}
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
        description={
          confirmTarget
            ? `Apakah Anda yakin ingin menghapus record ${confirmTarget.barang.kode} - ${confirmTarget.barang.nama}? Stok akan dikembalikan ke kondisi sebelum opname.`
            : "Apakah Anda yakin ingin menghapus record stock opname ini?"
        }
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
