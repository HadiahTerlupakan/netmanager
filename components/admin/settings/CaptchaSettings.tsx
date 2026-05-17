"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

interface CaptchaSettingsData {
  enabled?: boolean;
  siteKey?: string;
  secretKey?: string;
}

interface FormOverrides {
  captchaEnabled?: boolean;
  siteKey?: string;
  secretKey?: string;
}

export function CaptchaSettings() {
  const { data, isLoading, mutate } = useApi<CaptchaSettingsData>(
    "/api/settings/captcha",
  );

  // Local overrides — kosong saat pertama, diisi user via input.
  // Nilai aktual ditampilkan = override ?? data dari server.
  const [overrides, setOverrides] = useState<FormOverrides>({});
  const captchaEnabled = overrides.captchaEnabled ?? data?.enabled ?? false;
  const siteKey = overrides.siteKey ?? data?.siteKey ?? "";
  const secretKey = overrides.secretKey ?? data?.secretKey ?? "";

  const setCaptchaEnabled = (v: boolean) =>
    setOverrides((prev) => ({ ...prev, captchaEnabled: v }));
  const setSiteKey = (v: string) =>
    setOverrides((prev) => ({ ...prev, siteKey: v }));
  const setSecretKey = (v: string) =>
    setOverrides((prev) => ({ ...prev, secretKey: v }));

  const [saving, setSaving] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch("/api/settings/captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: captchaEnabled, siteKey, secretKey }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      setSuccess(true);
      setOverrides({}); // Reset overrides supaya data SWR jadi source of truth
      await mutate();
      setTimeout(() => setSuccess(false), 3000);
    } catch (_err) {
      setError("Gagal menyimpan pengaturan Captcha");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">
            Memuat pengaturan Captcha...
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-500" />
              Cloudflare Turnstile Captcha
            </CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Lindungi formulir pendaftaran dari spam dengan Cloudflare
              Turnstile.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={captchaEnabled}
              onChange={(e) => setCaptchaEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
            <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {captchaEnabled ? "Aktif" : "Nonaktif"}
            </span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Dapatkan kredensial di{" "}
          <a
            href="https://dash.cloudflare.com/?to=/:account/turnstile"
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 dark:text-green-400 hover:underline"
          >
            Cloudflare Dashboard
          </a>
          .
        </p>

        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!captchaEnabled ? "opacity-50" : ""}`}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Site Key
            </label>
            <input
              type="text"
              value={siteKey}
              onChange={(e) => setSiteKey(e.target.value)}
              placeholder="0x4AAAAAA..."
              disabled={!captchaEnabled}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none disabled:cursor-not-allowed"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Secret Key
            </label>
            <div className="relative">
              <input
                type={showSecretKey ? "text" : "password"}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="0x4AAAAAA..."
                disabled={!captchaEnabled}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none pr-10 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showSecretKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 dark:text-green-400">
              Pengaturan Captcha disimpan!
            </span>
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-400">
              {error}
            </span>
          </div>
        )}

        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          variant="outline"
          className="gap-2 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Simpan Pengaturan Captcha
        </Button>
      </CardContent>
    </Card>
  );
}
