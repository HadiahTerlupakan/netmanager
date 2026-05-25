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

interface GoodsReturnListItem {
  id: string;
  rtvNumber: string;
  goodsReceiptId: string;
  grnNumber: string | null;
  supplierName: string | null;
  status: string;
  reason: string;
  returnedAt: string;
  totalQuantity: number;
}

interface GoodsReturnListResponse {
  items: GoodsReturnListItem[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-orange-100 text-orange-700",
  REFUNDED: "bg-green-100 text-green-700",
  REPLACED: "bg-blue-100 text-blue-700",
  CREDIT_NOTE: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const REASON_LABEL: Record<string, string> = {
  DAMAGED: "Rusak",
  WRONG_SPEC: "Tidak Sesuai Spek",
  EXCESS: "Kelebihan Kirim",
  OTHER: "Lainnya",
};

const STATUS_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "REFUNDED", label: "Refunded" },
  { value: "REPLACED", label: "Replaced" },
  { value: "CREDIT_NOTE", label: "Credit Note" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function GoodsReturnListClient() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const queryString = new URLSearchParams({
    ...(statusFilter ? { status: statusFilter } : {}),
    page: String(page),
    limit: String(limit),
  }).toString();

  const { data, error, isLoading } = useApi<GoodsReturnListResponse>(
    `/api/admin/procurement/goods-returns?${queryString}`,
  );

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Gagal memuat data RTV");
    }
  }, [error]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <ProcurementPageShell
      title="Retur Vendor (RTV)"
      subtitle="Retur barang yang sudah diterima ke supplier. RTV dibuat dari halaman detail GRN. Status SENT → REFUNDED/REPLACED/CREDIT_NOTE menandai gimana vendor menyelesaikan klaim."
      backHref="/admin/procurement"
      actions={
        <Link
          href="/admin/procurement/goods-receipts"
          className="text-sm text-blue-600 hover:underline"
        >
          Pilih GRN untuk buat RTV →
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
              <th className="px-4 py-3 font-medium">No. RTV</th>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">GRN</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Alasan</th>
              <th className="px-4 py-3 font-medium">Status</th>
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
                  Belum ada RTV.
                </td>
              </tr>
            )}
            {items.map((r) => (
              <tr
                key={r.id}
                className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition"
              >
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/admin/procurement/goods-returns/${r.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {r.rtvNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatDate(r.returnedAt)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.grnNumber ? (
                    <Link
                      href={`/admin/procurement/goods-receipts/${r.goodsReceiptId}`}
                      className="text-gray-700 hover:underline"
                    >
                      {r.grnNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {r.supplierName ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {REASON_LABEL[r.reason] ?? r.reason}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{r.totalQuantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ProcurementListCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-600">
            Menampilkan {items.length} dari {total} RTV
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
