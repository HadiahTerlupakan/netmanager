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

    // Format/identity error sudah di-handle via derived value selama render.
    // Effect ini hanya untuk async existence check.
    if (!idValue || !/^\d{8}$/.test(idValue)) {
      return;
    }
    if (originalIdPelanggan && idValue === originalIdPelanggan) {
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

  // Pattern C: sync derived synchronous validation error during render
  const idValueTrimmed = idPelanggan.trim();
  const formatError =
    idValueTrimmed && !/^\d{8}$/.test(idValueTrimmed)
      ? "ID Pelanggan harus 8 digit angka"
      : null;
  const isOriginal =
    Boolean(originalIdPelanggan) && idValueTrimmed === originalIdPelanggan;
  const [prevSyncSig, setPrevSyncSig] = useState<string>("");
  const syncSig = `${formatError ?? ""}|${isOriginal ? "1" : "0"}|${idValueTrimmed === "" ? "1" : "0"}`;
  if (prevSyncSig !== syncSig) {
    setPrevSyncSig(syncSig);
    if (formatError) {
      setIdPelangganError(formatError);
    } else if (isOriginal || !idValueTrimmed) {
      setIdPelangganError(null);
    }
  }

  return {
    idPelangganError,
    checkingId,
    resetIdPelangganError: () => setIdPelangganError(null),
  };
}
