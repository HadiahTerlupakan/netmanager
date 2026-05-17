import { clientLogger } from "@/lib/client-logger";
import { useEffect } from "react";

import { useApi } from "@/lib/hooks/useApi";

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
  const hargaParams = new URLSearchParams();
  hargaParams.append("status", "AKTIF");
  if (mode === "create" && siteId) {
    hargaParams.append("siteId", siteId);
  }

  const odpParams = new URLSearchParams();
  if (mode === "create" && siteId) {
    odpParams.append("siteId", siteId);
  }
  const odpQs = odpParams.toString();

  const hargaQuery = useApi<HargaPaket[]>(
    `/api/hargapakets?${hargaParams.toString()}`,
  );
  const odpQuery = useApi<{ odps?: Odp[] }>(
    odpQs ? `/api/odps?${odpQs}` : "/api/odps",
  );

  const hargaPakets = hargaQuery.data ?? [];
  const odps = odpQuery.data?.odps ?? [];
  const loading = hargaQuery.isLoading || odpQuery.isLoading;

  useEffect(() => {
    if (hargaQuery.error) {
      clientLogger.error("Error loading harga pakets:", hargaQuery.error);
      showToast(
        "error",
        hargaQuery.error.message || "Gagal memuat data harga paket",
      );
    }
  }, [hargaQuery.error, showToast]);

  useEffect(() => {
    if (odpQuery.error) {
      clientLogger.error("Error loading ODPs:", odpQuery.error);
      showToast("error", odpQuery.error.message || "Gagal memuat data ODP");
    }
  }, [odpQuery.error, showToast]);

  return {
    loading,
    hargaPakets,
    odps,
    reloadSupportingData: async () => {
      await Promise.all([hargaQuery.mutate(), odpQuery.mutate()]);
    },
  };
}
