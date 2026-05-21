"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  HiOutlineDocumentText,
  HiPlus,
  HiOutlineCalendar,
} from "react-icons/hi2";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { formatCurrency } from "@/lib/utils";

interface JournalItem {
  id: string;
  entryNumber: string;
  entryDate: string;
  source: string;
  description: string;
  status: string;
  lines: { side: string; amount: string }[];
}

interface ListResponse {
  items: JournalItem[];
  total: number;
  page: number;
  limit: number;
}

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  AUTO_INVOICE_CREATED: "Invoice Dibuat",
  AUTO_INVOICE_PAID: "Invoice Dibayar",
  AUTO_EXPENSE: "Pengeluaran",
  AUTO_PO_PAID: "PO Dibayar",
  RECURRING: "Berulang",
  REVERSAL: "Pembalikan",
  OPENING_BALANCE: "Saldo Awal",
  CLOSING: "Penutupan",
  ADJUSTMENT: "Penyesuaian",
};

const STATUS_COLORS: Record<string, string> = {
  POSTED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  REVERSED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
  POSTED: "Terposting",
  REVERSED: "Dibalik",
  DRAFT: "Draf",
};

export function JurnalListClient() {
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("journal:create");

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ source: "", status: "" });

  const fetchData = useCallback(
    async (p: number = page) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "20");
      if (filters.source) params.set("source", filters.source);
      if (filters.status) params.set("status", filters.status);

      const res = await fetch(`/api/admin/accounting/journal?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
      }
      setLoading(false);
    },
    [page, filters],
  );

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchData(1);
  }, [fetchData]);

  const totalDebit = (item: JournalItem) =>
    item.lines
      .filter((l) => l.side === "DEBIT")
      .reduce((sum, l) => sum + Number(l.amount), 0);

  const summaryTotal = (data?.items ?? []).reduce(
    (sum, item) => sum + totalDebit(item),
    0,
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlineDocumentText className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
            Jurnal Akuntansi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola dan pantau seluruh jurnal transaksi keuangan
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push("/admin/akuntansi/jurnal/new")}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95"
          >
            <HiPlus className="w-5 h-5" />
            Buat Jurnal Manual
          </button>
        )}
      </div>

      {/* Hero Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></div>
          <p className="text-indigo-100 font-medium mb-1 relative z-10">
            Total Jurnal
          </p>
          <h2 className="text-3xl font-bold relative z-10">
            {data?.total ?? 0}
          </h2>
          <div className="text-sm text-indigo-100 relative z-10 mt-2">
            <span className="bg-white/20 px-2 py-1 rounded-lg text-xs font-semibold">
              Halaman {data?.page ?? 1}
            </span>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Debit (Halaman Ini)
          </p>
          <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(summaryTotal)}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Halaman
          </p>
          <h3 className="text-xl font-black text-gray-700 dark:text-gray-300 font-mono">
            {data
              ? `${data.page} / ${Math.ceil(data.total / data.limit)}`
              : "-"}
          </h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Sumber
          </label>
          <select
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all"
            value={filters.source}
            onChange={(e) => {
              setFilters((f) => ({ ...f, source: e.target.value }));
              setPage(1);
              fetchData(1);
            }}
          >
            <option value="">Semua Sumber</option>
            {Object.entries(SOURCE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Status
          </label>
          <select
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all"
            value={filters.status}
            onChange={(e) => {
              setFilters((f) => ({ ...f, status: e.target.value }));
              setPage(1);
              fetchData(1);
            }}
          >
            <option value="">Semua Status</option>
            <option value="POSTED">Terposting</option>
            <option value="REVERSED">Dibalik</option>
            <option value="DRAFT">Draf</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        <ResponsiveTable
          data={data?.items || []}
          columns={[
            {
              key: "entryNumber",
              header: "No. Jurnal",
              priority: "primary",
              render: (item: JournalItem) => (
                <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">
                  {item.entryNumber}
                </span>
              ),
            },
            {
              key: "entryDate",
              header: "Tanggal",
              priority: "primary",
              render: (item: JournalItem) => (
                <div className="flex items-center gap-2">
                  <HiOutlineCalendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium">
                    {format(new Date(item.entryDate), "dd MMM yyyy", {
                      locale: id,
                    })}
                  </span>
                </div>
              ),
            },
            {
              key: "source",
              header: "Sumber",
              priority: "secondary",
              render: (item: JournalItem) => (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {SOURCE_LABELS[item.source] || item.source}
                </span>
              ),
            },
            {
              key: "description",
              header: "Deskripsi",
              priority: "tertiary",
              render: (item: JournalItem) => (
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px] block">
                  {item.description || "-"}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Total Debit",
              priority: "primary",
              align: "right",
              render: (item: JournalItem) => (
                <span className="font-black font-mono text-gray-900 dark:text-white">
                  {formatCurrency(totalDebit(item))}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              priority: "primary",
              align: "center",
              render: (item: JournalItem) => (
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[item.status] || ""}`}
                >
                  {STATUS_LABELS[item.status] || item.status}
                </span>
              ),
            },
          ]}
          keyField="id"
          loading={loading}
          onRowClick={(item: JournalItem) =>
            router.push(`/admin/akuntansi/jurnal/${item.id}`)
          }
          emptyMessage="Belum ada jurnal yang tercatat."
        />
      </div>

      {/* Pagination */}
      {data && data.total > data.limit && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Menampilkan halaman {data.page} dari{" "}
            {Math.ceil(data.total / data.limit)}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                fetchData(page - 1);
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Sebelumnya
            </button>
            <button
              disabled={page >= Math.ceil(data.total / data.limit)}
              onClick={() => {
                setPage((p) => p + 1);
                fetchData(page + 1);
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
