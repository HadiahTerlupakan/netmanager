import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useState } from "react";

import {
  buildBandwidthPayload,
  createInitialBandwidthFormData,
  mapBandwidthToFormData,
} from "@/app/admin/paket/bandwidth/lib/bandwidthFormatting";
import type {
  Bandwidth,
  BandwidthFormData,
} from "@/app/admin/paket/bandwidth/lib/bandwidthTypes";

export function useBandwidthPageState() {
  const [loading, setLoading] = useState(true);
  const [bandwidths, setBandwidths] = useState<Bandwidth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBandwidth, setEditingBandwidth] = useState<Bandwidth | null>(
    null,
  );
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<BandwidthFormData>(
    createInitialBandwidthFormData(),
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (siteId) params.append("siteId", siteId);

      const res = await fetch(`/api/bandwidths?${params.toString()}`);
      if (!res.ok) {
        let errorMessage = `Gagal memuat data bandwidth: ${res.status}`;
        try {
          const errorData = await res.json();
          if (
            errorData &&
            typeof errorData === "object" &&
            "error" in errorData
          ) {
            errorMessage = errorData.error || errorMessage;
          }
        } catch (_e) {
          errorMessage = `Gagal memuat data bandwidth: ${res.status} ${res.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const json = await res.json();
      const dataArray = Array.isArray(json) ? json : json.data || [];
      setBandwidths(dataArray);
      setError(null);
    } catch (error: unknown) {
      clientLogger.error("Error loading data:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Gagal memuat data";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(handle);
  }, [loadData]);

  const handleSubmit = async (event: React.FormEvent) => {
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

      await loadData();
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
      await loadData();
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
