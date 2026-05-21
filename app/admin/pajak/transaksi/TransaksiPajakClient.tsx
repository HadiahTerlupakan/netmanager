"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { HiOutlineDocumentText } from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

interface TaxTransactionItem {
  id: string;
  taxType: string;
  direction: string;
  amount: number;
  taxAmount: number;
  rate: number;
  sourceRefType: string;
  sourceRefId: string;
  periodYear: number;
  periodMonth: number;
  notes: string | null;
  createdAt: string;
}

interface ListResponse {
  items: TaxTransactionItem[];
  total: number;
  page: number;
  limit: number;
}

const TAX_TYPE_LABELS: Record<string, string> = {
  PPN_KELUARAN: "PPN Keluaran",
  PPN_MASUKAN: "PPN Masukan",
  PPH_21: "PPh 21",
  PPH_23: "PPh 23",
  PPH_4_2: "PPh 4(2)",
  BHP: "BHP",
  USO: "USO",
  KSO: "KSO",
};

const DIRECTION_LABELS: Record<string, string> = {
  IN: "Masukan",
  OUT: "Keluaran",
};

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function TransaksiPajakClient() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | "">(new Date().getMonth() + 1);
  const [taxType, setTaxType] = useState("");
  const [page, setPage] = useState(1);

  const fetchedRef = useRef(false);

  const fetchData = useCallback(
    async (p: number = page) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("year", String(year));
        if (month) params.set("month", String(month));
        if (taxType) params.set("taxType", taxType);
        params.set("page", String(p));
        params.set("limit", "50");

        const res = await fetch(`/api/admin/tax/transactions?${params}`);
        if (res.ok) {
          const json = await res.json();
          setData(json.data);
        }
      } catch {
        toast.error("Gagal memuat transaksi pajak");
      } finally {
        setLoading(false);
      }
    },
    [year, month, taxType, page],
  );

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    if (fetchedRef.current) {
      setPage(1);
      fetchData(1);
    }
  }, [year, month, taxType, fetchData]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineDocumentText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">
          Transaksi Pajak
        </h1>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap gap-3">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          {Array.from(
            { length: 5 },
            (_, i) => new Date().getFullYear() - 2 + i,
          ).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) =>
            setMonth(e.target.value ? Number(e.target.value) : "")
          }
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          <option value="">Semua Bulan</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={taxType}
          onChange={(e) => setTaxType(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          <option value="">Semua Jenis</option>
          {Object.entries(TAX_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : !data?.items.length ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            Tidak ada transaksi pajak ditemukan
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f172a]">
                    <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                      Tanggal
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                      Jenis Pajak
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                      Arah
                    </th>
                    <th className="text-right px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                      DPP
                    </th>
                    <th className="text-right px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                      Pajak
                    </th>
                    <th className="text-right px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                      Tarif
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-gray-500 dark:text-gray-400 uppercase text-xs tracking-wider">
                      Referensi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-[#0f172a] transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {new Date(item.createdAt).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {TAX_TYPE_LABELS[item.taxType] || item.taxType}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {DIRECTION_LABELS[item.direction] || item.direction}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(item.taxAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                        {item.rate}%
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {item.sourceRefType}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data.total} transaksi
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPage(page - 1);
                      fetchData(page - 1);
                    }}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => {
                      setPage(page + 1);
                      fetchData(page + 1);
                    }}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
