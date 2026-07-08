"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { useApi } from "@/lib/hooks/useApi";
import { OutletModal } from "./OutletModal";
import { ResellerModal } from "./ResellerModal";
import type {
  OutletForm,
  Reseller,
  ResellerForm,
  ResellerOutlet,
} from "./types";
import { emptyOutletForm, emptyResellerForm } from "./types";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

async function parseMutationResponse(res: Response): Promise<void> {
  let message: string | null = null;
  try {
    const parsed: unknown = await res.json();
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      message = String(parsed.message);
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  if (!res.ok) throw new Error(message || "Permintaan gagal diproses");
}

export default function ResellersClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("reseller:create");
  const canUpdate = hasPermission("reseller:update");
  const canDelete = hasPermission("reseller:delete");
  const [saving, setSaving] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(
    null,
  );
  const [editingOutlet, setEditingOutlet] = useState<ResellerOutlet | null>(
    null,
  );
  const [isResellerModalOpen, setIsResellerModalOpen] = useState(false);
  const [isOutletModalOpen, setIsOutletModalOpen] = useState(false);
  const [resellerForm, setResellerForm] =
    useState<ResellerForm>(emptyResellerForm);
  const [outletForm, setOutletForm] = useState<OutletForm>(emptyOutletForm);
  const { data, isLoading, mutate } = useApi<readonly Reseller[]>(
    "/api/admin/resellers",
    {
      onError: () => toast.error("Gagal memuat data reseller"),
    },
  );
  const outletUrl = selectedReseller
    ? `/api/admin/resellers/${selectedReseller.id}/outlets`
    : null;
  const {
    data: outletData,
    isLoading: isLoadingOutlets,
    mutate: mutateOutlets,
  } = useApi<readonly ResellerOutlet[]>(outletUrl, {
    onError: () => toast.error("Gagal memuat outlet reseller"),
  });
  const resellers = [...(data ?? [])];
  const outlets = [...(outletData ?? [])];
  const resellerColumns: Column<Reseller>[] = [
    { key: "code", header: "Kode", priority: "primary" },
    { key: "name", header: "Nama", priority: "primary" },
    {
      key: "phone",
      header: "Telepon",
      priority: "secondary",
      render: (item) => item.phone || "-",
    },
    { key: "status", header: "Status", priority: "secondary" },
  ];
  const outletColumns: Column<ResellerOutlet>[] = [
    { key: "code", header: "Kode", priority: "primary" },
    { key: "name", header: "Outlet", priority: "primary" },
    {
      key: "phone",
      header: "Telepon",
      priority: "secondary",
      render: (item) => item.phone || "-",
    },
    { key: "status", header: "Status", priority: "secondary" },
  ];

  const openCreateReseller = () => {
    setEditingReseller(null);
    setResellerForm(emptyResellerForm);
    setIsResellerModalOpen(true);
  };
  const openEditReseller = (reseller: Reseller) => {
    setEditingReseller(reseller);
    setResellerForm({
      code: reseller.code,
      name: reseller.name,
      email: reseller.email ?? "",
      phone: reseller.phone ?? "",
      address: reseller.address ?? "",
      notes: reseller.notes ?? "",
      status: reseller.status,
    });
    setIsResellerModalOpen(true);
  };
  const saveReseller = async () => {
    if (!resellerForm.code.trim() || !resellerForm.name.trim())
      return toast.error("Kode dan nama reseller wajib diisi");
    setSaving(true);
    try {
      await parseMutationResponse(
        await fetch(
          editingReseller
            ? `/api/admin/resellers/${editingReseller.id}`
            : "/api/admin/resellers",
          {
            method: editingReseller ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resellerForm),
          },
        ),
      );
      toast.success(
        editingReseller ? "Reseller diperbarui" : "Reseller ditambahkan",
      );
      setIsResellerModalOpen(false);
      await mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const deleteReseller = async (reseller: Reseller) => {
    if (!confirm(`Hapus reseller ${reseller.name}?`)) return;
    setSaving(true);
    try {
      await parseMutationResponse(
        await fetch(`/api/admin/resellers/${reseller.id}`, {
          method: "DELETE",
        }),
      );
      if (selectedReseller?.id === reseller.id) setSelectedReseller(null);
      toast.success("Reseller dihapus");
      await mutate();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const openCreateOutlet = () => {
    setEditingOutlet(null);
    setOutletForm(emptyOutletForm);
    setIsOutletModalOpen(true);
  };
  const openEditOutlet = (outlet: ResellerOutlet) => {
    setEditingOutlet(outlet);
    setOutletForm({
      code: outlet.code,
      name: outlet.name,
      phone: outlet.phone ?? "",
      address: outlet.address ?? "",
      status: outlet.status,
    });
    setIsOutletModalOpen(true);
  };
  const saveOutlet = async () => {
    if (!selectedReseller) return;
    if (!outletForm.code.trim() || !outletForm.name.trim())
      return toast.error("Kode dan nama outlet wajib diisi");
    const url = editingOutlet
      ? `/api/admin/resellers/${selectedReseller.id}/outlets/${editingOutlet.id}`
      : `/api/admin/resellers/${selectedReseller.id}/outlets`;
    setSaving(true);
    try {
      await parseMutationResponse(
        await fetch(url, {
          method: editingOutlet ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(outletForm),
        }),
      );
      toast.success(editingOutlet ? "Outlet diperbarui" : "Outlet ditambahkan");
      setIsOutletModalOpen(false);
      await mutateOutlets();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const deleteOutlet = async (outlet: ResellerOutlet) => {
    if (!selectedReseller || !confirm(`Hapus outlet ${outlet.name}?`)) return;
    setSaving(true);
    try {
      await parseMutationResponse(
        await fetch(
          `/api/admin/resellers/${selectedReseller.id}/outlets/${outlet.id}`,
          { method: "DELETE" },
        ),
      );
      toast.success("Outlet dihapus");
      await mutateOutlets();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reseller
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kelola reseller, outlet, pricing, dan assignment pelanggan.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreateReseller} className="gap-2">
            <HiOutlinePlus className="h-5 w-5" /> Tambah Reseller
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <ResponsiveTable
            data={resellers}
            columns={resellerColumns}
            keyField="id"
            emptyMessage="Belum ada reseller"
            onRowClick={setSelectedReseller}
            renderActions={(item) => (
              <div className="flex items-center justify-end gap-2">
                {canUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditReseller(item)}
                  >
                    <HiOutlinePencilSquare className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteReseller(item)}
                  >
                    <HiOutlineTrash className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            )}
          />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Outlet reseller
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedReseller
                  ? selectedReseller.name
                  : "Pilih reseller untuk melihat outlet"}
              </p>
            </div>
            {selectedReseller && canUpdate && (
              <Button size="sm" onClick={openCreateOutlet} className="gap-2">
                <HiOutlinePlus className="h-4 w-4" /> Outlet
              </Button>
            )}
          </div>
          {selectedReseller ? (
            <ResponsiveTable
              data={outlets}
              columns={outletColumns}
              keyField="id"
              loading={isLoadingOutlets}
              emptyMessage="Belum ada outlet"
              renderActions={(item) => (
                <div className="flex items-center justify-end gap-2">
                  {canUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditOutlet(item)}
                    >
                      <HiOutlinePencilSquare className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void deleteOutlet(item)}
                    >
                      <HiOutlineTrash className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              )}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Pilih reseller dari tabel kiri.
            </div>
          )}
        </div>
      </div>
      <ResellerModal
        isOpen={isResellerModalOpen}
        isEditing={Boolean(editingReseller)}
        saving={saving}
        form={resellerForm}
        onClose={() => setIsResellerModalOpen(false)}
        onSave={() => void saveReseller()}
        onChange={setResellerForm}
      />
      <OutletModal
        isOpen={isOutletModalOpen}
        isEditing={Boolean(editingOutlet)}
        saving={saving}
        form={outletForm}
        onClose={() => setIsOutletModalOpen(false)}
        onSave={() => void saveOutlet()}
        onChange={setOutletForm}
      />
    </div>
  );
}
