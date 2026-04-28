import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useState } from "react";

import { checkPppIdExists } from "@/app/admin/pelanggan/ppp/shared/form";

type UsePppIdValidationOptions = {
  idPelanggan: string;
  originalIdPelanggan?: string | null;
};

export function usePppIdValidation({
  idPelanggan,
  originalIdPelanggan,
}: UsePppIdValidationOptions) {
  const [idPelangganError, setIdPelangganError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState(false);

  const checkIdPelangganExists = useCallback(async (id: string) => {
    if (!id || id.trim() === "") {
      setIdPelangganError(null);
      return false;
    }

    try {
      setCheckingId(true);
      return await checkPppIdExists(id);
    } catch (error) {
      clientLogger.error("Error checking ID pelanggan:", error);
      return false;
    } finally {
      setCheckingId(false);
    }
  }, []);

  useEffect(() => {
    const idValue = idPelanggan.trim();

    if (idValue && !/^\d{8}$/.test(idValue)) {
      setIdPelangganError("ID Pelanggan harus 8 digit angka");
      return;
    }

    if (originalIdPelanggan && idValue === originalIdPelanggan) {
      setIdPelangganError(null);
      return;
    }

    if (!idValue) {
      setIdPelangganError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const exists = await checkIdPelangganExists(idValue);
      if (exists) {
        setIdPelangganError(
          "ID Pelanggan sudah digunakan, silakan gunakan ID lain",
        );
      } else {
        setIdPelangganError(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [idPelanggan, originalIdPelanggan, checkIdPelangganExists]);

  return {
    idPelangganError,
    checkingId,
    resetIdPelangganError: () => setIdPelangganError(null),
  };
}
