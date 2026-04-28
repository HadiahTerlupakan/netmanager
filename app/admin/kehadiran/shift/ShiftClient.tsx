"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect } from "react";
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { usePermission } from "@/hooks/use-permission";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import toast from "react-hot-toast";

interface Shift {
  id: string;
  name: string;
  code: string | null;
  startTime: string;
  endTime: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ShiftClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("shift:create");
  const canUpdate = hasPermission("shift:update");
  const canDelete = hasPermission("shift:delete");

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    startTime: "08:00",
    endTime: "17:00",
    description: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/shifts?includeInactive=true");
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const responseData = await res.json();
      // apiSuccess returns { success: true, data: [...] }
      // If it's a direct array (legacy), use it directly. Otherwise use .data
      const shiftsData = Array.isArray(responseData)
        ? responseData
        : responseData.data || [];
      setShifts(shiftsData);
    } catch (err: unknown) {
      clientLogger.error("Error fetching shifts:", err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingShift(null);
    setFormData({
      name: "",
      code: "",
      startTime: "08:00",
      endTime: "17:00",
      description: "",
    });
    setError("");
    setShowModal(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      code: shift.code || "",
      startTime: shift.startTime,
      endTime: shift.endTime,
      description: shift.description || "",
    });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    // Simple client-side validation
    if (formData.startTime >= formData.endTime) {
      setError(
        "Jam Pulang harus lebih besar dari Jam Masuk (kecuali lintas hari, fitur belum didukung)",
      );
      toast.error("Jam kerja tidak valid");
      setSaving(false);
      return;
    }

    try {
      const url = editingShift
        ? `/api/admin/shifts/${editingShift.id}`
        : "/api/admin/shifts";

      const method = editingShift ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        // Improve error message for duplicates
        if (data.error && data.error.includes("already exists")) {
          throw new Error(
            "Kode Shift sudah digunakan (mungkin oleh shift yang nonaktif/diarsip). Gunakan kode lain.",
          );
        }
        throw new Error(data.error || "Gagal menyimpan");
      }

      toast.success(
        editingShift ? "Shift berhasil diperbarui" : "Shift berhasil dibuat",
      );
      setShowModal(false);
      await fetchShifts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (shift: Shift) => {
    if (!confirm(`Hapus shift "${shift.name}"?`)) return;

    try {
      // Try Hard Delete first (force=false)
      let res = await fetch(`/api/admin/shifts/${shift.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();

        // If it failed because it's in use (likely 400 Bad Request from Service)
        // We ask user if they want to soft delete (archive) instead
        if (data.error && data.error.includes("assigned to")) {
          if (
            confirm(
              `Shift ini sedang digunakan oleh karyawan. Nonaktifkan (Archive) saja?`,
            )
          ) {
            res = await fetch(`/api/admin/shifts/${shift.id}?force=true`, {
              method: "DELETE",
            });
          } else {
            return; // User cancelled
          }
        } else {
          throw new Error(data.error || "Gagal menghapus");
        }
      }

      // Check result of the second attempt (if any)
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal menghapus");
      }

      toast.success("Shift berhasil dihapus");
      fetchShifts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      toast.error(msg);
    }
  };

  const toggleActive = async (shift: Shift) => {
    try {
      const res = await fetch(`/api/admin/shifts/${shift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !shift.isActive }),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast.success(`Shift ${shift.isActive ? "dinonaktifkan" : "diaktifkan"}`);
      fetchShifts();
    } catch (err) {
      clientLogger.error("Error toggling status:", err);
      toast.error("Gagal mengubah status shift");
    }
  };

  const columns: Column<Shift>[] = [
    {
      key: "name",
      header: "Nama Shift",
      priority: "primary",
      render: (shift) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {shift.name}
          </div>
          {shift.code && (
            <div className="text-xs text-gray-500">{shift.code}</div>
          )}
        </div>
      ),
    },
    {
      key: "startTime",
      header: "Jam Kerja",
      priority: "primary",
      render: (shift) => (
        <span className="text-sm font-mono">
          {shift.startTime} - {shift.endTime}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "secondary",
      render: (shift) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            shift.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          }`}
        >
          {shift.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    {
      key: "description",
      header: "Keterangan",
      priority: "tertiary",
      render: (shift) => (
        <span className="text-sm text-gray-500 truncate max-w-xs">
          {shift.description || "-"}
        </span>
      ),
    },
  ];

  const renderActions = (shift: Shift) => (
    <div className="flex gap-2">
      {canUpdate && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openEditModal(shift)}
            title="Edit"
          >
            <HiOutlinePencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleActive(shift)}
            title={shift.isActive ? "Nonaktifkan" : "Aktifkan"}
          >
            <HiOutlineArrowPath className="w-4 h-4" />
          </Button>
        </>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleDelete(shift)}
          title="Hapus"
        >
          <HiOutlineTrash className="w-4 h-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Shift
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola jadwal shift kerja karyawan
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreateModal}>
            <HiOutlinePlus className="w-5 h-5" />
            Tambah Shift
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <ResponsiveTable
          data={shifts}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Belum ada data shift"
          loadingMessage="Memuat data..."
          renderActions={canUpdate || canDelete ? renderActions : undefined}
        />
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingShift ? "Edit Shift" : "Tambah Shift Baru"}
        description="Atur jadwal jam kerja untuk shift ini."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Nama Shift *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Pagi"
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Kode Shift
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="S1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Jam Masuk *
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Jam Pulang *
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Keterangan
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              rows={2}
              placeholder="Deskripsi shift (opsional)"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowModal(false)}
            >
              Batal
            </Button>
            <Button type="submit" loading={saving}>
              Simpan
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
