import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";

import {
  createInitialHargaFormData,
  mapHargaPaketToFormData,
} from "@/app/admin/paket/harga/lib/hargaPricing";
import type {
  Bandwidth,
  HargaFormData,
  HargaPaket,
  ProfilePPP,
  Site,
} from "@/app/admin/paket/harga/lib/hargaTypes";
import { useApi } from "@/lib/hooks/useApi";

interface SettingsPayload {
  pppConnectionMode?: "RADIUS" | "MIKROTIK_API";
}

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (
    value &&
    typeof value === "object" &&
    "data" in value &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: T[] }).data;
  }
  return [];
}

export function useHargaPaketPageState() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPaket, setEditingPaket] = useState<HargaPaket | null>(null);
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<HargaFormData>(
    createInitialHargaFormData(),
  );

  const params = new URLSearchParams();
  if (siteId) params.append("siteId", siteId);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";

  const hargaQuery = useApi<HargaPaket[] | { data?: HargaPaket[] }>(
    `/api/hargapakets${suffix}`,
  );
  const profileQuery = useApi<ProfilePPP[] | { data?: ProfilePPP[] }>(
    `/api/profileppps${suffix}`,
  );
  const siteQuery = useApi<Site[] | { data?: Site[] }>("/api/admin/sites");
  const bandwidthQuery = useApi<Bandwidth[] | { data?: Bandwidth[] }>(
    `/api/bandwidths${suffix}`,
  );
  const settingsQuery = useApi<SettingsPayload | { data?: SettingsPayload }>(
    "/api/settings/general",
  );

  const loading =
    hargaQuery.isLoading ||
    profileQuery.isLoading ||
    siteQuery.isLoading ||
    bandwidthQuery.isLoading ||
    settingsQuery.isLoading;

  const hargaPakets = unwrapList<HargaPaket>(hargaQuery.data);
  const profilePPPs = unwrapList<ProfilePPP>(profileQuery.data);
  const sites = unwrapList<Site>(siteQuery.data);
  const bandwidths = unwrapList<Bandwidth>(bandwidthQuery.data);

  const settingsRaw = settingsQuery.data as
    | SettingsPayload
    | { data?: SettingsPayload }
    | undefined;
  const settingsData: SettingsPayload =
    settingsRaw && "data" in settingsRaw && settingsRaw.data
      ? settingsRaw.data
      : ((settingsRaw as SettingsPayload | undefined) ?? {});
  const pppConnectionMode = settingsData.pppConnectionMode || "RADIUS";

  const firstError =
    hargaQuery.error ||
    profileQuery.error ||
    siteQuery.error ||
    bandwidthQuery.error;
  const error = firstError ? firstError.message || "Gagal memuat data" : null;

  useEffect(() => {
    if (firstError) {
      clientLogger.error("Error loading data:", firstError);
    }
  }, [firstError]);

  const reload = async () => {
    await Promise.all([
      hargaQuery.mutate(),
      profileQuery.mutate(),
      siteQuery.mutate(),
      bandwidthQuery.mutate(),
      settingsQuery.mutate(),
    ]);
  };

  const handleSubmit = async (event: React.SubmitEvent) => {
    event.preventDefault();
    if (formData.durasi < 1) {
      alert("Durasi minimal 1");
      return;
    }
    if (formData.harga < 0) {
      alert("Harga tidak boleh negatif");
      return;
    }

    try {
      const url = editingPaket
        ? `/api/hargapakets/${editingPaket.id}`
        : "/api/hargapakets";
      const method = editingPaket ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Gagal menyimpan harga paket");
      }

      await reload();
      handleCloseModal();
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      alert(errorMsg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus paket ini?")) return;
    try {
      const res = await fetch(`/api/hargapakets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Gagal menghapus paket");
        return;
      }
      await reload();
    } catch (error) {
      clientLogger.error("Error deleting paket:", error);
      alert("Terjadi kesalahan saat menghapus paket");
    }
  };

  const handleEdit = (paket: HargaPaket) => {
    setEditingPaket(paket);
    setFormData(mapHargaPaketToFormData(paket));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPaket(null);
    setFormData(createInitialHargaFormData());
  };

  const handleFormChange = <K extends keyof HargaFormData>(
    field: K,
    value: HargaFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return {
    loading,
    hargaPakets,
    profilePPPs,
    sites,
    bandwidths,
    error,
    isModalOpen,
    editingPaket,
    siteId,
    setSiteId,
    formData,
    pppConnectionMode,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleCloseModal,
    handleFormChange,
    openCreateModal: () => setIsModalOpen(true),
  };
}
