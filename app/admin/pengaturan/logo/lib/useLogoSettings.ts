import { useCallback, useEffect, useState } from "react";
import { clientLogger } from "@/lib/client-logger";

import type { LogoType } from "./constants";
import type { LogoSettings, LogoStatesMap, LogoState } from "./types";
import { LOGO_CONSTANTS, LOGO_MESSAGES } from "./constants";
import { validateLogoFile, readFileAsDataUrl } from "./validation";
import { fetchLogoSettings, uploadLogoFile, deleteLogoFile } from "./logoApi";

const INITIAL_LOGO_STATE: LogoState = { preview: null, file: null };

function createInitialLogoStates(): LogoStatesMap {
  return {
    invoice: { ...INITIAL_LOGO_STATE },
    aplikasi: { ...INITIAL_LOGO_STATE },
    landing: { ...INITIAL_LOGO_STATE },
  };
}

function mapSettingsToStates(settings: LogoSettings): LogoStatesMap {
  return {
    invoice: { preview: settings.logoInvoice, file: null },
    aplikasi: { preview: settings.logoAplikasi, file: null },
    landing: { preview: settings.logoLandingPage, file: null },
  };
}

/**
 * Custom hook to manage logo settings state and operations.
 */
export function useLogoSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logoStates, setLogoStates] = useState<LogoStatesMap>(
    createInitialLogoStates(),
  );

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const settings = await fetchLogoSettings();
      setLogoStates(mapSettingsToStates(settings));
    } catch (err: unknown) {
      clientLogger.error("Error loading logo settings:", err);
      setError(
        err instanceof Error ? err.message : LOGO_MESSAGES.ERROR.LOAD_FAILED,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const uploadLogo = useCallback(async (type: LogoType, file: File) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const logoPath = await uploadLogoFile(type, file);

      setLogoStates((prev) => ({
        ...prev,
        [type]: { preview: logoPath, file: null },
      }));

      setSuccess(true);
      setTimeout(
        () => setSuccess(false),
        LOGO_CONSTANTS.SUCCESS_MESSAGE_DURATION_MS,
      );
    } catch (err: unknown) {
      clientLogger.error("Error uploading logo:", err);
      const errorMessage =
        err instanceof Error ? err.message : LOGO_MESSAGES.ERROR.UPLOAD_FAILED;
      setError(errorMessage);

      // Reset preview on error
      setLogoStates((prev) => ({
        ...prev,
        [type]: { ...prev[type], preview: prev[type].preview, file: null },
      }));
    } finally {
      setSaving(false);
    }
  }, []);

  const handleFileSelect = useCallback(
    async (type: LogoType, file: File) => {
      const validation = validateLogoFile(file);
      if (validation.valid === false) {
        setError(validation.error);
        return;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        setLogoStates((prev) => ({
          ...prev,
          [type]: { preview: dataUrl, file },
        }));

        await uploadLogo(type, file);
      } catch (err: unknown) {
        clientLogger.error("Error selecting file:", err);
        setError(
          err instanceof Error
            ? err.message
            : LOGO_MESSAGES.ERROR.UPLOAD_FAILED,
        );
      }
    },
    [uploadLogo],
  );

  const removeLogo = useCallback(async (type: LogoType) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await deleteLogoFile(type);

      setLogoStates((prev) => ({
        ...prev,
        [type]: { preview: null, file: null },
      }));

      setSuccess(true);
      setTimeout(
        () => setSuccess(false),
        LOGO_CONSTANTS.SUCCESS_MESSAGE_DURATION_MS,
      );
    } catch (err: unknown) {
      clientLogger.error("Error removing logo:", err);
      setError(
        err instanceof Error ? err.message : LOGO_MESSAGES.ERROR.DELETE_FAILED,
      );
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    loading,
    saving,
    error,
    success,
    logoStates,
    handleFileSelect,
    removeLogo,
    setError,
  };
}
