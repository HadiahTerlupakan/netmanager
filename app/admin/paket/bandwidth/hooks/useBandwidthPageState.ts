import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";

import {
  buildBandwidthPayload,
  createInitialBandwidthFormData,
  mapBandwidthToFormData,
} from "@/app/admin/paket/bandwidth/lib/bandwidthFormatting";
import type {
  Bandwidth,
  BandwidthFormData,
} from "@/app/admin/paket/bandwidth/lib/bandwidthTypes";
import { useApi } from "@/lib/hooks/useApi";

export function useBandwidthPageState() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBandwidth, setEditingBandwidth] = useState<Bandwidth | null>(
    null,
  );
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<BandwidthFormData>(
    createInitialBandwidthFormData(),
  );

  const queryUrl = (() => {
    const params = new URLSearchParams();
    if (siteId) params.append("siteId", siteId);
    const qs = params.toString();
    return qs ? `/api/bandwidths?${qs}` : "/api/bandwidths";
  })();

  const {
    data,
    isLoading: loading,
    error: fetchError,
    mutate,
  } = useApi<Bandwidth[] | { data?: Bandwidth[] }>(queryUrl);
  const bandwidths: Bandwidth[] = Array.isArray(data)
    ? data
    : (data?.data ?? []);
  const error = fetchError ? fetchError.message || "Gagal memuat data" : null;

  useEffect(() => {
    if (fetchError) {
      clientLogger.error("Error loading data:", fetchError);
    }
  }, [fetchError]);

  const handleSubmit = async (event: React.SubmitEvent) => {
    event.preventDefault();
    try {
      const url = editingBandwidth
        ? `/api/bandwidths/${editingBandwidth.id}`
        : "/api/bandwidths";
      const method = editingBandwidth ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBandwidthPayload(formData)),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Gagal menyimpan bandwidth");
      }

      await mutate();
      handleCloseModal();
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      alert(errorMsg);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus bandwidth ini?")) return;
    try {
      const res = await fetch(`/api/bandwidths/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Gagal menghapus bandwidth");
        return;
      }
      await mutate();
    } catch (error) {
      clientLogger.error("Error deleting bandwidth:", error);
      alert("Terjadi kesalahan saat menghapus bandwidth");
    }
  };

  const handleEdit = (bandwidth: Bandwidth) => {
    setEditingBandwidth(bandwidth);
    setFormData(mapBandwidthToFormData(bandwidth));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBandwidth(null);
    setFormData(createInitialBandwidthFormData());
  };

  const handleFormChange = <K extends keyof BandwidthFormData>(
    field: K,
    value: BandwidthFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenCreate = () => {
    setFormData((prev) => ({ ...prev, siteId: siteId || "" }));
    setIsModalOpen(true);
  };

  return {
    loading,
    bandwidths,
    error,
    siteId,
    setSiteId,
    isModalOpen,
    editingBandwidth,
    formData,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleCloseModal,
    handleFormChange,
    handleOpenCreate,
  };
}
