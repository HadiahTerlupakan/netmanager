"use client";

import { clientLogger } from "@/lib/client-logger";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineBuildingOffice,
  HiOutlineGlobeAlt,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { toast } from "react-hot-toast";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { useApi } from "@/lib/hooks/useApi";

interface Tenant {
  id: string;
  name: string;
  domain: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function TenantList({
  onViewAdmins,
}: {
  onViewAdmins: (tenantId: string) => void;
}) {
  const {
    data: tenantsRaw,
    error: tenantsError,
    isLoading: loading,
    mutate: mutateTenants,
  } = useApi<{ data?: Tenant[] } | Tenant[]>("/api/admin/tenants");

  useEffect(() => {
    if (tenantsError) {
      clientLogger.error("Gagal memuat data tenant", tenantsError);
      toast.error(tenantsError.message || "Gagal memuat tenant");
    }
  }, [tenantsError]);

  const tenants: Tenant[] = Array.isArray(tenantsRaw)
    ? tenantsRaw
    : (tenantsRaw?.data ?? []);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    domain: "",
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenCreate = () => {
    setFormData({
      id: "",
      name: "",
      domain: "",
      isActive: true,
    });
    setIsEdit(false);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (tenant: Tenant) => {
    setFormData({
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain || "",
      isActive: tenant.isActive,
    });
    setIsEdit(true);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/tenants/${formData.id}`
        : "/api/admin/tenants";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          domain: formData.domain || null,
          isActive: formData.isActive,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          isEdit ? "Tenant berhasil diperbarui" : "Tenant berhasil dibuat",
        );
        setIsFormOpen(false);
        await mutateTenants();
      } else {
        toast.error(data.error || "Gagal menyimpan tenant");
      }
    } catch (error) {
      clientLogger.error("Error saving tenant:", error);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/tenants/${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Tenant berhasil dihapus");
        setDeleteId(null);
        await mutateTenants();
      } else {
        toast.error(data.error || "Gagal menghapus tenant");
      }
    } catch (error) {
      clientLogger.error("Error deleting tenant:", error);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Tenant>[] = [
    {
      key: "name",
      header: "Tenant Name",
      priority: "primary",
      className: "w-[40%]",
      render: (tenant) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <HiOutlineBuildingOffice className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {tenant.name}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "domain",
      header: "Domain",
      priority: "secondary",
      className: "w-[25%]",
      render: (tenant) => (
        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
          <HiOutlineGlobeAlt className="w-4 h-4 text-gray-400" />
          {tenant.domain || (
            <span className="text-gray-400 italic">No Domain</span>
          )}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "primary",
      className: "w-[15%]",
      render: (tenant) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            tenant.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {tenant.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created At",
      priority: "secondary",
      className: "w-[20%]",
      render: (tenant) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(tenant.createdAt).toLocaleDateString("id-ID", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
  ];

  const renderActions = (tenant: Tenant) => (
    <>
      <button
        onClick={() => handleOpenEdit(tenant)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
        title="Edit"
      >
        <HiOutlinePencilSquare className="w-4 h-4" />
        Edit
      </button>
      <button
        onClick={() => onViewAdmins(tenant.id)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
        title="Kelola Admin"
      >
        <HiOutlineBuildingOffice className="w-4 h-4" />
        Kelola Admin
      </button>
      <Link
        href={`/admin/tenants/${tenant.id}/features`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
        title="Atur Modul"
      >
        <HiOutlineSquares2X2 className="w-4 h-4" />
        Atur Modul
      </Link>
      <button
        onClick={() => setDeleteId(tenant.id)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
        title="Hapus"
      >
        <HiOutlineTrash className="w-4 h-4" />
        Hapus
      </button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tenant Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            SaaS Multi-Tenant Configuration (Super Admin Only)
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
        >
          <HiOutlinePlus className="w-5 h-5" />
          <span>Tambahkan Tenant</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <PageLoader variant="section" message="Memuat data tenant..." />
        ) : tenants.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <HiOutlineBuildingOffice className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              Tidak ada Tenant
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Mulai dengan menambahkan tenant baru untuk sistem SaaS Anda.
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
            >
              <HiOutlinePlus className="w-5 h-5" />
              <span>Tambahkan Tenant</span>
            </button>
          </div>
        ) : (
          <ResponsiveTable
            data={tenants}
            columns={columns}
            keyField="id"
            renderActions={renderActions}
          />
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={isEdit ? "Edit Tenant" : "Tambah Tenant Baru"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Tenant <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Contoh: Perusahaan ABC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Domain Khusus (Opsional)
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  domain: e.target.value.toLowerCase(),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="app.perusahaan.com"
            />
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label
              htmlFor="isActive"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Tenant Aktif
            </label>
          </div>

          <ModalFooter className="mt-6">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSaving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? "Menyimpan..." : "Simpan Tenant"}
            </button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Hapus Tenant?"
        size="md"
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <HiOutlineTrash className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6 font-medium">
            Tindakan ini tidak dapat dibatalkan. Menghapus tenant dapat
            menyebabkan error apabila masih ada data (User, Transaksi, dll) yang
            terkait dengan tenant ini!
          </p>
        </div>
        <ModalFooter>
          <button
            onClick={() => setDeleteId(null)}
            disabled={isDeleting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
