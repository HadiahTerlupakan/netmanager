"use client";

import { useRef, useState } from "react";
import type { MapSettings, MappingEdge } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { buildMapSettingsFormState } from "@/components/map/map-settings-utils";
import type { MappingNode } from "@/components/map/map-types";
import type { MapCsvImportSummary } from "@/components/map/map-api-client";

interface SettingsTabProps {
  settings: MapSettings | null;
  nodes: MappingNode[];
  edges: MappingEdge[];
  onSave: (data: Partial<MapSettings>) => void;
  onExport: () => void;
  onReset: (password: string) => void;
  onImportCsv: (file: File) => Promise<MapCsvImportSummary | null>;
}

export function SettingsTab({
  settings,
  nodes,
  edges,
  onSave,
  onExport,
  onReset,
  onImportCsv,
}: SettingsTabProps) {
  const [formData, setFormData] = useState(buildMapSettingsFormState(settings));
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [prevSettings, setPrevSettings] = useState(settings);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] =
    useState<MapCsvImportSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setFormData(buildMapSettingsFormState(settings));
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleImport(file);
    e.target.value = "";
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportError(null);
    setImportSummary(null);
    try {
      const summary = await onImportCsv(file);
      if (summary) setImportSummary(summary);
      else setImportError("Import gagal. Periksa format CSV dan coba lagi.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Import gagal. Periksa format CSV dan coba lagi.";
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";

  return (
    <div className="flex-1 p-6 overflow-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Center Coordinates
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Latitude</label>
            <input
              type="text"
              value={formData.centerLat}
              onChange={(e) =>
                setFormData({ ...formData, centerLat: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">
              Longitude
            </label>
            <input
              type="text"
              value={formData.centerLng}
              onChange={(e) =>
                setFormData({ ...formData, centerLng: e.target.value })
              }
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Zoom Levels
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">
              Max Zoom In
            </label>
            <input
              type="number"
              value={formData.maxZoomIn}
              onChange={(e) =>
                setFormData({ ...formData, maxZoomIn: e.target.value })
              }
              min={1}
              max={22}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">
              Max Zoom Out
            </label>
            <input
              type="number"
              value={formData.maxZoomOut}
              onChange={(e) =>
                setFormData({ ...formData, maxZoomOut: e.target.value })
              }
              min={1}
              max={22}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">
              Default Zoom
            </label>
            <input
              type="number"
              value={formData.defaultZoom}
              onChange={(e) =>
                setFormData({ ...formData, defaultZoom: e.target.value })
              }
              min={1}
              max={22}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <Button onClick={() => onSave(formData)}>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Save Settings
      </Button>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Map Data Management
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="success" onClick={onExport}>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export Map
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6M5 20h14a2 2 0 002-2V7l-5-5H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            {importing ? "Mengimpor..." : "Import CSV"}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowResetModal(true)}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Reset Map Data
          </Button>
        </div>

        {importError && (
          <div className="mb-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <svg
              className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">
              {importError}
            </p>
          </div>
        )}

        {importSummary && (
          <div className="mb-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-emerald-600 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Import selesai — {importSummary.totalRows} baris diproses
              </p>
            </div>
            <div className="flex gap-4 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span>✦ {importSummary.created} node baru</span>
              <span>✦ {importSummary.updated} diupdate</span>
              {importSummary.skipped > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  ✦ {importSummary.skipped} dilewati
                </span>
              )}
            </div>
            {importSummary.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {importSummary.errors.slice(0, 3).map((err) => (
                  <p
                    key={err.rowIndex}
                    className="text-xs text-amber-700 dark:text-amber-400"
                  >
                    Baris {err.rowIndex} ({err.raw}): {err.error}
                  </p>
                ))}
                {importSummary.errors.length > 3 && (
                  <p className="text-xs text-amber-500">
                    +{importSummary.errors.length - 3} error lainnya
                  </p>
                )}
              </div>
            )}
            <button
              className="text-xs text-emerald-600 dark:text-emerald-400 underline mt-1"
              onClick={() => setImportSummary(null)}
            >
              Tutup
            </button>
          </div>
        )}

        <div className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <svg
            className="w-5 h-5 text-blue-500 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="font-medium mb-1">Information</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                Coordinate format: Latitude (-90 to 90), Longitude (-180 to 180)
              </li>
              <li>
                Zoom levels range from 1 (world view) to 22 (street level)
              </li>
              <li>Export preserves all nodes, edges, and settings</li>
              <li>
                Import CSV: kolom wajib <code>name, latitude, longitude</code> —
                mode merge (tidak hapus data existing)
              </li>
              <li>
                Tipe node auto-detect dari prefix nama (ODP/ODC/OLT/ONT),
                default ODP
              </li>
              <li>Reset will delete all map data (requires password)</li>
            </ul>
          </div>
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Reset Map Data
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This will delete ALL nodes ({nodes.length}) and edges (
              {edges.length}). Enter your password to confirm.
            </p>
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Enter password"
              className={`${inputClass} mb-4`}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowResetModal(false);
                  setResetPassword("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onReset(resetPassword);
                  setShowResetModal(false);
                  setResetPassword("");
                }}
                className="flex-1"
              >
                Delete All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
