"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HiOutlineScale } from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";

interface Recon {
  id: string;
  coaId: string;
  statementDate: string;
  statementBalance: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Selesai",
  DRAFT: "Dalam Proses",
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DRAFT:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
};

export function RekonsiliasiListClient() {
  const router = useRouter();
  const [items, setItems] = useState<Recon[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounting/reconciliation");
    if (res.ok) {
      const data = await res.json();
      setItems(data.data || []);
    }
    setLoading(false);
  }, []);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchData();
  }, [fetchData]);

  if (loading) return <div className="p-6 text-gray-500">Memuat...</div>;

  const selesai = items.filter((i) => i.status === "COMPLETED").length;
  const dalamProses = items.filter((i) => i.status !== "COMPLETED").length;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
          <HiOutlineScale className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Rekonsiliasi Bank
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cocokkan mutasi bank dengan catatan jurnal
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl" />
        <p className="text-sm font-semibold text-indigo-200 uppercase tracking-widest mb-1">
          Total Sesi
        </p>
        <p className="text-5xl font-black">{items.length}</p>
        <p className="text-indigo-200 text-sm mt-1">
          sesi rekonsiliasi tercatat
        </p>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Selesai
          </p>
          <p className="text-xl font-black font-mono text-green-600 dark:text-green-400">
            {selesai}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Dalam Proses
          </p>
          <p className="text-xl font-black font-mono text-yellow-600 dark:text-yellow-400">
            {dalamProses}
          </p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 text-center text-gray-500 dark:text-gray-400">
            Belum ada sesi rekonsiliasi
          </div>
        ) : (
          items.map((r) => (
            <div
              key={r.id}
              className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
              onClick={() =>
                router.push(`/admin/akuntansi/rekonsiliasi/${r.id}`)
              }
            >
              <div>
                <div className="font-bold text-gray-900 dark:text-white">
                  {new Date(r.statementDate).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Saldo Statement: {formatCurrency(Number(r.statementBalance))}
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[r.status] ?? STATUS_COLORS.DRAFT}`}
              >
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
