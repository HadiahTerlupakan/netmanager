"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HiOutlineArrowTopRightOnSquare } from "react-icons/hi2";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import {
  ProcurementListCard,
  ProcurementPageShell,
  PROCUREMENT_INPUT_CLASS,
} from "../_components/ProcurementPageShell";

interface PurchaseRequestSummary {
  id: string;
  nomorRequest: string;
  status: string;
  prioritas: string;
  tanggal: string;
  approvedAt: string | null;
  purchaseOrderId: string | null;
  requesterName: string | null;
  gudangNama: string | null;
  totalItems: number;
  totalNilai: number;
}

interface PurchaseRequestListResponse {
  data: PurchaseRequestSummary[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Semua status" },
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ORDERED", label: "Ordered (sudah jadi PO)" },
  { value: "RECEIVED", label: "Received" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  ORDERED: "bg-purple-100 text-purple-700",
  RECEIVED: "bg-teal-100 text-teal-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const PRIORITY_BADGE: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const ID_FORMATTER = new Intl.NumberFormat("id-ID");

function formatRupiah(n: number): string {
  return `Rp ${ID_FORMATTER.format(Math.round(n))}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * View Purchase Request dari sudut procurement.
 *
 * Read-only listing + action "Generate PO" untuk PR APPROVED.
 * Lifecycle full (create/approve/reject/process/receive) tetap di
 * `/admin/inventory/restock`.
 */
export function ProcurementPRListClient() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const limit = 20;

  const queryString = new URLSearchParams({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search ? { search } : {}),
    page: String(page),
    limit: String(limit),
  }).toString();

  const { data, error, isLoading, mutate } =
    useApi<PurchaseRequestListResponse>(
      `/api/admin/procurement/purchase-requests?${queryString}`,
    );

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Gagal memuat purchase request");
    }
  }, [error]);

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const eligibleSelected = items.filter(
    (pr) =>
      selected.has(pr.id) && pr.status === "APPROVED" && !pr.purchaseOrderId,
  );

  const toggleSelect = (id: string, isEligible: boolean) => {
    if (!isEligible) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGeneratePO = async () => {
    if (eligibleSelected.length === 0) {
      toast.error("Pilih minimal 1 PR APPROVED yang belum jadi PO");
      return;
    }
    if (
      !confirm(`Generate PO dari ${eligibleSelected.length} PR yang dipilih?`)
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        "/api/admin/procurement/purchase-orders/from-pr",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prIds: eligibleSelected.map((pr) => pr.id) }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal generate PO");
      }
      toast.success(json.message || "PO berhasil dibuat");
      setSelected(new Set());
      await mutate();
      router.push("/admin/procurement/purchase-orders");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal generate PO");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProcurementPageShell
      title="Purchase Request"
      subtitle="View read-only PR dari sudut procurement. Lifecycle (approve/reject/process/receive) dilakukan di modul Inventory Restock."
      backHref="/admin/procurement"
      actions={
        <Link
          href="/admin/inventory/restock"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          Buat / kelola PR di Inventory Restock
          <HiOutlineArrowTopRightOnSquare className="w-4 h-4" />
        </Link>
      }
    >
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Cari nomor PR..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={`${PROCUREMENT_INPUT_CLASS} flex-1 max-w-md`}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setSelected(new Set());
            setPage(1);
          }}
          className={PROCUREMENT_INPUT_CLASS}
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          onClick={handleGeneratePO}
          disabled={submitting || eligibleSelected.length === 0}
        >
          {submitting
            ? "Memproses..."
            : `Generate PO (${eligibleSelected.length})`}
        </Button>
      </div>

      <ProcurementListCard>
        <table className="w-full text-sm">
          <thead className="bg-gray-50/80 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <tr className="text-left">
              <th className="w-10 px-4 py-3"></th>
              <th className="px-4 py-3 font-medium">No. PR</th>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Prioritas</th>
              <th className="px-4 py-3 font-medium">Requester</th>
              <th className="px-4 py-3 font-medium">Gudang</th>
              <th className="px-4 py-3 font-medium text-right">Item</th>
              <th className="px-4 py-3 font-medium text-right">Nilai</th>
              <th className="px-4 py-3 font-medium">PO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Memuat data...
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Tidak ada PR.
                </td>
              </tr>
            )}
            {items.map((pr) => {
              const isEligible =
                pr.status === "APPROVED" && !pr.purchaseOrderId;
              const isSelected = selected.has(pr.id);
              return (
                <tr
                  key={pr.id}
                  className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(pr.id, isEligible)}
                      disabled={!isEligible}
                      title={
                        isEligible
                          ? "Pilih untuk generate PO"
                          : "Hanya PR APPROVED tanpa PO yang bisa dipilih"
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {pr.nomorRequest}
                  </td>
                  <td className="px-4 py-3">{formatDate(pr.tanggal)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        STATUS_BADGE[pr.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {pr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        PRIORITY_BADGE[pr.prioritas] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {pr.prioritas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {pr.requesterName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {pr.gudangNama ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{pr.totalItems}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatRupiah(pr.totalNilai)}
                  </td>
                  <td className="px-4 py-3">
                    {pr.purchaseOrderId ? (
                      <Link
                        href={`/admin/procurement/purchase-orders/${pr.purchaseOrderId}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Lihat PO
                      </Link>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
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
            Menampilkan {items.length} dari {total} PR
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
