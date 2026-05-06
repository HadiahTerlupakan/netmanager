import { useCallback, useEffect, useState } from "react";
import { clientLogger } from "@/lib/client-logger";

import type { ApiSettings } from "./apiSettingsApi";
import { API_SETTINGS_CONSTANTS, API_SETTINGS_MESSAGES } from "./constants";
import { getErrorMessage } from "./errorUtils";
import { validateR2Connection } from "./validation";
import {
  fetchApiSettings,
  saveApiSettings,
  testR2Connection,
} from "./apiSettingsApi";

type VisibilityState = Record<string, boolean>;

const INITIAL_SETTINGS: ApiSettings = {
  googleGeminiApiKey: "",
  geminiEnabled: false,
  r2AccountId: "",
  r2AccessKeyId: "",
  r2SecretAccessKey: "",
  r2BucketName: "",
  r2PublicUrl: "",
  r2Enabled: false,
};

/**
 * Custom hook to manage API settings state and operations.
 */
export function useApiSettings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [settings, setSettings] = useState<ApiSettings>(INITIAL_SETTINGS);
  const [visibility, setVisibility] = useState<VisibilityState>({
    showApiKey: false,
    showR2Secret: false,
  });

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await fetchApiSettings();
      setSettings(data);
    } catch (err: unknown) {
      clientLogger.error("Error loading settings:", err);
      setError(getErrorMessage(err, API_SETTINGS_MESSAGES.ERROR.GENERIC));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setSuccess(false);

      try {
        setSaving(true);
        await saveApiSettings(settings);

        setSuccess(true);
        setTimeout(
          () => setSuccess(false),
          API_SETTINGS_CONSTANTS.SUCCESS_MESSAGE_DURATION_MS,
        );
      } catch (err: unknown) {
        clientLogger.error("Error saving settings:", err);
        setError(
          getErrorMessage(err, API_SETTINGS_MESSAGES.ERROR.SAVE_GENERIC),
        );
      } finally {
        setSaving(false);
      }
    },
    [settings],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type, checked } = e.target;
      setSettings((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
      setError(null);
      setSuccess(false);
    },
    [],
  );

  const toggleVisibility = useCallback((key: string) => {
    setVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleTestR2Connection = useCallback(async () => {
    const validation = validateR2Connection({
      accountId: settings.r2AccountId,
      accessKeyId: settings.r2AccessKeyId,
      secretAccessKey: settings.r2SecretAccessKey,
      bucketName: settings.r2BucketName,
    });

    if (validation.valid === false) {
      setError(validation.error);
      return;
    }

    try {
      setTesting(true);
      setError(null);
      setTestSuccess(false);

      await testR2Connection({
        accountId: settings.r2AccountId,
        accessKeyId: settings.r2AccessKeyId,
        secretAccessKey: settings.r2SecretAccessKey,
        bucketName: settings.r2BucketName,
      });

      setTestSuccess(true);
      setTimeout(
        () => setTestSuccess(false),
        API_SETTINGS_CONSTANTS.SUCCESS_MESSAGE_DURATION_MS,
      );
    } catch (err: unknown) {
      clientLogger.error("Error testing R2 connection:", err);
      setError(
        getErrorMessage(err, API_SETTINGS_MESSAGES.ERROR.R2_CONNECTION_FAILED),
      );
    } finally {
      setTesting(false);
    }
  }, [settings]);

  return {
    loading,
    saving,
    testing,
    error,
    success,
    testSuccess,
    settings,
    visibility,
    loadSettings,
    handleSubmit,
    handleInputChange,
    toggleVisibility,
    handleTestR2Connection,
  };
}
