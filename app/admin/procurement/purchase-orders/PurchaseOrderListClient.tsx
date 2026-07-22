"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  HiOutlineArrowDownTray,
  HiOutlinePlus,
  HiPencil,
  HiTrash,
} from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import {
  ProcurementListCard,
  ProcurementPageShell,
  PROCUREMENT_INPUT_CLASS,
} from "../_components/ProcurementPageShell";
import { downloadPurchaseOrderPdfById } from "./po-pdf";

interface PurchaseOrderListItem {
  id: string;
  poNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  grandTotal: number;
  ppnAmount: number;
  expectedDate: string | null;
  createdAt: string;
  supplier: { id: string; name: string; npwp: string | null } | null;
}

interface PurchaseOrderListResponse {
  items: PurchaseOrderListItem[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ORDERED: "Dipesan",
  RECEIVED: "Diterima",
  CANCELLED: "Dibatalkan",
};

const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  UNPAID: { label: "Belum Bayar", color: "bg-yellow-100 text-yellow-800" },
  PARTIAL: { label: "Sebagian", color: "bg-blue-100 text-blue-800" },
  PAID: { label: "Lunas", color: "bg-green-100 text-green-800" },
};

const PAGE_SIZE = 20;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PurchaseOrderListClient() {
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const queryString = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    page: String(page),
    limit: String(PAGE_SIZE),
  }).toString();

  const { data, error, isLoading, mutate } = useApi<PurchaseOrderListResponse>(
    `/api/admin/procurement/purchase-orders?${queryString}`,
  );

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Gagal memuat data PO");
    }
  }, [error]);

  const handleDelete = async (id: string, poNumber: string) => {
    if (!confirm(`Hapus Purchase Order "${poNumber}"?`)) return;
    try {
      const res = await fetch(`/api/admin/procurement/purchase-orders/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || "Gagal menghapus");
      }
      toast.success("Purchase Order berhasil dihapus");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus PO");
    }
  };

  const handleDownloadPdf = async (id: string) => {
    setDownloadingId(id);
    try {
      await downloadPurchaseOrderPdfById(id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengunduh PDF PO",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <ProcurementPageShell
      title="Purchase Order"
      subtitle="Kelola PO ke supplier — buat, lihat, dan track pembayaran."
      backHref="/admin/procurement"
      actions={
        <Link href="/admin/procurement/purchase-orders/create">
          <Button>
            <HiOutlinePlus className="w-4 h-4 mr-1" />
            Buat PO
          </Button>
        </Link>
      }
    >
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Cari nomor PO..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={`${PROCUREMENT_INPUT_CLASS} flex-1 min-w-[240px] max-w-md`}
        />
        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
          className={PROCUREMENT_INPUT_CLASS}
        >
          <option value="">Semua status bayar</option>
          <option value="UNPAID">Belum Bayar</option>
          <option value="PARTIAL">Sebagian</option>
          <option value="PAID">Lunas</option>
        </select>
      </div>

      <ProcurementListCard>
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <tr className="text-left">
              <th className="px-4 py-3 font-medium">No. PO</th>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium text-right">Subtotal</th>
              <th className="px-4 py-3 font-medium text-right">PPN</th>
              <th className="px-4 py-3 font-medium text-right">Grand Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Bayar</th>
              <th className="px-4 py-3 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Memuat data...
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Belum ada purchase order.
                </td>
              </tr>
            )}
            {items.map((po) => {
              const payment = PAYMENT_LABEL[po.paymentStatus] ?? {
                label: po.paymentStatus,
                color: "bg-gray-100 text-gray-700",
              };
              return (
                <tr
                  key={po.id}
                  className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition"
                >
                  <td className="px-4 py-3 font-mono text-xs">{po.poNumber}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(po.createdAt)}
                  </td>
                  <td className="px-4 py-3">{po.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {formatCurrency(po.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {formatCurrency(po.ppnAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(po.grandTotal)}
                  </td>
                  <td className="px-4 py-3">
                    {STATUS_LABEL[po.status] ?? po.status}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${payment.color}`}
                    >
                      {payment.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => handleDownloadPdf(po.id)}
                        disabled={downloadingId === po.id}
                        className="p-2 text-gray-600 hover:text-indigo-600 disabled:opacity-50"
                        title="Download PDF"
                      >
                        <HiOutlineArrowDownTray className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/admin/procurement/purchase-orders/${po.id}`}
                        className="p-2 text-gray-600 hover:text-blue-600"
                        title="Detail / Edit"
                      >
                        <HiPencil className="w-4 h-4" />
                      </Link>
                      {po.status !== "RECEIVED" && (
                        <button
                          onClick={() => handleDelete(po.id, po.poNumber)}
                          className="p-2 text-gray-600 hover:text-red-600"
                          title="Hapus"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ProcurementListCard>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-600">
            Menampilkan {items.length} dari {total} PO
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
