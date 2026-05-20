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
import ResponsiveTable from "@/components/ui/ResponsiveTable";
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
  AUTO_EXPENSE: "Expense",
  AUTO_PO_PAID: "PO Dibayar",
  RECURRING: "Recurring",
  REVERSAL: "Reversal",
  OPENING_BALANCE: "Saldo Awal",
  CLOSING: "Closing",
  ADJUSTMENT: "Adjustment",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  POSTED: {
    label: "Posted",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  REVERSED: {
    label: "Reversed",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
  },
  DRAFT: {
    label: "Draft",
    bg: "bg-gray-100 dark:bg-gray-700",
    text: "text-gray-700 dark:text-gray-300",
  },
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
        setData(await res.json());
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

  const summaryTotal =
    data?.items.reduce((sum, item) => sum + totalDebit(item), 0) ?? 0;
  const summaryCount = data?.total ?? 0;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlineDocumentText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            Jurnal Akuntansi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola dan pantau seluruh jurnal transaksi keuangan perusahaan
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Jurnal
          </p>
          <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {summaryCount}
          </h3>
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
      <div className="flex flex-wrap gap-3">
        <select
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all"
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
        <select
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all"
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            setPage(1);
            fetchData(1);
          }}
        >
          <option value="">Semua Status</option>
          <option value="POSTED">Posted</option>
          <option value="REVERSED">Reversed</option>
          <option value="DRAFT">Draft</option>
        </select>
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
                  <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-400">
                    <HiOutlineCalendar className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-sm">
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
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                  {SOURCE_LABELS[item.source] || item.source}
                </span>
              ),
            },
            {
              key: "description",
              header: "Deskripsi",
              priority: "tertiary",
              render: (item: JournalItem) => (
                <span className="text-gray-500 dark:text-gray-400 text-sm italic truncate max-w-[200px] block">
                  {item.description || "-"}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Total Debit",
              priority: "primary",
              render: (item: JournalItem) => (
                <span className="text-indigo-600 dark:text-indigo-400 font-black font-mono">
                  {formatCurrency(totalDebit(item))}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              priority: "primary",
              render: (item: JournalItem) => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.DRAFT;
                return (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}
                  >
                    {cfg.label}
                  </span>
                );
              },
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
          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
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
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Sebelumnya
            </button>
            <button
              disabled={page >= Math.ceil(data.total / data.limit)}
              onClick={() => {
                setPage((p) => p + 1);
                fetchData(page + 1);
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
