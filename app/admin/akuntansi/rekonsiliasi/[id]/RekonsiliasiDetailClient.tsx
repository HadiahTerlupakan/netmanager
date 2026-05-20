"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  HiOutlineScale,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineArrowLeft,
} from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";
import { formatCurrency } from "@/lib/utils";
import ResponsiveTable from "@/components/ui/ResponsiveTable";

interface ReconLine {
  id: string;
  bankRefDate: string;
  bankRefDescription: string;
  bankRefAmount: string;
  matchStatus: string;
}

interface Recon {
  id: string;
  statementDate: string;
  statementBalance: string;
  bookBalance: string;
  reconciledBalance: string;
  status: string;
  lines: ReconLine[];
}

const MATCH_CONFIG: Record<string, { bg: string; text: string }> = {
  MATCHED: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  AUTO_MATCHED: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
  },
  UNMATCHED: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
  },
};

export function RekonsiliasiDetailClient() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = usePermission();
  const canManage = hasPermission("reconciliation:manage");

  const [recon, setRecon] = useState<Recon | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/accounting/reconciliation/${id}`);
    if (res.ok) {
      const data = await res.json();
      setRecon(data.data);
    }
    setLoading(false);
  }, [id]);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchData();
  }, [fetchData]);

  const handleComplete = async () => {
    if (!confirm("Selesaikan rekonsiliasi ini?")) return;
    const res = await fetch(
      `/api/admin/accounting/reconciliation/${id}/complete`,
      { method: "POST" },
    );
    if (res.ok) {
      toast.success("Rekonsiliasi selesai");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal");
    }
  };

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Memuat...
        </p>
      </div>
    );
  }

  if (!recon) {
    return (
      <div className="p-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Tidak ditemukan
        </p>
      </div>
    );
  }

  const matched = recon.lines.filter((l) => l.matchStatus !== "UNMATCHED");
  const unmatched = recon.lines.filter((l) => l.matchStatus === "UNMATCHED");

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlineScale className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            Detail Rekonsiliasi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date(recon.statementDate).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
            recon.status === "COMPLETED"
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
          }`}
        >
          {recon.status === "COMPLETED" ? (
            <HiOutlineCheckCircle className="w-4 h-4" />
          ) : (
            <HiOutlineXCircle className="w-4 h-4" />
          )}
          {recon.status}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Matched
          </p>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {matched.length}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Unmatched
          </p>
          <h3 className="text-2xl font-black text-red-600 dark:text-red-400 font-mono">
            {unmatched.length}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Saldo Statement
          </p>
          <h3 className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {formatCurrency(Number(recon.statementBalance))}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Saldo Buku
          </p>
          <h3 className="text-lg font-black text-gray-700 dark:text-gray-300 font-mono">
            {formatCurrency(Number(recon.bookBalance))}
          </h3>
        </div>
      </div>

      {/* Lines Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        <ResponsiveTable
          data={recon.lines}
          keyField="id"
          columns={[
            {
              key: "bankRefDate",
              header: "Tanggal",
              priority: "primary",
              render: (item: ReconLine) => (
                <span className="font-semibold text-sm">
                  {new Date(item.bankRefDate).toLocaleDateString("id-ID")}
                </span>
              ),
            },
            {
              key: "bankRefDescription",
              header: "Deskripsi",
              priority: "primary",
              render: (item: ReconLine) => (
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {item.bankRefDescription}
                </span>
              ),
            },
            {
              key: "bankRefAmount",
              header: "Amount",
              priority: "primary",
              render: (item: ReconLine) => (
                <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                  {formatCurrency(Number(item.bankRefAmount))}
                </span>
              ),
            },
            {
              key: "matchStatus",
              header: "Status",
              priority: "primary",
              render: (item: ReconLine) => {
                const cfg =
                  MATCH_CONFIG[item.matchStatus] || MATCH_CONFIG.UNMATCHED;
                return (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}
                  >
                    {item.matchStatus}
                  </span>
                );
              },
            },
          ]}
          emptyMessage="Tidak ada baris rekonsiliasi."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          <HiOutlineArrowLeft className="w-4 h-4" />
          Kembali
        </button>
        {canManage && recon.status === "DRAFT" && (
          <button
            onClick={handleComplete}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95"
          >
            <HiOutlineCheckCircle className="w-5 h-5" />
            Selesaikan Reconciliation
          </button>
        )}
      </div>
    </div>
  );
}
