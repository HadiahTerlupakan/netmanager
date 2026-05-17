import { useCallback, useEffect, useState } from "react";

import type { Device } from "@/app/admin/network/acs/devices/lib/acsDeviceTypes";

type UseDevicesPollingOptions = {
  showToast: (type: "success" | "error" | "info", message: string) => void;
};

export function useDevicesPolling({ showToast }: UseDevicesPollingOptions) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/acs/devices");
      const result = await res.json();
      if (result.success && result.data) {
        setDevices(result.data.devices || []);
      } else {
        showToast("error", result.error || "Gagal memuat perangkat");
      }
    } catch (_err) {
      showToast("error", "Terjadi kesalahan saat memuat data perangkat");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const initialHandle = setTimeout(() => {
      void refresh();
    }, 0);
    const interval = setInterval(() => {
      void refresh();
    }, 300000);
    return () => {
      clearTimeout(initialHandle);
      clearInterval(interval);
    };
  }, [refresh]);

  return {
    devices,
    loading,
    refresh,
  };
}
