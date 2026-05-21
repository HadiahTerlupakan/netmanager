import { useEffect } from "react";

import type { Device } from "@/app/admin/network/acs/devices/lib/acsDeviceTypes";
import { useApi } from "@/lib/hooks/useApi";

type UseDevicesQueryOptions = {
  showToast: (type: "success" | "error" | "info", message: string) => void;
};

export function useDevicesQuery({ showToast }: UseDevicesQueryOptions) {
  const {
    data,
    isLoading: loading,
    error,
    mutate,
  } = useApi<{
    devices?: Device[];
  }>("/api/acs/devices", {
    refreshInterval: 300_000,
  });
  const devices = data?.devices ?? [];

  useEffect(() => {
    if (error) {
      showToast(
        "error",
        error.message || "Terjadi kesalahan saat memuat data perangkat",
      );
    }
  }, [error, showToast]);

  return {
    devices,
    loading,
    refresh: () => mutate(),
  };
}
