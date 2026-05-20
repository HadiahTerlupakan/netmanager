"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineListBullet, HiPlus, HiOutlineTrash } from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";
import { Modal, ModalBody } from "@/components/ui/Modal";
import ResponsiveTable from "@/components/ui/ResponsiveTable";

interface Coa {
  id: string;
  code: string;
  name: string;
  type: string;
  normalSide: string;
  isPostable: boolean;
  isSystem: boolean;
  isActive: boolean;
  parentId: string | null;
}

const TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  ASSET: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
  },
  LIABILITY: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
  },
  EQUITY: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
  },
  REVENUE: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  EXPENSE: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
  },
};

export function CoaClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("coa:create");
  const canDelete = hasPermission("coa:delete");

  const [items, setItems] = useState<Coa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "ASSET",
    parentId: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = filterType ? `?type=${filterType}` : "";
    const res = await fetch(`/api/admin/accounting/coa${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.data || []);
    }
    setLoading(false);
  }, [filterType]);

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    const res = await fetch("/api/admin/accounting/coa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        name: form.name,
        type: form.type,
        parentId: form.parentId || null,
      }),
    });
    if (res.ok) {
      toast.success("Akun berhasil ditambahkan");
      setShowModal(false);
      setForm({ code: "", name: "", type: "ASSET", parentId: "" });
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal menambah akun");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus akun ini?")) return;
    const res = await fetch(`/api/admin/accounting/coa/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Akun dihapus");
      fetchData();
    } else {
      const err = await res.json();
      toast.error(err.error || "Gagal menghapus");
    }
  };

  const countByType = (type: string) =>
    items.filter((i) => i.type === type).length;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
              <HiOutlineListBullet className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            Chart of Accounts
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola daftar akun untuk pencatatan transaksi keuangan
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95"
          >
            <HiPlus className="w-5 h-5" />
            Tambah Akun
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <div
            key={type}
            className="bg-white dark:bg-[#1e293b] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
          >
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
              {type}
            </p>
            <h3 className={`text-xl font-black font-mono ${cfg.text}`}>
              {countByType(type)}
            </h3>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3">
        <select
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
          }}
        >
          <option value="">Semua Tipe</option>
          <option value="ASSET">Asset</option>
          <option value="LIABILITY">Liability</option>
          <option value="EQUITY">Equity</option>
          <option value="REVENUE">Revenue</option>
          <option value="EXPENSE">Expense</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
        <ResponsiveTable
          data={items}
          loading={loading}
          keyField="id"
          columns={[
            {
              key: "code",
              header: "Kode",
              priority: "primary",
              render: (item: Coa) => (
                <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                  {item.code}
                </span>
              ),
            },
            {
              key: "name",
              header: "Nama Akun",
              priority: "primary",
              render: (item: Coa) => (
                <span className="font-semibold text-sm text-gray-900 dark:text-white">
                  {item.name}
                </span>
              ),
            },
            {
              key: "type",
              header: "Tipe",
              priority: "primary",
              render: (item: Coa) => {
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.ASSET;
                return (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}
                  >
                    {item.type}
                  </span>
                );
              },
            },
            {
              key: "normalSide",
              header: "Normal",
              priority: "secondary",
              render: (item: Coa) => (
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {item.normalSide}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              priority: "secondary",
              render: (item: Coa) => (
                <div className="flex gap-1.5">
                  {item.isSystem && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      System
                    </span>
                  )}
                  {!item.isActive && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      Inactive
                    </span>
                  )}
                </div>
              ),
            },
          ]}
          renderActions={(item: Coa) => (
            <div className="flex items-center justify-end gap-2">
              {canDelete && !item.isSystem && (
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
          emptyMessage="Belum ada akun yang terdaftar."
        />
      </div>

      {/* Create Modal */}
      {showModal && (
        <Modal
          isOpen
          onClose={() => setShowModal(false)}
          title="Tambah Akun Baru"
        >
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Kode Akun
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Misal: 1-150"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Nama Akun
                </label>
                <input
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Nama akun"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Tipe
                </label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="ASSET">Asset</option>
                  <option value="LIABILITY">Liability</option>
                  <option value="EQUITY">Equity</option>
                  <option value="REVENUE">Revenue</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <button
                onClick={handleCreate}
                disabled={!form.code || !form.name}
                className="w-full px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all font-bold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Simpan
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
