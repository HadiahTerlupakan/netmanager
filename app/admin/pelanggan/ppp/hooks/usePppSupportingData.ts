import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useState } from "react";

import {
  fetchWithHandling,
  formatErrorMessage,
  isFetchError,
} from "@/lib/utils/fetch-wrapper";

type HargaPaket = {
  id: string;
  name: string;
  harga: number;
  durasi: number;
  durasiUnit: "JAM" | "HARI" | "BULAN" | "TAHUN";
  status: "AKTIF" | "NONAKTIF" | "MAINTENANCE" | "ISOLIR" | "DISMANTLE";
  usePPN?: boolean;
  ppnPercentage?: number | null;
  useDiscount?: boolean;
  discountType?: "FIXED" | "PERCENT" | null;
  discountValue?: number | null;
  discountDuration?: number | null;
  discountDurationUnit?: "JAM" | "HARI" | "BULAN" | "TAHUN" | null;
  profilePPP?: { id: string; name: string } | null;
  bandwidth?: { id: string; name: string } | null;
};

type Odp = {
  id: string;
  name: string;
  location: string | null;
  status: "AKTIF" | "NONAKTIF" | "MAINTENANCE" | "ISOLIR" | "DISMANTLE";
};

type UsePppSupportingDataOptions = {
  mode: "create" | "edit";
  siteId: string | undefined;
  showToast: (
    type: "success" | "error" | "warning" | "info",
    message: string,
  ) => void;
};

export function usePppSupportingData({
  mode,
  siteId,
  showToast,
}: UsePppSupportingDataOptions) {
  const [loading, setLoading] = useState(false);
  const [hargaPakets, setHargaPakets] = useState<HargaPaket[]>([]);
  const [odps, setOdps] = useState<Odp[]>([]);

  const loadHargaPakets = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("status", "AKTIF");
      if (mode === "create" && siteId) {
        params.append("siteId", siteId);
      }

      const res = await fetchWithHandling<HargaPaket[]>(
        `/api/hargapakets?${params.toString()}`,
      );
      if (res.data) {
        setHargaPakets(res.data);
      }
    } catch (err: unknown) {
      clientLogger.error("Error loading harga pakets:", err);
      if (isFetchError(err)) {
        showToast("error", formatErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [mode, showToast, siteId]);

  const loadOdps = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (mode === "create" && siteId) {
        params.append("siteId", siteId);
      }

      const res = await fetchWithHandling<{ odps: Odp[] }>(
        `/api/odps?${params.toString()}`,
      );
      if (res.data?.odps) {
        setOdps(res.data.odps);
      }
    } catch (err: unknown) {
      clientLogger.error("Error loading ODPs:", err);
      if (isFetchError(err)) {
        showToast("error", formatErrorMessage(err));
      }
    }
  }, [mode, showToast, siteId]);

  useEffect(() => {
    void loadHargaPakets();
    void loadOdps();
  }, [loadHargaPakets, loadOdps]);

  return {
    loading,
    hargaPakets,
    odps,
    reloadSupportingData: async () => {
      await Promise.all([loadHargaPakets(), loadOdps()]);
    },
  };
}
