"use client";

import { type ComponentProps, useState, useMemo } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiMagnifyingGlass,
  HiOutlineBuildingOffice,
} from "react-icons/hi2";
import { Modal } from "@/components/ui/Modal";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";

interface OwnerGroup {
  id: string;
  name: string;
  owners: string[];
  siteId?: string;
  site?: { name: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Site {
  id: string;
  name: string;
}

export default function MixRadiusGroupsClient() {
  const { hasPermission } = usePermission();

  const canCreate = hasPermission("mixradius_sites:create");
  const canUpdate = hasPermission("mixradius_sites:update");
  const canDelete = hasPermission("mixradius_sites:delete");

  const {
    data: rawGroups,
    isLoading: groupsLoading,
    mutate: mutateGroups,
  } = useApi<{ data?: OwnerGroup[] } | OwnerGroup[]>(
    "/api/integrations/mixradius/groups",
    {
      onError: (err) => {
        toast.error(err.message || "Gagal mengambil data grup/site");
      },
    },
  );
  const { data: rawOwners, isLoading: ownersLoading } = useApi<
    { data?: unknown[] } | unknown[]
  >("/api/integrations/mixradius/owners", {
    onError: (err) => {
      const detail = (err.details ?? {}) as {
        isConfigError?: boolean;
      };
      if (detail.isConfigError) {
        toast.error(
          "Pengaturan akun MixRadius belum valid. Buka menu Akun MixRadius untuk memperbaiki URL/kredensial.",
        );
      } else {
        toast.error(err.message || "Gagal mengambil data owner");
      }
    },
  });
  const { data: rawSitesData, isLoading: sitesLoading } = useApi<
    { data?: Site[] } | Site[]
  >("/api/admin/sites?activeOnly=true", {
    onError: (err) => {
      toast.error(err.message || "Gagal mengambil data site manajemen");
    },
  });

  const loading = groupsLoading || ownersLoading || sitesLoading;

  const groups: OwnerGroup[] = Array.isArray(rawGroups)
    ? rawGroups
    : (rawGroups?.data ?? []);

  const owners = useMemo<string[]>(() => {
    const list: unknown[] = Array.isArray(rawOwners)
      ? rawOwners
      : (rawOwners?.data ?? []);
    return list.map((o) =>
      typeof o === "object" && o && "name" in o
        ? (o as { name: string }).name
        : String(o),
    );
  }, [rawOwners]);

  const sites: Site[] = Array.isArray(rawSitesData)
    ? rawSitesData
    : (rawSitesData?.data ?? []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    owners: [] as string[],
    siteId: "",
    isActive: true,
  });

  const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (
    e,
  ) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Nama Site harus diisi");
      return;
    }
    if (formData.owners.length === 0) {
      toast.error("Pilih minimal satu Owner");
      return;
    }

    try {
      const url = editingId
        ? `/api/integrations/mixradius/groups/${editingId}`
        : "/api/integrations/mixradius/groups";

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Gagal menyimpan data site");
      }

      toast.success(
        editingId ? "Site berhasil diperbarui" : "Site berhasil dibuat",
      );
      setIsModalOpen(false);
      await mutateGroups();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan data site",
      );
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus site "${name}"?`)) return;

    try {
      const res = await fetch(`/api/integrations/mixradius/groups/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menghapus site");
      }

      toast.success("Site berhasil dihapus");
      await mutateGroups();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus site",
      );
    }
  };

  const openEdit = (group: OwnerGroup) => {
    setEditingId(group.id);
    setFormData({
      name: group.name,
      owners: group.owners,
      siteId: group.siteId || "",
      isActive: group.isActive,
    });
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      name: "",
      owners: [],
      siteId: "",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const toggleOwner = (owner: string) => {
    setFormData((prev) => {
      const exists = prev.owners.includes(owner);
      if (exists) {
        return { ...prev, owners: prev.owners.filter((o) => o !== owner) };
      } else {
        return { ...prev, owners: [...prev.owners, owner] };
      }
    });
  };

  const columns: Column<OwnerGroup>[] = [
    {
      header: "Nama Site (Grup)",
      key: "name",
    },
    {
      header: "Mapping ke Site",
      key: "siteId",
      render: (item: OwnerGroup) =>
        item.site?.name || (
          <span className="text-gray-400 italic">Belum dipetakan</span>
        ),
    },
    {
      header: "Owners",
      key: "owners",
      render: (item: OwnerGroup) => (
        <div className="flex flex-wrap gap-1">
          {item.owners.map((owner: string, idx: number) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full dark:bg-blue-900/30 dark:text-blue-300"
            >
              {owner}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: "Status",
      key: "isActive",
      render: (item: OwnerGroup) =>
        item.isActive ? (
          <span className="text-green-600 dark:text-green-400 text-sm font-medium">
            Aktif
          </span>
        ) : (
          <span className="text-red-500 text-sm font-medium">Non-Aktif</span>
        ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            header: "Aksi",
            key: "id",
            render: (item: OwnerGroup) => (
              <div className="flex gap-2">
                {canUpdate && (
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg dark:text-blue-400 dark:hover:bg-blue-900/30"
                  >
                    <HiOutlinePencil className="text-lg" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(item.id, item.name)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-900/30"
                  >
                    <HiOutlineTrash className="text-lg" />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.owners.some((o) => o.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="p-6">
      <Toaster />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineBuildingOffice className="text-blue-600" />
            Manajemen Site
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Kelompokkan Owner MixRadius ke dalam Site/Grup untuk mempermudah
            filter di aplikasi mobile.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <HiOutlinePlus className="text-xl" />
            Tambah Site
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-[#1c2936] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative max-w-md">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Cari Site atau Owner..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <ResponsiveTable
          data={filteredGroups}
          columns={columns}
          keyField="id"
          loading={loading}
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Edit Site" : "Tambah Site Baru"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Site
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Site Cimenyan"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pemetaan ke Manajemen Site
            </label>
            <select
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              value={formData.siteId}
              onChange={(e) =>
                setFormData({ ...formData, siteId: e.target.value })
              }
            >
              <option value="">-- Pilih Site Manajemen --</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Hubungkan grup owner MixRadius ini ke Site Manajemen lokal kita.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pilih Owners ({formData.owners.length} dipilih)
            </label>
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 h-60 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {owners.length === 0 ? (
                  <div className="col-span-2 text-center text-gray-500 py-4">
                    Memuat owners...
                  </div>
                ) : (
                  owners.map((owner, index) => (
                    <label
                      key={`${owner}-${index}`}
                      className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-gray-700/50 rounded cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        checked={formData.owners.includes(owner)}
                        onChange={() => toggleOwner(owner)}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {owner}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Pilih satu atau lebih owner yang termasuk dalam site ini.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
            />
            <label
              htmlFor="isActive"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Set Aktif
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
