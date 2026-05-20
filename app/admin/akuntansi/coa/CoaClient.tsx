"use client";

import { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { HiPlus, HiOutlineTrash, HiOutlinePencil } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Modal, ModalBody } from "@/components/ui/Modal";

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

const TYPE_COLORS: Record<string, string> = {
  ASSET: "text-blue-700",
  LIABILITY: "text-orange-700",
  EQUITY: "text-purple-700",
  REVENUE: "text-green-700",
  EXPENSE: "text-red-700",
};

export function CoaClient() {
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

  useState(() => {
    fetchData();
  });

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

  if (loading) return <div className="p-4">Memuat...</div>;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Chart of Accounts</h1>
        <Button onClick={() => setShowModal(true)}>
          <HiPlus className="mr-1 h-4 w-4" />
          Tambah Akun
        </Button>
      </div>

      <select
        className="rounded border px-3 py-1.5 text-sm"
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
      >
        <option value="">Semua Tipe</option>
        <option value="ASSET">Asset</option>
        <option value="LIABILITY">Liability</option>
        <option value="EQUITY">Equity</option>
        <option value="REVENUE">Revenue</option>
        <option value="EXPENSE">Expense</option>
      </select>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-4 py-2">Kode</th>
            <th className="px-4 py-2">Nama</th>
            <th className="px-4 py-2">Tipe</th>
            <th className="px-4 py-2">Normal</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((coa) => (
            <tr key={coa.id} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2 font-mono">{coa.code}</td>
              <td className="px-4 py-2">{coa.name}</td>
              <td
                className={`px-4 py-2 font-medium ${TYPE_COLORS[coa.type] || ""}`}
              >
                {coa.type}
              </td>
              <td className="px-4 py-2">{coa.normalSide}</td>
              <td className="px-4 py-2">
                {coa.isSystem && (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                    System
                  </span>
                )}
                {!coa.isActive && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    Inactive
                  </span>
                )}
              </td>
              <td className="px-4 py-2">
                {!coa.isSystem && (
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(coa.id)}
                  >
                    <HiOutlineTrash className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <Modal isOpen onClose={() => setShowModal(false)} title="Tambah Akun">
          <ModalBody>
            <div className="space-y-3">
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="Kode (misal: 1-150)"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="Nama akun"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <select
                className="w-full rounded border px-3 py-2"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="ASSET">Asset</option>
                <option value="LIABILITY">Liability</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSE">Expense</option>
              </select>
              <Button
                onClick={handleCreate}
                disabled={!form.code || !form.name}
              >
                Simpan
              </Button>
            </div>
          </ModalBody>
        </Modal>
      )}
    </div>
  );
}
