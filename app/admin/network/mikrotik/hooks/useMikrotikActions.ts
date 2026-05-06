import { clientLogger } from "@/lib/client-logger";
import { useState } from "react";
import { toast } from "react-hot-toast";
import type { MikrotikTestConnectionResult } from "../mikrotikFormShared";
import { MIKROTIK_API } from "../constants";

/**
 * Custom hook untuk handle actions pada MikroTik router (delete, test connection)
 */
export function useMikrotikActions() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] =
    useState<MikrotikTestConnectionResult | null>(null);

  const deleteRouter = async (
    id: string,
    name: string,
    onSuccess: () => void,
  ): Promise<boolean> => {
    if (!confirm(`Apakah Anda yakin ingin menghapus router "${name}"?`)) {
      return false;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`${MIKROTIK_API.BASE}/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Gagal menghapus router");
        return false;
      }

      toast.success("Router berhasil dihapus");
      onSuccess();
      return true;
    } catch (error) {
      clientLogger.error("Delete router error:", error);
      toast.error("Gagal menghapus router");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const testConnection = async (id: string): Promise<void> => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(MIKROTIK_API.TEST_CONNECTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routerId: id }),
      });

      const result = await res.json();
      setTestResult(result);

      if (!res.ok || !result.success) {
        toast.error(result.message || "Test koneksi gagal");
      } else {
        toast.success("Test koneksi berhasil");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Terjadi kesalahan";
      clientLogger.error("Test connection error:", error);
      setTestResult({
        success: false,
        api: { success: false, message: "Error: " + errorMessage },
        message: "Terjadi kesalahan saat test koneksi",
      });
      toast.error("Gagal melakukan test koneksi");
    } finally {
      setIsTesting(false);
    }
  };

  return {
    deleteRouter,
    testConnection,
    isDeleting,
    isTesting,
    testResult,
    clearTestResult: () => setTestResult(null),
  };
}
