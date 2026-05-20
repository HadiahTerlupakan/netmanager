"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineScale,
  HiOutlineCheckCircle,
  HiOutlineClock,
} from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";

interface Recon {
  id: string;
  coaId: string;
  statementDate: string;
  statementBalance: string;
  status: string;
}

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

  const completedCount = items.filter((r) => r.status === "COMPLETED").length;
  const draftCount = items.filter((r) => r.status !== "COMPLETED").length;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlineScale className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            Bank Reconciliation
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cocokkan mutasi bank dengan catatan jurnal akuntansi
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Sesi
          </p>
          <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {items.length}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Selesai
          </p>
          <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {completedCount}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Dalam Proses
          </p>
          <h3 className="text-xl font-black text-yellow-600 dark:text-yellow-400 font-mono">
            {draftCount}
          </h3>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-gray-100 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Memuat...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-gray-100 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Belum ada sesi rekonsiliasi
            </p>
          </div>
        ) : (
          items.map((r) => (
            <div
              key={r.id}
              onClick={() =>
                router.push(`/admin/akuntansi/rekonsiliasi/${r.id}`)
              }
              className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
            >
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                  {new Date(r.statementDate).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Saldo Statement:{" "}
                  <span className="font-mono font-bold">
                    {formatCurrency(Number(r.statementBalance))}
                  </span>
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                  r.status === "COMPLETED"
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                }`}
              >
                {r.status === "COMPLETED" ? (
                  <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <HiOutlineClock className="w-3.5 h-3.5" />
                )}
                {r.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
