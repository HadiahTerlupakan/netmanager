"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineTrash, HiOutlineArrowPath } from "react-icons/hi2";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";

interface Template {
  id: string;
  name: string;
  frequency: string;
  dayOfMonth: number;
  isActive: boolean;
  lastGeneratedAt: string | null;
}

export function RecurringClient() {
  const { hasPermission } = usePermission();
  const canDelete = hasPermission("recurring:manage");

  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accounting/recurring");
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

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus template ini?")) return;
    const res = await fetch(`/api/admin/accounting/recurring/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Template dihapus");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal menghapus");
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/accounting/recurring/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (res.ok) {
      fetchData();
    }
  };

  const countActive = items.filter((i) => i.isActive).length;
  const countInactive = items.filter((i) => !i.isActive).length;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl shrink-0">
          <HiOutlineArrowPath className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Jurnal Berulang
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Template jurnal otomatis yang dijalankan berkala
          </p>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-4 -mt-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl" />
        <p className="text-sm font-semibold text-indigo-200 mb-1">
          Total Template
        </p>
        <p className="text-4xl font-black">{items.length}</p>
        <p className="text-indigo-200 text-sm mt-1">
          template jurnal berulang terdaftar
        </p>
      </div>

      {/* Mini Stat Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Aktif
          </p>
          <p className="text-xl font-black font-mono text-green-600 dark:text-green-400">
            {countActive}
          </p>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Nonaktif
          </p>
          <p className="text-xl font-black font-mono text-gray-500 dark:text-gray-400">
            {countInactive}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-3">
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Daftar Template
          </h2>
        </div>
        <ResponsiveTable
          data={items}
          loading={loading}
          keyField="id"
          columns={[
            {
              key: "name",
              header: "Nama Template",
              priority: "primary",
              render: (item: Template) => (
                <span className="font-bold text-gray-900 dark:text-white">
                  {item.name}
                </span>
              ),
            },
            {
              key: "frequency",
              header: "Frekuensi",
              priority: "primary",
              render: (item: Template) => (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  {item.frequency}
                </span>
              ),
            },
            {
              key: "dayOfMonth",
              header: "Tanggal",
              priority: "secondary",
              render: (item: Template) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Tgl {item.dayOfMonth}
                </span>
              ),
            },
            {
              key: "isActive",
              header: "Status",
              priority: "primary",
              render: (item: Template) => (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(item.id, item.isActive);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors ${
                    item.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {item.isActive ? "Aktif" : "Nonaktif"}
                </button>
              ),
            },
            {
              key: "lastGeneratedAt",
              header: "Terakhir Dibuat",
              priority: "tertiary",
              render: (item: Template) => (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {item.lastGeneratedAt
                    ? new Date(item.lastGeneratedAt).toLocaleDateString("id-ID")
                    : "—"}
                </span>
              ),
            },
          ]}
          renderActions={(item: Template) => (
            <>
              {canDelete && (
                <button
                  className="text-red-500 hover:text-red-700 p-1 transition-colors"
                  onClick={() => handleDelete(item.id)}
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              )}
            </>
          )}
          emptyMessage="Belum ada template jurnal berulang."
        />
      </div>
    </div>
  );
}
