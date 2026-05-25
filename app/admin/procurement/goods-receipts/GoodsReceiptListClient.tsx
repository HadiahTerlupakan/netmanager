"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { useApi } from "@/lib/hooks/useApi";
import {
  ProcurementListCard,
  ProcurementPageShell,
  PROCUREMENT_INPUT_CLASS,
} from "../_components/ProcurementPageShell";

interface GoodsReceiptListItem {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string | null;
  status: string;
  receivedAt: string;
  receiverName: string | null;
  gudangNama: string | null;
  totalQuantity: number;
}

interface GoodsReceiptListResponse {
  items: GoodsReceiptListItem[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  POSTED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "DRAFT", label: "Draft" },
  { value: "POSTED", label: "Posted" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GoodsReceiptListClient() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const queryString = new URLSearchParams({
    ...(statusFilter ? { status: statusFilter } : {}),
    page: String(page),
    limit: String(limit),
  }).toString();

  const { data, error, isLoading } = useApi<GoodsReceiptListResponse>(
    `/api/admin/procurement/goods-receipts?${queryString}`,
  );

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Gagal memuat data goods receipt");
    }
  }, [error]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <ProcurementPageShell
      title="Goods Receipt"
      subtitle="Dokumen penerimaan barang per batch. Satu PO bisa punya banyak GRN karena vendor dapat kirim parsial. GRN dibuat dari halaman detail PO."
      backHref="/admin/procurement"
      actions={
        <Link
          href="/admin/procurement/purchase-orders"
          className="text-sm text-blue-600 hover:underline"
        >
          Pilih PO untuk buat GRN baru →
        </Link>
      }
    >
      <div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className={PROCUREMENT_INPUT_CLASS}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <ProcurementListCard>
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">No. GRN</th>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">PO</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Gudang</th>
              <th className="px-4 py-3 font-medium">Penerima</th>
              <th className="px-4 py-3 font-medium text-right">Total Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Belum ada GRN.
                </td>
              </tr>
            )}
            {items.map((g) => (
              <tr
                key={g.id}
                className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition"
              >
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/admin/procurement/goods-receipts/${g.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {g.grnNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatDate(g.receivedAt)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {g.poNumber ? (
                    <Link
                      href={`/admin/procurement/purchase-orders/${g.purchaseOrderId}`}
                      className="text-gray-700 hover:underline"
                    >
                      {g.poNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      STATUS_BADGE[g.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {g.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {g.gudangNama ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {g.receiverName ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">{g.totalQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProcurementListCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-600">
            Menampilkan {items.length} dari {total} GRN
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Sebelumnya
            </button>
            <span className="px-3 py-1">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </ProcurementPageShell>
  );
}
