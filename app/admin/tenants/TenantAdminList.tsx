"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useCallback } from "react";
import {
  HiOutlineUserCircle,
  HiOutlinePlus,
  HiOutlineBuildingOffice,
  HiOutlineEnvelope,
  HiOutlinePhone,
  HiOutlinePencilSquare,
  HiOutlineTrash,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { toast } from "react-hot-toast";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { Modal, ModalFooter } from "@/components/ui/Modal";

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  isActive: boolean;
  role?: {
    name: string;
  };
}

interface Tenant {
  id: string;
  name: string;
}

export default function TenantAdminList({
  initialTenantId,
}: {
  initialTenantId: string | null;
}) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    initialTenantId || "",
  );
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    id: "", // For editing
    email: "",
    name: "",
    password: "",
    phone: "",
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tenants?active=true");
      const data = await res.json();
      if (res.ok) {
        const list = data.data || [];
        setTenants(list);
        if (!selectedTenantId && list.length > 0) {
          setSelectedTenantId(list[0].id);
        }
      }
    } catch (error) {
      clientLogger.error("Gagal memuat tenant aktif", error);
    }
  }, [selectedTenantId]);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/users?tenantId=${selectedTenantId}&roleName=ADMIN`,
      );
      const data = await res.json();
      if (res.ok) {
        setUsers(data.data?.users || data.users || []);
      } else {
        toast.error(data.error || "Gagal memuat admin");
      }
    } catch (error) {
      clientLogger.error("Gagal memuat data admin tenant", error);
      toast.error("Gagal memuat data admin");
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  const [hasFetchedTenants, setHasFetchedTenants] = useState(false);
  if (!hasFetchedTenants) {
    setHasFetchedTenants(true);
    void fetchTenants();
  }

  const [prevTenantId, setPrevTenantId] = useState<string | null>(null);
  if (prevTenantId !== selectedTenantId) {
    setPrevTenantId(selectedTenantId);
    if (selectedTenantId) {
      void fetchAdmins();
    } else {
      setUsers([]);
    }
  }

  const handleOpenCreate = () => {
    setIsEditMode(false);
    setFormData({ id: "", email: "", name: "", password: "", phone: "" });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setIsEditMode(true);
    setFormData({
      id: user.id,
      email: user.email,
      name: user.name || "",
      password: "", // Password empty when editing
      phone: user.phone || "",
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) return;

    setIsSaving(true);
    try {
      const url = isEditMode
        ? `/api/admin/users/${formData.id}`
        : "/api/admin/users";
      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          ...(formData.password && { password: formData.password }),
          phone: formData.phone || undefined,
          tenantId: selectedTenantId,
          isActive: true,
          // Default fields required by createUserSchema (only for POST)
          ...(!isEditMode && {
            isSales: false,
            workingHourMode: "FIXED",
            attendanceGeofencePolicy: "WARN",
            startWorkTime: "09:00",
            endWorkTime: "17:00",
            workDays: "Mon,Tue,Wed,Thu,Fri",
            flexibleTargetHour: 8,
          }),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          isEditMode
            ? "Administrator berhasil diperbarui"
            : "Administrator berhasil ditambahkan",
        );
        setIsFormOpen(false);
        setFormData({ id: "", email: "", name: "", password: "", phone: "" });
        fetchAdmins();
      } else {
        const errorMsg = data.details
          ? Object.values(data.details).join(", ")
          : data.error || "Gagal menyimpan admin";
        toast.error(errorMsg);
      }
    } catch (_error) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Admin berhasil dihapus");
        setUserToDelete(null);
        fetchAdmins();
      } else {
        const data = await res.json();
        toast.error(data.error || "Gagal menghapus admin");
      }
    } catch (_error) {
      toast.error("Kesalahan sistem saat menghapus");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Administrator",
      priority: "primary",
      className: "w-[40%]",
      render: (user) => (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-sm">
            {user.name ? (
              user.name.charAt(0).toUpperCase()
            ) : (
              <HiOutlineUserCircle className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user.name || "Tanpa Nama"}
              </p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 uppercase tracking-wider">
                {user.role?.name || "ADMIN"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Kontak",
      priority: "secondary",
      className: "w-[25%]",
      render: (user) => (
        <div className="flex flex-col gap-0.5">
          <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <HiOutlinePhone className="w-3.5 h-3.5 text-gray-400" />
            {user.phone || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "primary",
      className: "w-[20%]",
      render: (user) => (
        <div className="flex items-center">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              user.isActive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-amber-500"}`}
            ></span>
            {user.isActive ? "Aktif" : "Nonaktif"}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:shadow-md">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <HiOutlineBuildingOffice className="w-6 h-6" />
          </div>
          <div className="flex-1 max-w-sm">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">
              Pilih Tenant
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
            >
              <option value="">-- Pilih Tenant --</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedTenantId && (
            <div className="hidden sm:block text-right mr-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Total Admin
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {users.length}
              </p>
            </div>
          )}
          <button
            onClick={handleOpenCreate}
            disabled={!selectedTenantId}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Tambah Admin
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <PageLoader
            variant="section"
            message="Menyinkronkan data administrator..."
          />
        ) : !selectedTenantId ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-gray-50 dark:bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <HiOutlineBuildingOffice className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Kelola Administrator
            </h3>
            <p className="text-gray-500 max-w-xs mx-auto">
              Silakan pilih salah satu tenant untuk mengelola akun administrator
              sistem mereka.
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <HiOutlineUserCircle className="w-10 h-10 text-indigo-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Belum Ada Administrator
            </h3>
            <p className="text-gray-500 mb-8 max-w-xs mx-auto">
              Tenant ini belum memiliki akun admin. Buat akun pertama untuk
              memberikan akses panel.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-600 dark:border-indigo-500 font-bold rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
            >
              <HiOutlinePlus className="w-5 h-5" />
              Buat Admin Pertama
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveTable
              data={users}
              columns={columns}
              keyField="id"
              renderActions={(user) => (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(user)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                    title="Edit Profil"
                  >
                    <HiOutlinePencilSquare className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setUserToDelete(user)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="Hapus Akun"
                  >
                    <HiOutlineTrash className="w-5 h-5" />
                  </button>
                </div>
              )}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={`${isEditMode ? "Edit" : "Tambah"} Administrator Tenant`}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg mb-2">
            <p className="text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
              <HiOutlineBuildingOffice className="w-4 h-4" />
              Target Tenant:{" "}
              <span className="font-bold">
                {tenants.find((t) => t.id === selectedTenantId)?.name}
              </span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <HiOutlineEnvelope className="h-4 w-4 text-gray-400" />
              </span>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="email@tenant.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <HiOutlineUserCircle className="h-4 w-4 text-gray-400" />
              </span>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="Nama Administrator"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password{" "}
              {isEditMode && (
                <span className="text-xs text-gray-500">
                  (Kosongkan jika tidak ingin diubah)
                </span>
              )}{" "}
              {!isEditMode && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              required={!isEditMode}
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder={isEditMode ? "********" : "Minimal 8 karakter"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Telepon (Opsional)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <HiOutlinePhone className="h-4 w-4 text-gray-400" />
              </span>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="08xxxxxx"
              />
            </div>
          </div>

          <ModalFooter className="pt-4 mt-6">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving
                ? "Menyimpan..."
                : isEditMode
                  ? "Perbarui Admin"
                  : "Simpan Admin"}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        title="Konfirmasi Hapus"
        size="sm"
      >
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Apakah Anda yakin ingin menghapus administrator{" "}
            <span className="font-bold text-gray-900 dark:text-white">
              {userToDelete?.name}
            </span>
            ? Tindakan ini tidak dapat dibatalkan.
          </p>
          <ModalFooter className="mt-6">
            <button
              type="button"
              onClick={() => setUserToDelete(null)}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDeleteUser}
              disabled={isDeleting}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
