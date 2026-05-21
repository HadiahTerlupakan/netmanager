"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineCalendarDays } from "react-icons/hi2";

import { usePermission } from "@/hooks/use-permission";

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  startDate: string;
  endDate: string;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Terbuka",
  CLOSING: "Sedang Ditutup",
  CLOSED: "Tertutup",
  REOPENED: "Dibuka Kembali",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  CLOSING:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  CLOSED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  REOPENED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function PeriodeClient() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("period:manage");

  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounting/period");
    if (res.ok) {
      const data = await res.json();
      setPeriods(data.data || []);
    }
    setLoading(false);
  }, []);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchData();
  }, [fetchData]);

  const handleClose = async (id: string) => {
    if (
      !confirm(
        "Tutup buku periode ini? Jurnal tidak bisa ditambah setelah ditutup.",
      )
    )
      return;
    const res = await fetch(`/api/admin/accounting/period/${id}/close`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Periode berhasil ditutup");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal tutup buku");
    }
  };

  const handleReopen = async (id: string) => {
    if (!confirm("Buka kembali periode ini?")) return;
    const res = await fetch(`/api/admin/accounting/period/${id}/reopen`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Periode dibuka kembali");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal membuka periode");
    }
  };

  const countByStatus = (status: string) =>
    periods.filter((p) => p.status === status).length;

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120] flex items-center justify-center">
        <span className="text-gray-500 dark:text-gray-400">Memuat...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl shrink-0">
          <HiOutlineCalendarDays className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Periode Akuntansi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola periode tutup buku
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl" />
        <p className="text-sm font-semibold text-indigo-200 mb-1">
          Total Periode
        </p>
        <p className="text-4xl font-black">{periods.length}</p>
        <p className="text-indigo-200 text-sm mt-1">
          periode terdaftar dalam sistem
        </p>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Terbuka
          </p>
          <p className="text-xl font-black font-mono text-green-600 dark:text-green-400">
            {countByStatus("OPEN") + countByStatus("REOPENED")}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Tertutup
          </p>
          <p className="text-xl font-black font-mono text-red-600 dark:text-red-400">
            {countByStatus("CLOSED")}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Sedang Ditutup
          </p>
          <p className="text-xl font-black font-mono text-yellow-600 dark:text-yellow-400">
            {countByStatus("CLOSING")}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Dibuka Kembali
          </p>
          <p className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
            {countByStatus("REOPENED")}
          </p>
        </div>
      </div>

      {/* Period List */}
      <div className="space-y-3">
        {periods.length === 0 ? (
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 text-center text-gray-500 dark:text-gray-400">
            Belum ada periode. Periode akan dibuat otomatis saat jurnal pertama
            di-post.
          </div>
        ) : (
          periods.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-[#1e293b] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl shrink-0">
                  <HiOutlineCalendarDays className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="font-black text-gray-900 dark:text-white">
                    {MONTHS[p.month - 1]} {p.year}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(p.startDate).toLocaleDateString("id-ID")} —{" "}
                    {new Date(p.endDate).toLocaleDateString("id-ID")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[p.status] || ""}`}
                >
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
                {canManage &&
                  (p.status === "OPEN" || p.status === "REOPENED") && (
                    <button
                      className="px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      onClick={() => handleClose(p.id)}
                    >
                      Tutup Buku
                    </button>
                  )}
                {canManage && p.status === "CLOSED" && (
                  <button
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-gray-700 dark:text-gray-300"
                    onClick={() => handleReopen(p.id)}
                  >
                    Buka Kembali
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
