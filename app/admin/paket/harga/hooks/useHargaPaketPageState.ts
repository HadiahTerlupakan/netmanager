import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useState } from "react";

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

export function useHargaPaketPageState() {
  const [loading, setLoading] = useState(true);
  const [hargaPakets, setHargaPakets] = useState<HargaPaket[]>([]);
  const [profilePPPs, setProfilePPPs] = useState<ProfilePPP[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [bandwidths, setBandwidths] = useState<Bandwidth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPaket, setEditingPaket] = useState<HargaPaket | null>(null);
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<HargaFormData>(
    createInitialHargaFormData(),
  );
  const [pppConnectionMode, setPppConnectionMode] = useState<
    "RADIUS" | "MIKROTIK_API"
  >("RADIUS");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const ts = new Date().getTime().toString();
      const params = new URLSearchParams();
      if (siteId) params.append("siteId", siteId);
      params.append("t", ts);

      const [
        hargaPaketsRes,
        profilePPPsRes,
        sitesRes,
        bandwidthsRes,
        settingsRes,
      ] = await Promise.all([
        fetch(`/api/hargapakets?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/profileppps?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/admin/sites?t=${ts}`, { cache: "no-store" }),
        fetch(`/api/bandwidths?${params.toString()}`, { cache: "no-store" }),
        fetch(`/api/settings/general?t=${ts}`, { cache: "no-store" }),
      ]);

      if (!hargaPaketsRes.ok) {
        let errorMessage = `Gagal memuat data harga paket: ${hargaPaketsRes.status}`;
        try {
          const errorData = await hargaPaketsRes.json();
          if (
            errorData &&
            typeof errorData === "object" &&
            "error" in errorData
          ) {
            errorMessage = errorData.error || errorMessage;
          }
        } catch (_e) {
          errorMessage = `Gagal memuat data harga paket: ${hargaPaketsRes.status} ${hargaPaketsRes.statusText || ""}`;
        }
        throw new Error(errorMessage);
      }

      const hargaPaketsData = await hargaPaketsRes.json();
      const profilePPPsData = await profilePPPsRes.json();
      const sitesData = await sitesRes.json();
      const bandwidthsData = await bandwidthsRes.json();
      const settingsJson = settingsRes.ok
        ? await settingsRes.json()
        : { data: { pppConnectionMode: "RADIUS" } };
      const settingsData = settingsJson.data || settingsJson;
      setPppConnectionMode(settingsData.pppConnectionMode || "RADIUS");

      setHargaPakets(
        Array.isArray(hargaPaketsData?.data)
          ? hargaPaketsData.data
          : Array.isArray(hargaPaketsData)
            ? hargaPaketsData
            : [],
      );
      setProfilePPPs(
        Array.isArray(profilePPPsData?.data)
          ? profilePPPsData.data
          : Array.isArray(profilePPPsData)
            ? profilePPPsData
            : [],
      );
      setSites(
        Array.isArray(sitesData?.data)
          ? sitesData.data
          : Array.isArray(sitesData)
            ? sitesData
            : [],
      );
      setBandwidths(
        Array.isArray(bandwidthsData?.data)
          ? bandwidthsData.data
          : Array.isArray(bandwidthsData)
            ? bandwidthsData
            : [],
      );
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

      await loadData();
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
      await loadData();
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
