"use client";

import { useState } from "react";
import {
  HiArrowUpTray,
  HiArrowPath,
  HiTrash,
  HiExclamationCircle,
} from "react-icons/hi2";

interface LogoUploaderProps {
  /** Current logo URL value */
  value: string;
  /** Called when the URL changes (after upload or removal) */
  onChange: (url: string) => void;
  /** Field label shown above the uploader */
  label: string;
  /** Helper text shown below the label */
  hint?: string;
  /** Optional dark preview background (e.g. footer logo) */
  darkPreview?: boolean;
}

const ACCEPTED_MIME_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

/** Reusable upload + preview control for landing page logos. */
export function LogoUploader({
  value,
  onChange,
  label,
  hint,
  darkPreview,
}: LogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      setError("Ukuran file maksimal 2MB");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/website/upload-logo", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Gagal mengunggah logo");
      }
      onChange(json.data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    onChange("");
    setError(null);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} <span className="text-gray-400 font-normal">(opsional)</span>
      </label>
      {hint && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{hint}</p>
      )}

      <div className="flex items-start gap-4">
        {value ? (
          <div
            className={`w-24 h-24 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0 ${
              darkPreview ? "bg-slate-900" : "bg-white"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Logo preview"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div
            className={`w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-xs text-gray-400 shrink-0 ${
              darkPreview ? "bg-slate-900/40" : "bg-gray-50 dark:bg-gray-800"
            }`}
          >
            Belum ada
          </div>
        )}

        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <label
            className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
              uploading ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            {uploading ? (
              <HiArrowPath className="w-4 h-4 animate-spin" />
            ) : (
              <HiArrowUpTray className="w-4 h-4" />
            )}
            <span>{uploading ? "Mengunggah..." : "Pilih File"}</span>
            <input
              type="file"
              accept={ACCEPTED_MIME_TYPES}
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
            />
          </label>

          {value && (
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <HiTrash className="w-4 h-4" />
              <span>Hapus</span>
            </button>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            PNG, JPG, WEBP, atau SVG. Maks. 2MB.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <HiExclamationCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
