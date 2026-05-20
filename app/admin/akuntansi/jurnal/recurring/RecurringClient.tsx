"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineArrowPath, HiOutlineTrash } from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";
import ResponsiveTable from "@/components/ui/ResponsiveTable";

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

  const activeCount = items.filter((i) => i.isActive).length;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlineArrowPath className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            Recurring Journal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Template jurnal otomatis yang dijalankan secara berkala
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Total Template
          </p>
          <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {items.length}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Aktif
          </p>
          <h3 className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {activeCount}
          </h3>
        </div>
        <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Nonaktif
          </p>
          <h3 className="text-xl font-black text-gray-600 dark:text-gray-400 font-mono">
            {items.length - activeCount}
          </h3>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
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
                <span className="font-bold text-sm text-gray-900 dark:text-white">
                  {item.name}
                </span>
              ),
            },
            {
              key: "frequency",
              header: "Frekuensi",
              priority: "primary",
              render: (item: Template) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                  {item.frequency}
                </span>
              ),
            },
            {
              key: "dayOfMonth",
              header: "Tanggal",
              priority: "secondary",
              render: (item: Template) => (
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                    item.isActive
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {item.isActive ? "Active" : "Inactive"}
                </button>
              ),
            },
            {
              key: "lastGeneratedAt",
              header: "Terakhir Generate",
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
            <div className="flex items-center justify-end gap-2">
              {canDelete && (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  title="Hapus"
                >
                  <HiOutlineTrash className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
          emptyMessage="Belum ada template recurring journal."
        />
      </div>
    </div>
  );
}
