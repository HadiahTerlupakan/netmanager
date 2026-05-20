"use client";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { HiPlus, HiOutlineTrash } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";

interface Template {
  id: string;
  name: string;
  frequency: string;
  dayOfMonth: number;
  isActive: boolean;
  lastGeneratedAt: string | null;
}

export function RecurringClient() {
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

  useState(() => {
    fetchData();
  });

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

  if (loading) return <div className="p-4">Memuat...</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Recurring Journal Templates</h1>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-4 py-2">Nama</th>
            <th className="px-4 py-2">Frekuensi</th>
            <th className="px-4 py-2">Tanggal</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Terakhir Generate</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id} className="border-b">
              <td className="px-4 py-2 font-medium">{t.name}</td>
              <td className="px-4 py-2">{t.frequency}</td>
              <td className="px-4 py-2">Tgl {t.dayOfMonth}</td>
              <td className="px-4 py-2">
                <button
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                  onClick={() => handleToggle(t.id, t.isActive)}
                >
                  {t.isActive ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="px-4 py-2 text-gray-500">
                {t.lastGeneratedAt
                  ? new Date(t.lastGeneratedAt).toLocaleDateString("id-ID")
                  : "—"}
              </td>
              <td className="px-4 py-2">
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => handleDelete(t.id)}
                >
                  <HiOutlineTrash className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                Belum ada template recurring
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
