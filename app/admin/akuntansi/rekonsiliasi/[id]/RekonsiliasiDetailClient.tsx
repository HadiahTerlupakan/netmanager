"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { HiOutlineScale } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { formatCurrency } from "@/lib/utils";

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

const MATCH_LABEL: Record<string, string> = {
  MATCHED: "Cocok",
  AUTO_MATCHED: "Cocok Otomatis",
  UNMATCHED: "Belum Cocok",
};

const MATCH_COLORS: Record<string, string> = {
  MATCHED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  AUTO_MATCHED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  UNMATCHED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
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
      {
        method: "POST",
      },
    );
    if (res.ok) {
      toast.success("Rekonsiliasi selesai");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal");
    }
  };

  if (loading) return <div className="p-6 text-gray-500">Memuat...</div>;
  if (!recon) return <div className="p-6 text-gray-500">Tidak ditemukan</div>;

  const matched = recon.lines.filter((l) => l.matchStatus !== "UNMATCHED");
  const unmatched = recon.lines.filter((l) => l.matchStatus === "UNMATCHED");

  const statusLabel = recon.status === "COMPLETED" ? "Selesai" : "Dalam Proses";
  const statusColor =
    recon.status === "COMPLETED"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
            <HiOutlineScale className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
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
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusColor}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Cocok
          </p>
          <p className="text-xl font-black font-mono text-green-600 dark:text-green-400">
            {matched.length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Belum Cocok
          </p>
          <p className="text-xl font-black font-mono text-red-600 dark:text-red-400">
            {unmatched.length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Saldo Statement
          </p>
          <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
            {formatCurrency(Number(recon.statementBalance))}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Saldo Buku
          </p>
          <p className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">
            {formatCurrency(Number(recon.bookBalance))}
          </p>
        </div>
      </div>

      {/* Table */}
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
                <span className="text-sm">
                  {new Date(item.bankRefDate).toLocaleDateString("id-ID")}
                </span>
              ),
            },
            {
              key: "bankRefDescription",
              header: "Deskripsi",
              priority: "primary",
              render: (item: ReconLine) => (
                <span className="text-sm">{item.bankRefDescription}</span>
              ),
            },
            {
              key: "bankRefAmount",
              header: "Jumlah",
              priority: "primary",
              align: "right",
              render: (item: ReconLine) => (
                <span className="font-mono font-medium">
                  {formatCurrency(Number(item.bankRefAmount))}
                </span>
              ),
            },
            {
              key: "matchStatus",
              header: "Status",
              priority: "primary",
              align: "center",
              render: (item: ReconLine) => (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${MATCH_COLORS[item.matchStatus] ?? MATCH_COLORS.UNMATCHED}`}
                >
                  {MATCH_LABEL[item.matchStatus] ?? item.matchStatus}
                </span>
              ),
            },
          ]}
          emptyMessage="Tidak ada baris rekonsiliasi."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-gray-700 dark:text-gray-300"
        >
          Kembali
        </button>
        {canManage && recon.status === "DRAFT" && (
          <Button onClick={handleComplete}>Selesaikan Rekonsiliasi</Button>
        )}
      </div>
    </div>
  );
}
