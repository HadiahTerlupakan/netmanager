"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  HiOutlineCalendarDays,
  HiOutlineLockClosed,
  HiOutlineLockOpen,
} from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  startDate: string;
  endDate: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  OPEN: {
    label: "Open",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  CLOSING: {
    label: "Closing",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
  },
  CLOSED: {
    label: "Closed",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
  },
  REOPENED: {
    label: "Reopened",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
  },
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

  const openCount = periods.filter(
    (p) => p.status === "OPEN" || p.status === "REOPENED",
  ).length;
  const closedCount = periods.filter((p) => p.status === "CLOSED").length;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlineCalendarDays className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            Periode Akuntansi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola periode tutup buku dan pembukaan kembali
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Periode
          </p>
          <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {periods.length}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Terbuka
          </p>
          <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {openCount}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Tertutup
          </p>
          <h3 className="text-xl font-black text-red-600 dark:text-red-400 font-mono">
            {closedCount}
          </h3>
        </div>
      </div>

      {/* Period List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-gray-100 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Memuat...
            </p>
          </div>
        ) : periods.length === 0 ? (
          <div className="bg-white dark:bg-[#1e293b] p-8 rounded-2xl border border-gray-100 dark:border-gray-800 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Belum ada periode. Periode akan dibuat otomatis saat jurnal
              pertama di-post.
            </p>
          </div>
        ) : (
          periods.map((p) => {
            const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.OPEN;
            return (
              <div
                key={p.id}
                className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-between"
              >
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    {MONTHS[p.month - 1]} {p.year}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(p.startDate).toLocaleDateString("id-ID")} —{" "}
                    {new Date(p.endDate).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}
                  >
                    {cfg.label}
                  </span>
                  {canManage &&
                    (p.status === "OPEN" || p.status === "REOPENED") && (
                      <button
                        onClick={() => handleClose(p.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      >
                        <HiOutlineLockClosed className="w-4 h-4" />
                        Tutup Buku
                      </button>
                    )}
                  {canManage && p.status === "CLOSED" && (
                    <button
                      onClick={() => handleReopen(p.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                    >
                      <HiOutlineLockOpen className="w-4 h-4" />
                      Buka Kembali
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
