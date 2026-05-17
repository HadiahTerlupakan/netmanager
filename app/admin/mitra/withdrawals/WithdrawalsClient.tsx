"use client";

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import PageLoader from "@/components/ui/PageLoader";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import {
  HiOutlineArrowLeft,
  HiOutlineBanknotes,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineFunnel,
  HiOutlineArrowDownTray,
  HiOutlineArrowPath,
} from "react-icons/hi2";

interface WithdrawRequest {
  id: string;
  amount: number;
  method: "TRANSFER" | "CASH";
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "PROCESSING";
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  processedAt: string | null;
  mitraWallet: {
    mitra: {
      id: string;
      name: string | null;
      email: string;
      mitraType: string;
    };
  };
  processedBy: { id: string; name: string | null } | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: {
    label: "Menunggu",
    color:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  APPROVED: {
    label: "Disetujui",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  PROCESSING: {
    label: "Diproses",
    color:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  },
  COMPLETED: {
    label: "Selesai",
    color:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  REJECTED: {
    label: "Ditolak",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

export default function WithdrawalsClient() {
  const { hasPermission } = usePermission();
  const canProcess = hasPermission("withdrawals:update");

  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Action modals
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", page.toString());

      const res = await fetch(`/api/admin/mitra/withdrawals?${params}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.data.requests || []);
        setTotalPages(data.data.totalPages || 1);
        setTotal(data.data.total || 0);
      } else {
        toast.error(data.error || "Gagal memuat data");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  const [prevStatusFilter, setPrevStatusFilter] =
    useState<string>(statusFilter);
  if (prevStatusFilter !== statusFilter) {
    setPrevStatusFilter(statusFilter);
    setPage(1);
  }

  const [prevFetchKey, setPrevFetchKey] = useState<string | null>(null);
  const fetchKey = `${statusFilter}|${page}`;
  if (prevFetchKey !== fetchKey) {
    setPrevFetchKey(fetchKey);
    void fetchRequests();
  }

  const handleAction = async (
    id: string,
    action: string,
    body?: Record<string, unknown>,
  ) => {
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/admin/mitra/withdrawals/${id}?action=${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        const labels: Record<string, string> = {
          approve: "disetujui",
          reject: "ditolak",
          complete: "diselesaikan",
        };
        toast.success(`Penarikan berhasil ${labels[action] || action}`);
        setApproveId(null);
        setRejectId(null);
        setCompleteId(null);
        setRejectReason("");
        fetchRequests();
      } else {
        toast.error(data.error || "Gagal memproses");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setProcessing(false);
    }
  };

  const columns: Column<WithdrawRequest>[] = [
    {
      key: "user",
      header: "Mitra",
      priority: "primary",
      render: (req) => (
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {req.mitraWallet?.mitra?.name ||
              req.mitraWallet?.mitra?.email ||
              "Unknown"}
          </div>
          <div className="text-xs text-gray-500">
            {req.mitraWallet?.mitra?.mitraType === "MITRA_TEKNISI"
              ? "Teknisi"
              : "Sales"}
          </div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Jumlah",
      priority: "primary",
      render: (req) => (
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {formatCurrency(req.amount)}
        </span>
      ),
    },
    {
      key: "method",
      header: "Metode",
      priority: "secondary",
      render: (req) => (
        <div className="text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {req.method === "TRANSFER" ? "Transfer" : "Cash"}
          </span>
          {req.method === "TRANSFER" && req.bankName && (
            <div className="text-xs text-gray-500">
              {req.bankName} - {req.accountNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (req) => {
        const cfg = statusConfig[req.status] || {
          label: req.status,
          color: "bg-gray-100 text-gray-800",
        };
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}
          >
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      header: "Tanggal",
      priority: "secondary",
      render: (req) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(req.createdAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      ),
    },
  ];

  const renderActions = (req: WithdrawRequest) => {
    if (!canProcess) return null;
    return (
      <>
        {req.status === "PENDING" && (
          <>
            <button
              onClick={() => setApproveId(req.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-100 transition-colors"
              title="Setujui"
            >
              <HiOutlineCheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRejectId(req.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 transition-colors"
              title="Tolak"
            >
              <HiOutlineXCircle className="w-4 h-4" />
            </button>
          </>
        )}
        {req.status === "APPROVED" && (
          <button
            onClick={() => setCompleteId(req.id)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 transition-colors"
            title="Selesaikan"
          >
            <HiOutlineArrowDownTray className="w-4 h-4" /> Selesaikan
          </button>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/mitra"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Penarikan Komisi
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola request penarikan saldo mitra
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <HiOutlineFunnel className="h-5 w-5 text-gray-400" />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Semua Status</option>
              <option value="PENDING">Menunggu</option>
              <option value="APPROVED">Disetujui</option>
              <option value="PROCESSING">Diproses</option>
              <option value="COMPLETED">Selesai</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </div>
          <button
            onClick={fetchRequests}
            className="p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <HiOutlineArrowPath className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <PageLoader variant="section" message="Memuat data penarikan..." />
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <HiOutlineBanknotes className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              Belum ada permintaan penarikan
            </h3>
          </div>
        ) : (
          <>
            <ResponsiveTable
              data={requests}
              columns={columns}
              keyField="id"
              renderActions={renderActions}
            />
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Hal {page} / {totalPages} ({total} data)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Approve Modal */}
      <Modal
        isOpen={!!approveId}
        onClose={() => setApproveId(null)}
        title="Setujui Penarikan?"
        size="md"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiOutlineCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Penarikan akan disetujui dan siap diproses.
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() => setApproveId(null)}
            disabled={processing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            onClick={() => handleAction(approveId!, "approve")}
            disabled={processing}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {processing ? "Memproses..." : "Ya, Setujui"}
          </button>
        </ModalFooter>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectId}
        onClose={() => setRejectId(null)}
        title="Tolak Penarikan?"
        size="md"
      >
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiOutlineXCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Alasan Penolakan
          </label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Tuliskan alasan penolakan..."
          />
        </div>
        <ModalFooter>
          <button
            onClick={() => setRejectId(null)}
            disabled={processing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            onClick={() =>
              handleAction(rejectId!, "reject", { reason: rejectReason })
            }
            disabled={processing}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {processing ? "Memproses..." : "Tolak"}
          </button>
        </ModalFooter>
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={!!completeId}
        onClose={() => setCompleteId(null)}
        title="Selesaikan Penarikan?"
        size="md"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiOutlineArrowDownTray className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Saldo mitra akan dipotong sesuai jumlah penarikan. Pastikan
            transfer/pembayaran sudah dilakukan.
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() => setCompleteId(null)}
            disabled={processing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            onClick={() => handleAction(completeId!, "complete")}
            disabled={processing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {processing ? "Memproses..." : "Ya, Selesaikan"}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
