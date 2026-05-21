"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  HiOutlineArrowDownTray,
  HiOutlineClock,
  HiOutlineBanknotes,
} from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";
import { usePermission } from "@/hooks/use-permission";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import PageLoader from "@/components/ui/PageLoader";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type DepositStatus = "PENDING" | "VERIFIED" | "COMPLETED" | "REJECTED";
type DepositType = "MODAL_AWAL" | "TAMBAHAN_MODAL" | "PINJAMAN";

interface Deposit {
  id: string;
  investorId: string;
  amount: number;
  depositType: DepositType;
  date: string;
  status: DepositStatus;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  reference: string | null;
  notes: string | null;
  rejectedReason: string | null;
  createdAt: string;
  investor?: {
    namaLengkap: string;
    perusahaan: string | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEPOSIT_TYPE_LABEL: Record<DepositType, string> = {
  MODAL_AWAL: "Modal Awal",
  TAMBAHAN_MODAL: "Tambahan Modal",
  PINJAMAN: "Pinjaman",
};

const STATUS_FILTER_OPTIONS: { value: DepositStatus | "ALL"; label: string }[] =
  [
    { value: "ALL", label: "Semua Status" },
    { value: "PENDING", label: "Menunggu" },
    { value: "VERIFIED", label: "Terverifikasi" },
    { value: "COMPLETED", label: "Selesai" },
    { value: "REJECTED", label: "Ditolak" },
  ];

function StatusBadge({ status }: { status: DepositStatus }) {
  const map: Record<DepositStatus, string> = {
    PENDING:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    VERIFIED:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    COMPLETED:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  const label: Record<DepositStatus, string> = {
    PENDING: "Menunggu",
    VERIFIED: "Terverifikasi",
    COMPLETED: "Selesai",
    REJECTED: "Ditolak",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}
    >
      {label[status]}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DepositsClient() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("investors:manage");

  const [statusFilter, setStatusFilter] = useState<DepositStatus | "ALL">(
    "PENDING",
  );
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    depositId: string;
    reason: string;
  }>({ isOpen: false, depositId: "", reason: "" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const {
    data: depositsData,
    isLoading,
    mutate: refetch,
  } = useApi<Deposit[]>("/api/admin/investors/deposits", {
    onError: () => toast.error("Gagal memuat data setoran"),
  });

  const allDeposits = depositsData ?? [];

  const filteredDeposits =
    statusFilter === "ALL"
      ? allDeposits
      : allDeposits.filter((d) => d.status === statusFilter);

  const pendingCount = allDeposits.filter((d) => d.status === "PENDING").length;
  const pendingTotal = allDeposits
    .filter((d) => d.status === "PENDING")
    .reduce((sum, d) => sum + d.amount, 0);

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function handleVerify(depositId: string) {
    setActionLoading(depositId + "_verify");
    try {
      const res = await fetch(
        `/api/admin/investors/deposits/${depositId}/verify`,
        { method: "POST" },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Setoran berhasil diverifikasi");
        void refetch();
      } else {
        toast.error(data.message || "Gagal memverifikasi setoran");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleComplete(depositId: string) {
    setActionLoading(depositId + "_complete");
    try {
      const res = await fetch(
        `/api/admin/investors/deposits/${depositId}/complete`,
        { method: "POST" },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Setoran berhasil diselesaikan");
        void refetch();
      } else {
        toast.error(data.message || "Gagal menyelesaikan setoran");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectModal.reason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setActionLoading(rejectModal.depositId + "_reject");
    try {
      const res = await fetch(
        `/api/admin/investors/deposits/${rejectModal.depositId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectModal.reason }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Setoran berhasil ditolak");
        setRejectModal({ isOpen: false, depositId: "", reason: "" });
        void refetch();
      } else {
        toast.error(data.message || "Gagal menolak setoran");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <HiOutlineArrowDownTray className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              Setoran Masuk Investor
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kelola dan verifikasi setoran modal dari investor
            </p>
          </div>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full blur-xl" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-indigo-200 text-sm font-medium mb-1">
              Total Setoran Menunggu Verifikasi
            </p>
            <p className="text-3xl font-black">
              {formatCurrency(pendingTotal)}
            </p>
            <p className="text-indigo-200 text-sm mt-1">
              {pendingCount} setoran menunggu tindakan
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 rounded-xl px-5 py-3">
            <HiOutlineClock className="w-8 h-8 text-yellow-300" />
            <div>
              <p className="text-2xl font-black">{pendingCount}</p>
              <p className="text-indigo-200 text-xs">Pending</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              statusFilter === opt.value
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-white dark:bg-[#1e293b] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-indigo-300"
            }`}
          >
            {opt.label}
            {opt.value !== "ALL" && (
              <span className="ml-1.5 opacity-70">
                ({allDeposits.filter((d) => d.status === opt.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <PageLoader variant="section" message="Memuat data setoran..." />
        ) : filteredDeposits.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <HiOutlineBanknotes className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Tidak ada setoran dengan status ini
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Investor
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jumlah
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jenis
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  {canManage && (
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredDeposits.map((deposit) => (
                  <tr
                    key={deposit.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {deposit.investor?.namaLengkap ?? "—"}
                      </div>
                      {deposit.investor?.perusahaan && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {deposit.investor.perusahaan}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {formatCurrency(deposit.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-gray-600 dark:text-gray-400">
                        {DEPOSIT_TYPE_LABEL[deposit.depositType]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {new Date(deposit.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={deposit.status} />
                      {deposit.status === "REJECTED" &&
                        deposit.rejectedReason && (
                          <p className="text-xs text-red-500 mt-1 max-w-[180px] truncate">
                            {deposit.rejectedReason}
                          </p>
                        )}
                    </td>
                    {canManage && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {deposit.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => handleVerify(deposit.id)}
                                disabled={
                                  actionLoading === deposit.id + "_verify"
                                }
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50"
                              >
                                {actionLoading === deposit.id + "_verify"
                                  ? "..."
                                  : "Verifikasi"}
                              </button>
                              <button
                                onClick={() =>
                                  setRejectModal({
                                    isOpen: true,
                                    depositId: deposit.id,
                                    reason: "",
                                  })
                                }
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-bold transition-all active:scale-95"
                              >
                                Tolak
                              </button>
                            </>
                          )}
                          {deposit.status === "VERIFIED" && (
                            <>
                              <button
                                onClick={() => handleComplete(deposit.id)}
                                disabled={
                                  actionLoading === deposit.id + "_complete"
                                }
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50"
                              >
                                {actionLoading === deposit.id + "_complete"
                                  ? "..."
                                  : "Selesaikan"}
                              </button>
                              <button
                                onClick={() =>
                                  setRejectModal({
                                    isOpen: true,
                                    depositId: deposit.id,
                                    reason: "",
                                  })
                                }
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-bold transition-all active:scale-95"
                              >
                                Tolak
                              </button>
                            </>
                          )}
                          {(deposit.status === "COMPLETED" ||
                            deposit.status === "REJECTED") && (
                            <span className="text-xs text-gray-400 italic">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() =>
          setRejectModal({ isOpen: false, depositId: "", reason: "" })
        }
        title="Tolak Setoran"
        size="sm"
      >
        <div className="py-2 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Berikan alasan penolakan setoran ini. Alasan akan dicatat dan dapat
            dilihat oleh admin.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Alasan Penolakan *
            </label>
            <textarea
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              placeholder="Contoh: Bukti transfer tidak valid..."
            />
          </div>
        </div>
        <ModalFooter>
          <button
            onClick={() =>
              setRejectModal({ isOpen: false, depositId: "", reason: "" })
            }
            disabled={actionLoading !== null}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleRejectSubmit}
            disabled={actionLoading !== null}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            {actionLoading !== null ? "Memproses..." : "Tolak Setoran"}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
