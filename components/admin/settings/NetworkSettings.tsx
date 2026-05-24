"use client";

import { useEffect, useState } from "react";
import { Network, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dispatchFullRadiusModeChange } from "@/lib/hooks/useFullRadiusMode";

type NetworkSettingsProps = {
  settings: {
    pppConnectionMode: "RADIUS" | "MIKROTIK_API";
  };
  handleChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

export function NetworkSettings({
  settings,
  handleChange,
}: NetworkSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5 text-indigo-500" />
          Jaringan & PPP
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Konfigurasi teknis autentikasi dan koneksi pelanggan
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="pppConnectionMode"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Mode Koneksi PPP
          </label>
          <select
            id="pppConnectionMode"
            name="pppConnectionMode"
            value={settings.pppConnectionMode}
            onChange={handleChange}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
          >
            <option value="RADIUS">
              RADIUS - Autentikasi via FreeRADIUS Server
            </option>
            <option value="MIKROTIK_API">
              MikroTik API - PPP Secret langsung di Router
            </option>
          </select>

          <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex gap-3">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-400 uppercase tracking-wider">
                  Info Mode
                </p>
                <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  {settings.pppConnectionMode === "RADIUS"
                    ? "Pelanggan diautentikasi melalui FreeRADIUS Server. Seluruh manajemen user terpusat di database RADIUS. Cocok untuk skalabilitas tinggi."
                    : "Manajemen user dilakukan langsung dengan membuat/mengupdate PPP Secret di MikroTik melalui API. Cocok untuk jaringan skala kecil tanpa server RADIUS."}
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 pt-1">
                  <strong>Isolir:</strong> Kedua mode mendukung fitur isolir
                  otomatis dengan merubah profile ke profile isolir di MikroTik.
                </p>
              </div>
            </div>
          </div>
        </div>

        <FullRadiusModeToggle />
      </CardContent>
    </Card>
  );
}

/**
 * Toggle khusus untuk modul accel-ppp.
 * Disimpan terpisah dari `pppConnectionMode` karena scope-nya berbeda:
 *   - `pppConnectionMode` = strategi auth pelanggan (RADIUS vs MikroTik API)
 *   - `FULL_RADIUS_MODE` = aktifkan/nonaktifkan jalur accel-ppp + endpoint terkait
 *
 * State lokal—tidak ikut form general settings—supaya save instan tanpa
 * mengubah field lain. Endpoint backend: /api/admin/settings/full-radius-mode
 */
function FullRadiusModeToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/settings/full-radius-mode")
      .then((r) => r.json())
      .then((json) => {
        if (alive) setEnabled(Boolean(json.data?.enabled));
      })
      .catch((err) => {
        if (alive) setError((err as Error).message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleToggle = async (next: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/full-radius-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setEnabled(Boolean(json.data?.enabled));
      dispatchFullRadiusModeChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Full RADIUS Mode (accel-ppp)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Aktifkan jalur accel-ppp on Linux paralel dengan MikroTik. Saat OFF,
            modul Accel-PPP di sidebar dan endpoint API-nya akan menolak akses
            (403).
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={Boolean(enabled)}
            disabled={enabled === null || saving}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 peer-disabled:opacity-50" />
        </label>
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {saving && (
        <p className="text-xs text-gray-500 dark:text-gray-400">Menyimpan…</p>
      )}
      {enabled === null && !error && (
        <p className="text-xs text-gray-400">Memuat status…</p>
      )}
    </div>
  );
}
