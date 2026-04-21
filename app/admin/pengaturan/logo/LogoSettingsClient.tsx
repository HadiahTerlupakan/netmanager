"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HiArrowPath,
  HiCheckCircle,
  HiExclamationCircle,
  HiPhoto,
  HiXMark,
} from "react-icons/hi2";
import Image from "next/image";

type LogoSettings = {
  logoInvoice: string | null;
  logoAplikasi: string | null;
  logoLandingPage: string | null;
};

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
  const [settings, setSettings] = useState<LogoSettings>({
    logoInvoice: null,
    logoAplikasi: null,
    logoLandingPage: null,
  });
  const [previewInvoice, setPreviewInvoice] = useState<string | null>(null);
  const [previewAplikasi, setPreviewAplikasi] = useState<string | null>(null);
  const [previewLandingPage, setPreviewLandingPage] = useState<string | null>(
    null,
  );
  const fileInputInvoiceRef = useRef<HTMLInputElement>(null);
  const fileInputAplikasiRef = useRef<HTMLInputElement>(null);
  const fileInputLandingPageRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/settings/logo");
      if (res.ok) {
        const payload = await res.json();
        const data = unwrapApiData<LogoSettings>(payload);
        setSettings({
          logoInvoice: data.logoInvoice || null,
          logoAplikasi: data.logoAplikasi || null,
          logoLandingPage: data.logoLandingPage || null,
        });
        setPreviewInvoice(data.logoInvoice || null);
        setPreviewAplikasi(data.logoAplikasi || null);
        setPreviewLandingPage(data.logoLandingPage || null);
      } else {
        const errorData = await res.json();
        setError(errorData.error || "Gagal memuat pengaturan");
      }
    } catch (err: unknown) {
      console.error("Error loading settings:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat pengaturan",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleFileSelect = (
    type: "invoice" | "aplikasi" | "landing",
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi tipe file
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (PNG, JPG, JPEG)");
      return;
    }

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5MB");
      return;
    }

    // Preview gambar
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "invoice") {
        setPreviewInvoice(reader.result as string);
        return;
      }

      if (type === "aplikasi") {
        setPreviewAplikasi(reader.result as string);
        return;
      }

      setPreviewLandingPage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    uploadLogo(type, file);
  };

  const uploadLogo = async (
    type: "invoice" | "aplikasi" | "landing",
    file: File,
  ) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Gagal mengupload logo");
      }

      const payload = await res.json();
      const data = unwrapApiData<{ logoPath: string }>(payload);

      if (type === "invoice") {
        setSettings((prev) => ({ ...prev, logoInvoice: data.logoPath }));
        setPreviewInvoice(data.logoPath);
      } else if (type === "aplikasi") {
        setSettings((prev) => ({ ...prev, logoAplikasi: data.logoPath }));
        setPreviewAplikasi(data.logoPath);
      } else {
        setSettings((prev) => ({ ...prev, logoLandingPage: data.logoPath }));
        setPreviewLandingPage(data.logoPath);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      console.error("Error uploading logo:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengupload logo",
      );
      // Reset preview jika error
      if (type === "invoice") {
        setPreviewInvoice(settings.logoInvoice);
      } else if (type === "aplikasi") {
        setPreviewAplikasi(settings.logoAplikasi);
      } else {
        setPreviewLandingPage(settings.logoLandingPage);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = async (type: "invoice" | "aplikasi" | "landing") => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const res = await fetch("/api/settings/logo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Gagal menghapus logo");
      }

      if (type === "invoice") {
        setSettings((prev) => ({ ...prev, logoInvoice: null }));
        setPreviewInvoice(null);
      } else if (type === "aplikasi") {
        setSettings((prev) => ({ ...prev, logoAplikasi: null }));
        setPreviewAplikasi(null);
      } else {
        setSettings((prev) => ({ ...prev, logoLandingPage: null }));
        setPreviewLandingPage(null);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      console.error("Error removing logo:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menghapus logo",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Pengaturan Logo
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Kelola logo untuk invoice, aplikasi, dan landing page
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <HiArrowPath className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              Memuat pengaturan...
            </span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Logo Invoice */}
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-1">
                  Logo Invoice
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Logo yang akan ditampilkan pada invoice. Format yang didukung:
                  PNG, JPG, JPEG (maksimal 5MB)
                </p>
              </div>

              <div className="flex items-start gap-6">
                {/* Preview */}
                <div className="flex-shrink-0">
                  <div className="w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
                    {previewInvoice ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={
                            previewInvoice.startsWith("data:")
                              ? previewInvoice
                              : previewInvoice
                          }
                          alt="Logo Invoice Preview"
                          fill
                          className="object-contain"
                          onError={(_e) => {
                            // Fallback not easily handled with next/image in this context without external state or unoptimised
                            // For local preview, simple img might be better or disable eslint for this line if allowed
                            // But instruction says fix it.
                            // We can use unoptimized prop for data urls or external urls not in config
                          }}
                          unoptimized={true}
                        />
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <HiPhoto className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Belum ada logo
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-1 space-y-3">
                  <input
                    ref={fileInputInvoiceRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect("invoice", e)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputInvoiceRef.current?.click()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <HiPhoto className="w-4 h-4" />
                      {previewInvoice ? "Ganti Logo" : "Upload Logo"}
                    </button>
                    {previewInvoice && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLogo("invoice")}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        <HiXMark className="w-4 h-4" />
                        Hapus Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700"></div>

            {/* Logo Aplikasi */}
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-1">
                  Logo Aplikasi
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Logo yang akan ditampilkan di aplikasi. Format yang didukung:
                  PNG, JPG, JPEG (maksimal 5MB)
                </p>
              </div>

              <div className="flex items-start gap-6">
                {/* Preview */}
                <div className="flex-shrink-0">
                  <div className="w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
                    {previewAplikasi ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={
                            previewAplikasi.startsWith("data:")
                              ? previewAplikasi
                              : previewAplikasi
                          }
                          alt="Logo Aplikasi Preview"
                          fill
                          className="object-contain"
                          unoptimized={true}
                        />
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <HiPhoto className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Belum ada logo
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-1 space-y-3">
                  <input
                    ref={fileInputAplikasiRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect("aplikasi", e)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputAplikasiRef.current?.click()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <HiPhoto className="w-4 h-4" />
                      {previewAplikasi ? "Ganti Logo" : "Upload Logo"}
                    </button>
                    {previewAplikasi && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLogo("aplikasi")}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        <HiXMark className="w-4 h-4" />
                        Hapus Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-700"></div>

            {/* Logo Landing Page */}
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-1">
                  Logo Landing Page
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Logo yang akan ditampilkan di halaman landing page publik.
                  Format yang didukung: PNG, JPG, JPEG (maksimal 5MB)
                </p>
              </div>

              <div className="flex items-start gap-6">
                {/* Preview */}
                <div className="flex-shrink-0">
                  <div className="w-48 h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
                    {previewLandingPage ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={
                            previewLandingPage.startsWith("data:")
                              ? previewLandingPage
                              : previewLandingPage
                          }
                          alt="Logo Landing Page Preview"
                          fill
                          className="object-contain"
                          unoptimized={true}
                        />
                      </div>
                    ) : (
                      <div className="text-center p-4">
                        <HiPhoto className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Belum ada logo
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-1 space-y-3">
                  <input
                    ref={fileInputLandingPageRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect("landing", e)}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputLandingPageRef.current?.click()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <HiPhoto className="w-4 h-4" />
                      {previewLandingPage ? "Ganti Logo" : "Upload Logo"}
                    </button>
                    {previewLandingPage && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLogo("landing")}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        <HiXMark className="w-4 h-4" />
                        Hapus Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-400">
                    Logo berhasil diupdate
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
