"use client";

import { AlertTriangle, Map as MapIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GoogleMapsSettingsProps = {
  enabled: boolean;
  apiKey: string;
  mapId: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleToggle: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

/** Langkah di Google Cloud Console yang harus dikerjakan administrator. */
const LANGKAH_CLOUD_CONSOLE = [
  "Aktifkan Maps JavaScript API di APIs & Services → Library. Proyeknya harus punya akun penagihan aktif.",
  "Buat API key, lalu batasi: Application restrictions → HTTP referrers (domain admin Anda dan http://localhost:3000/*), dan API restrictions → Maps JavaScript API saja.",
  "Buat Map ID di Maps → Map Management, dengan Map type JavaScript.",
  "Pasang batas kuota harian di APIs & Services → Quotas. Kuota gratis 10.000 pemuatan peta per bulan, setelah itu sekitar $7 per 1.000.",
];

const KELAS_INPUT =
  "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:cursor-not-allowed";

/**
 * Setelan Google Maps sebagai mesin peta.
 *
 * Tidak ada tombol mata di sini, berbeda dari kartu Gemini dan R2 di
 * sebelahnya. API key Maps JavaScript memang dikirim ke browser pada setiap
 * halaman berpeta, jadi menyamarkannya hanya akan menyiratkan kerahasiaan yang
 * tidak pernah ada. Pengamannya pembatasan HTTP referrer di Cloud Console.
 */
export function GoogleMapsSettings({
  enabled,
  apiKey,
  mapId,
  handleChange,
  handleToggle,
}: GoogleMapsSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-emerald-500" />
              Google Maps
            </CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mesin peta untuk peta jaringan, rencana OSP, pemilih koordinat,
              live-map kehadiran, dan presurvei
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="googleMapsEnabled"
              checked={enabled}
              onChange={handleToggle}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
            <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {enabled ? "Aktif" : "Nonaktif"}
            </span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`space-y-4 ${!enabled ? "opacity-50" : ""}`}>
          <div className="space-y-2">
            <label
              htmlFor="googleMapsApiKey"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Maps JavaScript API Key
            </label>
            <input
              id="googleMapsApiKey"
              name="googleMapsApiKey"
              type="text"
              value={apiKey}
              onChange={handleChange}
              disabled={!enabled}
              placeholder="AIza…"
              autoComplete="off"
              spellCheck={false}
              className={KELAS_INPUT}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ditampilkan apa adanya, bukan disamarkan seperti kunci di atas.
              Key ini memang dikirim ke browser setiap kali peta dimuat, jadi
              menyembunyikannya di sini hanya akan menyesatkan — yang
              mengamankannya adalah pembatasan referrer di Cloud Console.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="googleMapsMapId"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Map ID
            </label>
            <input
              id="googleMapsMapId"
              name="googleMapsMapId"
              type="text"
              value={mapId}
              onChange={handleChange}
              disabled={!enabled}
              placeholder="mis. 8f2c1a9b4d6e0017"
              autoComplete="off"
              spellCheck={false}
              className={KELAS_INPUT}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Wajib diisi. Penanda titik ODP/ODC memakai Advanced Marker, yang
              tidak tampil sama sekali bila Map ID kosong — tanpa pesan galat
              apa pun.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Siapkan dulu di Google Cloud Console
            </span>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300/90">
            {LANGKAH_CLOUD_CONSOLE.map((langkah) => (
              <li key={langkah}>{langkah}</li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
