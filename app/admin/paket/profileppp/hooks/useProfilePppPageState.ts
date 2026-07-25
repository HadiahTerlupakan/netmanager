import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";

import {
  buildProfilePppPayload,
  createInitialProfilePppFormData,
  mapProfilePppToFormData,
  splitIpRange,
} from "@/app/admin/paket/profileppp/lib/profilePppHelpers";
import type {
  Bandwidth,
  MikroTikRouter,
  ProfilePPP,
  ProfilePppFormData,
} from "@/app/admin/paket/profileppp/lib/profilePppTypes";
import { useApi } from "@/lib/hooks/useApi";

interface SettingsPayload {
  pppConnectionMode?: "RADIUS" | "MIKROTIK_API";
}

interface RoutersPayload {
  routers?: MikroTikRouter[];
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

export function useProfilePppPageState() {
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ProfilePPP | null>(null);
  const [formData, setFormData] = useState<ProfilePppFormData>(
    createInitialProfilePppFormData(),
  );

  const params = new URLSearchParams();
  if (siteId) params.append("siteId", siteId);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";

  const profileQuery = useApi<ProfilePPP[] | { data?: ProfilePPP[] }>(
    `/api/profileppps${suffix}`,
  );
  const routersQuery = useApi<RoutersPayload | { data?: RoutersPayload }>(
    "/api/mikrotik-routers",
  );
  const bandwidthQuery = useApi<Bandwidth[] | { data?: Bandwidth[] }>(
    `/api/bandwidths${suffix}`,
  );
  const settingsQuery = useApi<SettingsPayload | { data?: SettingsPayload }>(
    "/api/settings/general",
  );

  const loading =
    profileQuery.isLoading ||
    routersQuery.isLoading ||
    bandwidthQuery.isLoading ||
    settingsQuery.isLoading;

  const profilePPPs = unwrapList<ProfilePPP>(profileQuery.data);
  const bandwidths = unwrapList<Bandwidth>(bandwidthQuery.data);

  const routersRaw = routersQuery.data;
  const routersInner: RoutersPayload =
    routersRaw && "data" in (routersRaw as object)
      ? ((routersRaw as { data?: RoutersPayload }).data ?? {})
      : ((routersRaw as RoutersPayload | undefined) ?? {});
  const mikroTikRouters = routersInner.routers ?? [];

  const settingsRaw = settingsQuery.data;
  const settingsInner: SettingsPayload =
    settingsRaw && "data" in (settingsRaw as object)
      ? ((settingsRaw as { data?: SettingsPayload }).data ?? {})
      : ((settingsRaw as SettingsPayload | undefined) ?? {});
  const pppConnectionMode = settingsInner.pppConnectionMode || "RADIUS";

  const firstError = profileQuery.error;
  const error = firstError ? firstError.message || "Gagal memuat data" : null;
  useEffect(() => {
    if (firstError) {
      clientLogger.error("Error loading data:", firstError);
    }
  }, [firstError]);

  const reload = async () => {
    await Promise.all([
      profileQuery.mutate(),
      routersQuery.mutate(),
      bandwidthQuery.mutate(),
      settingsQuery.mutate(),
    ]);
  };

  const handleSubmit = async (event: React.SubmitEvent) => {
    event.preventDefault();
    try {
      const url = editingProfile
        ? `/api/profileppps/${editingProfile.id}`
        : "/api/profileppps";
      const method = editingProfile ? "PUT" : "POST";
      const cleanedData = buildProfilePppPayload(formData, pppConnectionMode);
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Gagal menyimpan profile PPP");
      }

      await reload();
      handleCloseModal();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Terjadi kesalahan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus profile PPP ini?")) return;
    try {
      const res = await fetch(`/api/profileppps/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Gagal menghapus profile PPP");
        return;
      }
      await reload();
    } catch (error) {
      clientLogger.error("Error deleting profile PPP:", error);
      alert("Terjadi kesalahan saat menghapus profile PPP");
    }
  };

  const handleEdit = async (profile: ProfilePPP) => {
    setEditingProfile(profile);
    let ipRangeStart = "";
    let ipRangeEnd = "";
    try {
      const detailRes = await fetch(`/api/profileppps/${profile.id}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        const splitRange = splitIpRange(detailData.ipRange);
        ipRangeStart = splitRange.ipRangeStart;
        ipRangeEnd = splitRange.ipRangeEnd;
      }
    } catch (error: unknown) {
      clientLogger.error("Error fetching profile detail:", error);
    }

    setFormData(mapProfilePppToFormData(profile, ipRangeStart, ipRangeEnd));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProfile(null);
    setFormData(createInitialProfilePppFormData());
  };

  const handleFormChange = <K extends keyof ProfilePppFormData>(
    field: K,
    value: ProfilePppFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return {
    loading,
    siteId,
    setSiteId,
    profilePPPs,
    mikroTikRouters,
    bandwidths,
    pppConnectionMode,
    error,
    isModalOpen,
    editingProfile,
    formData,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleCloseModal,
    handleFormChange,
    openCreateModal: () => {
      setFormData((prev) => ({
        ...prev,
        siteId: siteId || "",
        poolMode: pppConnectionMode === "RADIUS" ? prev.poolMode : "MIKROTIK",
      }));
      setIsModalOpen(true);
    },
  };
}
