"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { InvoicePaymentHistoryModal } from "./InvoicePaymentHistoryModal";
import { TransactionsTable } from "./TransactionsTable";
import {
  RAW_STATUS_LABEL,
  formatRupiah,
  type GatewayTransaction,
  type GatewayTransactionsResponse,
} from "./transaction-types";

const PAGE_SIZE = 20;
// Muat ulang berkala: status gateway berubah lewat webhook tanpa aksi admin.
const REFRESH_INTERVAL_MS = 30_000;

type Filters = { status: string; from: string; to: string; search: string };

function localDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function initialFilters(): Filters {
  const now = new Date();
  return {
    status: "",
    from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localDate(now),
    search: "",
  };
}

function buildKey(filters: Filters, page: number) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  return `/api/admin/payment-gateway/transactions?${query.toString()}`;
}

export default function PaymentGatewayTransactionsClient() {
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<GatewayTransaction | null>(null);

  const { data, isLoading, error } = useApi<GatewayTransactionsResponse>(
    buildKey(applied, page),
    { refreshInterval: REFRESH_INTERVAL_MS },
  );
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const apply = () => {
    setApplied(draft);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <FilterBar draft={draft} onChange={setDraft} onApply={apply} />
      <SummaryCards
        summary={data?.summary ?? []}
        onPick={(status) => {
          const next = { ...applied, status };
          setDraft(next);
          setApplied(next);
          setPage(1);
        }}
      />

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="overflow-x-auto">
          <TransactionsTable items={items} onHistory={setSelected} />
        </div>
        {items.length === 0 && (
          <p className="p-6 text-center text-gray-500">
            {isLoading
              ? "Memuat transaksi..."
              : error
                ? "Gagal memuat transaksi."
                : "Tidak ada transaksi untuk filter ini."}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {data?.total ?? 0} transaksi · halaman {page} dari {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      {selected && (
        <InvoicePaymentHistoryModal
          transaction={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function FilterBar({
  draft,
  onChange,
  onApply,
}: {
  draft: Filters;
  onChange: (filters: Filters) => void;
  onApply: () => void;
}) {
  const field =
    "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white";
  return (
    <form
      className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <label className="text-xs text-gray-500 md:col-span-2">
        Cari pelanggan / nomor tagihan
        <input
          className={field}
          value={draft.search}
          placeholder="Nama, ID pelanggan, username, atau INV/..."
          onChange={(e) => onChange({ ...draft, search: e.target.value })}
        />
      </label>
      <label className="text-xs text-gray-500">
        Status
        <select
          className={field}
          value={draft.status}
          onChange={(e) => onChange({ ...draft, status: e.target.value })}
        >
          <option value="">Semua status</option>
          {Object.entries(RAW_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-gray-500">
        Dari
        <input
          type="date"
          className={field}
          value={draft.from}
          onChange={(e) => onChange({ ...draft, from: e.target.value })}
        />
      </label>
      <div className="flex gap-2 items-end">
        <label className="text-xs text-gray-500 flex-1">
          Sampai
          <input
            type="date"
            className={field}
            value={draft.to}
            onChange={(e) => onChange({ ...draft, to: e.target.value })}
          />
        </label>
        <Button type="submit">Terapkan</Button>
      </div>
    </form>
  );
}

function SummaryCards({
  summary,
  onPick,
}: {
  summary: GatewayTransactionsResponse["summary"];
  onPick: (status: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {Object.entries(RAW_STATUS_LABEL).map(([status, label]) => {
        const entry = summary.find((item) => item.status === status);
        return (
          <button
            key={status}
            type="button"
            onClick={() => onPick(status)}
            className="text-left rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:border-indigo-300"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {entry?.count ?? 0}
            </p>
            <p className="text-xs text-gray-500">
              {formatRupiah(entry?.amount ?? 0)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
