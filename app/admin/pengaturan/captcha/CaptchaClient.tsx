"use client";

import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useState } from "react";
import {
  HiArrowPath,
  HiCheckCircle,
  HiExclamationCircle,
  HiShieldCheck,
} from "react-icons/hi2";

function unwrapApiData<T>(payload: T | { data?: T }): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: T }).data;
    if (nested !== undefined) {
      return nested;
    }
  }

  return payload as T;
}

export function ClientComponent() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    siteKey: "",
    secretKey: "",
  });

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings/captcha");
      if (res.ok) {
        const payload = await res.json();
        const data = unwrapApiData<{
          enabled: boolean;
          siteKey: string;
          secretKey: string;
        }>(payload);
        setSettings({
          enabled: data.enabled,
          siteKey: data.siteKey,
          secretKey: data.secretKey,
        });
      }
    } catch (err) {
      clientLogger.error("Failed to load captcha settings", err);
      setError("Gagal memuat pengaturan captcha");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch("/api/settings/captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed to save");

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (_err) {
      setError("Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Pengaturan Captcha & Keamanan
        </h2>
        <p className="text-sm text-gray-500">
          Konfigurasi Cloudflare Turnstile untuk mencegah spam pada formulir
          pendaftaran.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        {loading ? (
          <div className="flex justify-center py-8">
            <HiArrowPath className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <HiShieldCheck
                  className={`w-8 h-8 ${settings.enabled ? "text-green-500" : "text-gray-400"}`}
                />
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Aktifkan Captcha
                  </h3>
                  <p className="text-xs text-gray-500">
                    Formulir pendaftaran akan dilindungi oleh Cloudflare
                    Turnstile.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, enabled: e.target.checked })
                  }
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {settings.enabled && (
              <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="space-y-2">
                  <label
                    htmlFor="captcha-site-key"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Site Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="captcha-site-key"
                    type="text"
                    required={settings.enabled}
                    value={settings.siteKey}
                    onChange={(e) =>
                      setSettings({ ...settings, siteKey: e.target.value })
                    }
                    placeholder="0x4AAAAAA..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="captcha-secret-key"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Secret Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="captcha-secret-key"
                    type="text" // Using text to allow viewing, admin context is secure enough usually, or use password type
                    required={settings.enabled}
                    value={settings.secretKey}
                    onChange={(e) =>
                      setSettings({ ...settings, secretKey: e.target.value })
                    }
                    placeholder="0x4AAAAAA..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500">
                    Dapatkan key ini dari dashboard{" "}
                    <a
                      href="https://dash.cloudflare.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Cloudflare Turnstile
                    </a>
                    .
                  </p>
                </div>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2">
                <HiCheckCircle className="w-5 h-5" /> Pengaturan disimpan!
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md flex items-center gap-2">
                <HiExclamationCircle className="w-5 h-5" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <HiArrowPath className="animate-spin" />
              ) : (
                <HiCheckCircle />
              )}
              Simpan Pengaturan
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
