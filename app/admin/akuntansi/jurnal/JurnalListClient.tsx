"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { HiOutlineDocumentText, HiPlus } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
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

const STATUS_COLORS: Record<string, string> = {
  POSTED: "bg-green-100 text-green-800",
  REVERSED: "bg-red-100 text-red-800",
  DRAFT: "bg-gray-100 text-gray-800",
};

export function JurnalListClient() {
  const router = useRouter();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
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

  useState(() => {
    fetchData(1);
  });

  const totalDebit = (item: JournalItem) =>
    item.lines
      .filter((l) => l.side === "DEBIT")
      .reduce((sum, l) => sum + Number(l.amount), 0);

  const columns = [
    {
      key: "entryNumber",
      header: "No. Jurnal",
      render: (item: JournalItem) => (
        <span className="font-mono text-sm">{item.entryNumber}</span>
      ),
    },
    {
      key: "entryDate",
      header: "Tanggal",
      render: (item: JournalItem) =>
        format(new Date(item.entryDate), "dd MMM yyyy", { locale: id }),
    },
    {
      key: "source",
      header: "Sumber",
      render: (item: JournalItem) => SOURCE_LABELS[item.source] || item.source,
    },
    {
      key: "description",
      header: "Deskripsi",
      render: (item: JournalItem) => (
        <span className="line-clamp-1 max-w-[200px]">{item.description}</span>
      ),
    },
    {
      key: "amount",
      header: "Total Debit",
      render: (item: JournalItem) => formatCurrency(totalDebit(item)),
    },
    {
      key: "status",
      header: "Status",
      render: (item: JournalItem) => (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status] || ""}`}
        >
          {item.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <HiOutlineDocumentText className="h-6 w-6" />
          Jurnal Akuntansi
        </h1>
        <Button onClick={() => router.push("/admin/akuntansi/jurnal/new")}>
          <HiPlus className="mr-1 h-4 w-4" />
          Buat Jurnal Manual
        </Button>
      </div>

      <div className="flex gap-2">
        <select
          className="rounded border px-3 py-1.5 text-sm"
          value={filters.source}
          onChange={(e) => {
            setFilters((f) => ({ ...f, source: e.target.value }));
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
          className="rounded border px-3 py-1.5 text-sm"
          value={filters.status}
          onChange={(e) => {
            setFilters((f) => ({ ...f, status: e.target.value }));
            fetchData(1);
          }}
        >
          <option value="">Semua Status</option>
          <option value="POSTED">Posted</option>
          <option value="REVERSED">Reversed</option>
          <option value="DRAFT">Draft</option>
        </select>
      </div>

      <ResponsiveTable
        data={data?.items || []}
        columns={columns}
        keyField="id"
        loading={loading}
        onRowClick={(item: JournalItem) =>
          router.push(`/admin/akuntansi/jurnal/${item.id}`)
        }
        emptyMessage="Belum ada jurnal"
      />

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Halaman {data.page} dari {Math.ceil(data.total / data.limit)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                fetchData(page - 1);
              }}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(data.total / data.limit)}
              onClick={() => {
                setPage((p) => p + 1);
                fetchData(page + 1);
              }}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
