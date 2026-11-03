"use client";

import { useState, type MouseEvent } from "react";
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
import {
  fetchWithHandling,
  formatErrorMessage,
  isFetchError,
} from "@/lib/utils/fetch-wrapper";
import { LoadErrorState } from "./LoadErrorState";
import { OutletModal } from "./OutletModal";
import { ResellerModal } from "./ResellerModal";
import type {
  OutletForm,
  Reseller,
  ResellerCommission,
  ResellerForm,
  ResellerOutlet,
  ResellerPackagePrice,
} from "./types";
import { emptyOutletForm, emptyResellerForm } from "./types";
import { RESELLER_LIST_URL, useResellerList } from "./useResellerList";

/** Pesan galat untuk toast, termasuk detail validasi field dari server. */
function getErrorMessage(error: unknown) {
  if (isFetchError(error)) return formatErrorMessage(error);
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan";
}

/**
 * Kirim mutasi ke API reseller. `fetchWithHandling` membaca bentuk galat
 * standar `{ error, details }`, jadi alasan penolakan server sampai ke toast.
 */
async function sendResellerMutation(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<void> {
  await fetchWithHandling(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Hentikan klik tombol aksi agar tidak ikut memilih baris (kartu mobile). */
function stopRowClick(event: MouseEvent) {
  event.stopPropagation();
}

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export default function ResellersClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("reseller:create");
  const canUpdate = hasPermission("reseller:update");
  const canDelete = hasPermission("reseller:delete");
  const [saving, setSaving] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [selectedResellerId, setSelectedResellerId] = useState<string | null>(
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
  const resellerList = useResellerList();
  const resellers = [...resellerList.resellers];
  const selectedUrl = selectedResellerId
    ? `${RESELLER_LIST_URL}/${selectedResellerId}`
    : null;
  // Detail dimuat tersendiri agar pilihan tetap utuh saat pindah halaman,
  // dan selalu diambil dari data segar, bukan salinan baris lama.
  const { data: selectedDetail, mutate: mutateSelected } =
    useApi<Reseller>(selectedUrl);
  const selectedReseller =
    resellers.find((reseller) => reseller.id === selectedResellerId) ??
    (selectedDetail?.id === selectedResellerId ? selectedDetail : null) ??
    null;
  const canAddOutlet = canUpdate && selectedReseller?.status === "ACTIVE";
  const outletUrl = selectedUrl ? `${selectedUrl}/outlets` : null;
  const pricingUrl = selectedUrl ? `${selectedUrl}/package-prices` : null;
  const commissionUrl = selectedUrl
    ? `${selectedUrl}/commissions?limit=5`
    : null;
  const outletQuery = useApi<readonly ResellerOutlet[]>(outletUrl);
  const pricingQuery = useApi<readonly ResellerPackagePrice[]>(pricingUrl);
  const commissionQuery = useApi<readonly ResellerCommission[]>(commissionUrl);
  const { data: outletData, mutate: mutateOutlets } = outletQuery;
  const { data: pricingData, isLoading: isLoadingPricing } = pricingQuery;
  const { data: commissionData, isLoading: isLoadingCommissions } =
    commissionQuery;
  const outlets = [...(outletData ?? [])];
  const packagePrices = [...(pricingData ?? [])];
  const commissions = [...(commissionData ?? [])];
  const totalRecentCommission = commissions.reduce(
    (total, commission) => total + commission.commissionAmount,
    0,
  );
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
      await sendResellerMutation(
        editingReseller
          ? `${RESELLER_LIST_URL}/${editingReseller.id}`
          : RESELLER_LIST_URL,
        editingReseller ? "PATCH" : "POST",
        resellerForm,
      );
      toast.success(
        editingReseller ? "Reseller diperbarui" : "Reseller ditambahkan",
      );
      setIsResellerModalOpen(false);
      await Promise.all([resellerList.refetch(), mutateSelected()]);
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
      await sendResellerMutation(
        `${RESELLER_LIST_URL}/${reseller.id}`,
        "DELETE",
      );
      setSelectedResellerId((currentId) =>
        currentId === reseller.id ? null : currentId,
      );
      toast.success("Reseller dihapus");
      await resellerList.refetch();
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
      ? `${RESELLER_LIST_URL}/${selectedReseller.id}/outlets/${editingOutlet.id}`
      : `${RESELLER_LIST_URL}/${selectedReseller.id}/outlets`;
    setSaving(true);
    try {
      await sendResellerMutation(
        url,
        editingOutlet ? "PATCH" : "POST",
        outletForm,
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
      await sendResellerMutation(
        `${RESELLER_LIST_URL}/${selectedReseller.id}/outlets/${outlet.id}`,
        "DELETE",
      );
      toast.success("Outlet dihapus");
      await mutateOutlets();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  if (resellerList.isLoading) return <PageLoader />;

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
          {resellerList.error ? (
            <LoadErrorState
              title="Gagal memuat data reseller"
              error={resellerList.error}
              onRetry={() => void resellerList.refetch()}
            />
          ) : (
            <ResponsiveTable
              data={resellers}
              columns={resellerColumns}
              keyField="id"
              emptyMessage="Belum ada reseller"
              onRowClick={(item) => setSelectedResellerId(item.id)}
              page={resellerList.page}
              totalPages={resellerList.totalPages}
              onPageChange={resellerList.setPage}
              renderActions={(item) => (
                <div
                  className="flex items-center justify-end gap-2"
                  onClick={stopRowClick}
                >
                  {canUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit reseller ${item.name}`}
                      onClick={() => openEditReseller(item)}
                    >
                      <HiOutlinePencilSquare className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Hapus reseller ${item.name}`}
                      onClick={() => void deleteReseller(item)}
                    >
                      <HiOutlineTrash className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              )}
            />
          )}
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
            {canAddOutlet && (
              <Button size="sm" onClick={openCreateOutlet} className="gap-2">
                <HiOutlinePlus className="h-4 w-4" /> Outlet
              </Button>
            )}
          </div>
          {selectedReseller && outletQuery.error ? (
            <LoadErrorState
              title="Gagal memuat outlet reseller"
              error={outletQuery.error}
              onRetry={() => void outletQuery.refetch()}
            />
          ) : selectedReseller ? (
            <ResponsiveTable
              data={outlets}
              columns={outletColumns}
              keyField="id"
              loading={outletQuery.isLoading}
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
      {selectedReseller && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Pricing reseller
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Override harga paket aktif untuk {selectedReseller.name}.
              </p>
            </div>
            {pricingQuery.error ? (
              <LoadErrorState
                title="Gagal memuat pricing reseller"
                error={pricingQuery.error}
                onRetry={() => void pricingQuery.refetch()}
              />
            ) : isLoadingPricing ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Memuat...
              </p>
            ) : packagePrices.length > 0 ? (
              <div className="space-y-3">
                {packagePrices.map((price) => (
                  <div
                    key={price.id}
                    className="rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-700"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {price.hargaPaketId}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {rupiahFormatter.format(price.price)} · {price.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Belum ada override pricing reseller.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Komisi & settlement
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total 5 komisi terakhir:{" "}
                {rupiahFormatter.format(totalRecentCommission)}.
              </p>
            </div>
            {commissionQuery.error ? (
              <LoadErrorState
                title="Gagal memuat komisi reseller"
                error={commissionQuery.error}
                onRetry={() => void commissionQuery.refetch()}
              />
            ) : isLoadingCommissions ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Memuat...
              </p>
            ) : commissions.length > 0 ? (
              <div className="space-y-3">
                {commissions.map((commission) => (
                  <div
                    key={commission.id}
                    className="rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-700"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      Invoice {commission.invoiceId}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {rupiahFormatter.format(commission.commissionAmount)} ·{" "}
                      {commission.status} · {commission.period}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Belum ada komisi reseller yang tercatat.
              </div>
            )}
          </div>
        </div>
      )}
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
