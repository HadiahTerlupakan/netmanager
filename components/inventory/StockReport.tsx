"use client";

import { FiDownload, FiMapPin } from "react-icons/fi";

import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";
import { useToast } from "@/hooks/use-toast";

import { StockReportHeader } from "./opname/stock-report/StockReportHeader";
import { StockReportSelector } from "./opname/stock-report/StockReportSelector";
import { StockReportTable } from "./opname/stock-report/StockReportTable";
import {
  useStockReport,
  type GudangStock,
} from "./opname/stock-report/useStockReport";

const CSV_HEADERS = [
  "Kode Barang",
  "Nama Barang",
  "Satuan",
  "Stok Total",
  "Baru",
  "Bekas",
  "Rusak",
  "Hilang",
];

function escapeCsvCell(value: string | number | null | undefined) {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsvContent(gudangData: GudangStock) {
  const rows = gudangData.items.map((item) => [
    item.barangKode,
    item.barangNama,
    item.barangSatuan,
    item.stokTotal,
    item.stokBaru,
    item.stokBekas,
    item.stokRusak,
    item.totalHilang,
  ]);
  return [CSV_HEADERS, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
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

export function StockReport() {
  const { showToast } = useToast();
  const {
    gudangOptions,
    selectedGudangId,
    setSelectedGudangId,
    gudangData,
    loading,
    error,
    refresh,
  } = useStockReport();

  const handleExportCsv = () => {
    if (!gudangData) return;
    if (gudangData.items.length === 0) {
      showToast("warning", "Tidak ada data untuk di-export");
      return;
    }
    try {
      const content = buildCsvContent(gudangData);
      const today = new Date().toISOString().split("T")[0];
      downloadCsv(
        content,
        `laporan_stok_${gudangData.gudangKode}_${today}.csv`,
      );
      showToast("success", `Berhasil export ${gudangData.items.length} barang`);
    } catch (err) {
      clientLogger.error("Error exporting stock report:", err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal export data",
      );
    }
  };

  return (
    <div className="space-y-6">
      <StockReportSelector
        gudangOptions={gudangOptions}
        selectedGudangId={selectedGudangId}
        loading={loading}
        onSelect={setSelectedGudangId}
        onRefresh={refresh}
      />

      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Memuat data...
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && gudangData && (
        <>
          <StockReportHeader gudangData={gudangData} />

          <div className="flex justify-end">
            <Button variant="success" onClick={handleExportCsv}>
              <FiDownload className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <StockReportTable gudangData={gudangData} />
        </>
      )}

      {!loading && !error && !gudangData && selectedGudangId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
          Tidak ada data untuk gudang ini
        </div>
      )}

      {!loading && !error && !selectedGudangId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500">
          <FiMapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Pilih gudang untuk melihat laporan stok</p>
        </div>
      )}
    </div>
  );
}
