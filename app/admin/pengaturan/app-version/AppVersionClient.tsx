"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect, useCallback } from "react";
import {
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineCloudArrowUp,
  HiOutlineDevicePhoneMobile,
  HiOutlineExclamationTriangle,
  HiOutlineQuestionMarkCircle,
} from "react-icons/hi2";
import { usePermission } from "@/hooks/use-permission";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface AppVersion {
  id: string;
  version: string;
  buildNumber: number;
  versionCode: number;
  platform: string;
  apkUrl: string | null;
  apkSize: number | null;
  releaseNotes: string | null;
  isForceUpdate: boolean;
  minVersion: string | null;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function AppVersionClient() {
  // Permission checks
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("app_version:create");
  const canUpdate = hasPermission("app_version:update");
  const canDelete = hasPermission("app_version:delete");

  // Toast
  const { showToast } = useToast();

  // State
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<AppVersion | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    version: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    updatedCount: number;
    outdatedCount: number;
    unknownCount: number;
    latestVersion: AppVersion | null;
  } | null>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/app-version/stats");
      const payload = await res.json();
      if (payload && !payload.error) {
        setStats(payload.data || payload);
        setStatsError(null);
      } else {
        setStatsError(payload.error || "Gagal memuat statistik");
      }
    } catch (error: unknown) {
      clientLogger.error("Failed to fetch stats:", error);
      setStatsError("Gagal memuat statistik. Silakan refresh halaman.");
    }
  }, []);

  // Fetch versions
  const fetchVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/app-version?page=${pagination.page}&limit=${pagination.limit}`,
      );
      const data = await res.json();
      if (data.success) {
        setVersions(data.data || []);
        // Handle standard pagination meta from apiPaginated
        if (data.meta) {
          setPagination((prev) => ({
            ...prev,
            ...data.meta,
          }));
        }
        // Legacy fallback
        else if (data.pagination) {
          setPagination((prev) => ({
            ...prev,
            ...data.pagination,
          }));
        }
      } else {
        setError(data.error || "Gagal memuat daftar versi");
      }
    } catch (error: unknown) {
      clientLogger.error("Error fetching versions:", error);
      setError("Gagal memuat daftar versi. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // Refresh both stats and versions after mutations
  const refreshData = useCallback(() => {
    fetchStats();
    fetchVersions();
  }, [fetchStats, fetchVersions]);

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Table columns
  const columns: Column<AppVersion>[] = [
    {
      key: "version",
      header: "Versi",
      priority: "primary",
      render: (item) => (
        <div className="flex items-center gap-2">
          <HiOutlineDevicePhoneMobile className="h-5 w-5 text-indigo-600" />
          <div>
            <div className="font-semibold">v{item.version}</div>
            <div className="text-xs text-gray-500">
              Build {item.buildNumber} • Code {item.versionCode}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "platform",
      header: "Platform",
      priority: "secondary",
      render: (item) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            item.platform === "ios"
              ? "bg-gray-100 text-gray-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {item.platform.toUpperCase()}
        </span>
      ),
    },
    {
      key: "isForceUpdate",
      header: "Tipe Update",
      priority: "secondary",
      render: (item) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            item.isForceUpdate
              ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
              : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
          }`}
        >
          {item.isForceUpdate ? "Wajib" : "Opsional"}
        </span>
      ),
    },
    {
      key: "apkSize",
      header: "Ukuran",
      priority: "tertiary",
      render: (item) => formatFileSize(item.apkSize),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "secondary",
      render: (item) => (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            item.isActive
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {item.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    {
      key: "publishedAt",
      header: "Dipublish",
      priority: "tertiary",
      render: (item) => formatDate(item.publishedAt),
    },
  ];

  // Handle edit
  const handleEdit = (item: AppVersion) => {
    setSelectedVersion(item);
    setShowEditModal(true);
  };

  // Handle delete
  const handleDelete = (item: AppVersion) => {
    setDeleteConfirm({
      id: item.id,
      version: item.version,
    });
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;

    try {
      const res = await fetch(`/api/admin/app-version/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", "Versi berhasil dihapus");
        refreshData();
      } else {
        showToast("error", data.error || "Gagal menghapus versi");
      }
    } catch (error: unknown) {
      clientLogger.error("Error deleting version:", error);
      showToast("error", "Terjadi kesalahan saat menghapus versi");
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Render actions
  const renderActions = (item: AppVersion) => (
    <div className="flex gap-1">
      {canUpdate && (
        <Button
          type="button"
          onClick={() => handleEdit(item)}
          variant="ghost"
          size="icon-sm"
          title="Edit"
        >
          <HiOutlinePencil className="h-4 w-4" />
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          onClick={() => item.isActive && handleDelete(item)}
          variant="ghost"
          size="icon-sm"
          title={
            item.isActive
              ? "Hapus permanen"
              : "Tidak bisa hapus versi yang sedang aktif"
          }
          className={
            item.isActive
              ? "text-red-600 hover:bg-red-50"
              : "text-gray-400 cursor-not-allowed"
          }
          disabled={!item.isActive}
        >
          <HiOutlineTrash className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Versi Aplikasi
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Kelola versi aplikasi mobile dan force update
          </p>
        </div>
        {canCreate && (
          <Button
            type="button"
            onClick={() => setShowUploadModal(true)}
            variant="default"
          >
            <HiOutlineCloudArrowUp className="h-5 w-5" />
            Upload Versi Baru
          </Button>
        )}
      </div>
      {/* Stats Error */}
      {statsError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{statsError}</p>
        </div>
      )}
      {/* Stats Cards */}
      {stats && !statsError && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                <HiOutlineDevicePhoneMobile className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Sudah Update
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.updatedCount}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.latestVersion
                    ? `Versi ${stats.latestVersion.version} (${stats.latestVersion.versionCode})`
                    : "-"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400">
                <HiOutlineExclamationTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Belum Update
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.outdatedCount}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Perlu update segera
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                <HiOutlineQuestionMarkCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Tidak Diketahui
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.unknownCount}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Belum login sejak update
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Versions List Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      {/* List Versions */} {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <ResponsiveTable
          data={versions}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Belum ada versi aplikasi yang diupload"
          renderActions={renderActions}
        />
      </div>
      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Menampilkan {(pagination.page - 1) * pagination.limit + 1} -{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
            dari {pagination.total}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={pagination.page <= 1}
              variant="outline"
              size="sm"
            >
              Prev
            </Button>
            <Button
              type="button"
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={pagination.page >= pagination.totalPages}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {/* Upload Modal */}
      {showUploadModal && (
        <UploadVersionModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            refreshData();
          }}
        />
      )}
      {/* Edit Modal */}
      {showEditModal && selectedVersion && (
        <EditVersionModal
          version={selectedVersion}
          onClose={() => {
            setShowEditModal(false);
            setSelectedVersion(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedVersion(null);
            refreshData();
          }}
        />
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Hapus Versi Aplikasi"
        description={`Apakah Anda yakin ingin menghapus versi ${deleteConfirm?.version}? File APK yang terkait juga akan dihapus secara permanen.`}
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

// Upload Modal Component
function UploadVersionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [formData, setFormData] = useState({
    version: "",
    buildNumber: "",
    versionCode: "",
    platform: "android",
    releaseNotes: "",
    isForceUpdate: false,
    minVersion: "",
  });
  const [apkFile, setApkFile] = useState<File | null>(null);
  const [isForceLocal, setIsForceLocal] = useState(false);
  const [uploadedApk, setUploadedApk] = useState<{
    key: string;
    filename: string;
    size: number;
  } | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);

  // Reset upload state when modal opens
  useEffect(() => {
    setUploadProgress(0);
    setStatus("");
    setLoading(false);
  }, []);

  const MAX_APK_SIZE = 500 * 1024 * 1024;

  const uploadApkToR2 = async (file: File) => {
    setStatus("Meminta URL upload...");
    const presignedRes = await fetch("/api/admin/app-version/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: "application/vnd.android.package-archive",
        size: file.size,
      }),
    });
    if (!presignedRes.ok) {
      const err = await presignedRes.json();
      throw new Error(err.error || "Gagal mendapatkan URL upload");
    }
    const { uploadUrl, key } = await presignedRes.json();

    setStatus("Mengupload file ke storage...");
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) resolve(true);
          else reject(new Error("Gagal mengupload file ke storage"));
        }
      };
      xhr.onerror = () => reject(new Error("Network error saat upload"));
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader(
        "Content-Type",
        "application/vnd.android.package-archive",
      );
      xhr.send(file);
    });

    return { key, filename: file.name, size: file.size };
  };

  const parseUploadedApkMetadata = async (uploadedKey: string) => {
    setStatus("Membaca metadata APK...");
    const res = await fetch("/api/admin/app-version/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadedKey }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Gagal membaca metadata APK");
    }
    return data.data as {
      version: string;
      buildNumber: number;
      versionCode: number;
    };
  };

  const handleApkSelect = async (file: File | null) => {
    setApkFile(file);
    setUploadedApk(null);
    setAutoDetected(false);
    setUploadProgress(0);
    setStatus("");
    if (!file) return;

    if (file.size > MAX_APK_SIZE) {
      showToast("error", "Ukuran APK maksimal 500MB");
      return;
    }

    if (isForceLocal) {
      // Local mode: parsing terjadi server-side saat submit final
      return;
    }

    setLoading(true);
    try {
      const uploaded = await uploadApkToR2(file);
      setUploadedApk(uploaded);

      const meta = await parseUploadedApkMetadata(uploaded.key);
      setFormData((prev) => ({
        ...prev,
        version: meta.version || prev.version,
        buildNumber: String(meta.buildNumber || prev.buildNumber || ""),
        versionCode: String(meta.versionCode || prev.versionCode || ""),
      }));
      setAutoDetected(true);
      setStatus("Metadata terdeteksi");
    } catch (error: unknown) {
      clientLogger.error("Error preparing APK:", error);
      const msg =
        error instanceof Error ? error.message : "Gagal menyiapkan APK";
      showToast("error", msg);
      setApkFile(null);
      setUploadedApk(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (apkFile && apkFile.size > MAX_APK_SIZE) {
      showToast("error", "Ukuran APK maksimal 500MB");
      return;
    }

    const hasUploadedKey = Boolean(uploadedApk);
    const hasApkSource = Boolean(apkFile && (isForceLocal || hasUploadedKey));
    if (
      !hasApkSource &&
      (!formData.version || !formData.buildNumber || !formData.versionCode)
    ) {
      showToast(
        "error",
        "Upload APK untuk auto-detect versi, atau isi manual field Versi, Build, dan Code",
      );
      return;
    }

    setLoading(true);

    try {
      setStatus("Menyimpan data...");

      const form = new FormData();
      if (formData.version) form.append("version", formData.version);
      if (formData.buildNumber)
        form.append("buildNumber", formData.buildNumber);
      if (formData.versionCode)
        form.append("versionCode", formData.versionCode);
      form.append("platform", formData.platform);
      form.append("releaseNotes", formData.releaseNotes);
      form.append("isForceUpdate", formData.isForceUpdate.toString());
      if (formData.minVersion) form.append("minVersion", formData.minVersion);

      if (isForceLocal) {
        if (apkFile) form.append("apk", apkFile);
        form.append("forceLocal", "true");
        setStatus("Mengupload ke Local Storage...");
      } else if (uploadedApk) {
        form.append("uploadedKey", uploadedApk.key);
        form.append("uploadedFilename", uploadedApk.filename);
        form.append("uploadedSize", uploadedApk.size.toString());
      }

      const res = await fetch("/api/admin/app-version", {
        method: "POST",
        body: form,
      });

      const data = await res.json();
      if (data.success) {
        showToast("success", "Versi aplikasi berhasil diupload");
        onSuccess();
      } else {
        showToast("error", data.error || "Gagal menyimpan versi");
      }
    } catch (error: unknown) {
      clientLogger.error("Error uploading version:", error);
      const msg = error instanceof Error ? error.message : "Terjadi kesalahan";
      showToast("error", msg);
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setStatus("");
    }
  };

  const hasApk = !!apkFile;

  return (
    <Modal isOpen={true} onClose={onClose} title="Upload Versi Baru" size="lg">
      <div className="space-y-4">
        <form id="upload-form" onSubmit={handleSubmit} className="space-y-4">
          {/* APK File - prioritas utama */}
          <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-4 border-2 border-dashed border-indigo-300">
            <label
              htmlFor="upload-apk-file"
              className="block text-sm font-medium mb-2 text-indigo-700 dark:text-indigo-300"
            >
              📦 File APK
            </label>
            <input
              id="upload-apk-file"
              type="file"
              accept=".apk"
              onChange={(e) => handleApkSelect(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            />
            {apkFile ? (
              <p className="text-sm text-green-600 mt-2">
                ✅ {apkFile.name} ({(apkFile.size / (1024 * 1024)).toFixed(1)}{" "}
                MB)
                <br />
                <span className="text-xs">
                  {autoDetected
                    ? "Versi terdeteksi otomatis dari APK"
                    : isForceLocal
                      ? "Mode Local Storage — versi akan diparse server saat submit"
                      : "Menyiapkan APK..."}
                </span>
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-2">
                💡 Upload APK untuk auto-detect Versi, Build, dan Code
              </p>
            )}

            {/* Progress Bar & Skeleton Loading */}
            {loading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-2">
                    {uploadProgress === 0 && (
                      <div className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                    )}
                    {status || "Menyiapkan upload..."}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>

                {uploadProgress === 0 ? (
                  // Skeleton / Indeterminate Loading
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                    <div className="bg-indigo-300 dark:bg-indigo-700 h-2.5 rounded-full w-full animate-pulse"></div>
                  </div>
                ) : (
                  // Actual Progress Bar
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual input - selalu tampil, disabled jika APK terdeteksi */}
          <>
            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                  {autoDetected
                    ? "Terdeteksi dari APK"
                    : hasApk
                      ? "Menunggu auto-detect (atau isi manual)"
                      : "Atau isi manual"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="upload-version"
                  className="block text-sm font-medium mb-1"
                >
                  Versi <span className="text-red-500">*</span>
                </label>
                <input
                  id="upload-version"
                  type="text"
                  placeholder={autoDetected ? "Auto-detected" : "1.0.54"}
                  value={formData.version}
                  onChange={(e) =>
                    setFormData({ ...formData, version: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${
                    autoDetected ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  disabled={autoDetected || loading}
                />
              </div>
              <div>
                <label
                  htmlFor="upload-build-number"
                  className="block text-sm font-medium mb-1"
                >
                  Build <span className="text-red-500">*</span>
                </label>
                <input
                  id="upload-build-number"
                  type="number"
                  placeholder={autoDetected ? "Auto-detected" : "47"}
                  value={formData.buildNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, buildNumber: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${
                    autoDetected ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  disabled={autoDetected || loading}
                />
              </div>
              <div>
                <label
                  htmlFor="upload-version-code"
                  className="block text-sm font-medium mb-1"
                >
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="upload-version-code"
                  type="number"
                  placeholder={autoDetected ? "Auto-detected" : "47"}
                  value={formData.versionCode}
                  onChange={(e) =>
                    setFormData({ ...formData, versionCode: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${
                    autoDetected ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  disabled={autoDetected || loading}
                />
              </div>
            </div>
          </>

          <div>
            <label
              htmlFor="upload-platform"
              className="block text-sm font-medium mb-1"
            >
              Platform
            </label>
            <select
              id="upload-platform"
              value={formData.platform}
              onChange={(e) =>
                setFormData({ ...formData, platform: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            >
              <option value="android">Android</option>
              <option value="ios">iOS</option>
              <option value="all">Semua Platform</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="upload-release-notes"
              className="block text-sm font-medium mb-1"
            >
              Catatan Rilis
            </label>
            <textarea
              id="upload-release-notes"
              value={formData.releaseNotes}
              onChange={(e) =>
                setFormData({ ...formData, releaseNotes: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              rows={3}
              placeholder="Apa yang baru di versi ini?"
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="forceUpdate"
              checked={formData.isForceUpdate}
              onChange={(e) =>
                setFormData({ ...formData, isForceUpdate: e.target.checked })
              }
              className="h-4 w-4"
              disabled={loading}
            />
            <label htmlFor="forceUpdate" className="text-sm">
              <span className="font-medium">Force Update</span>
              <span className="text-gray-500"> - Pengguna wajib update</span>
            </label>
          </div>

          {/* Force Local Option (Moved for visibility) */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="forceLocal"
              checked={isForceLocal}
              onChange={(e) => {
                setIsForceLocal(e.target.checked);
                setUploadedApk(null);
                setAutoDetected(false);
              }}
              className="h-4 w-4"
              disabled={loading}
            />
            <label
              htmlFor="forceLocal"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Simpan di Local Storage (Bypass R2)
            </label>
          </div>

          <div>
            <label
              htmlFor="upload-min-version"
              className="block text-sm font-medium mb-1"
            >
              Minimum Versi (Opsional)
            </label>
            <input
              id="upload-min-version"
              type="text"
              placeholder="1.0.50"
              value={formData.minVersion}
              onChange={(e) =>
                setFormData({ ...formData, minVersion: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Versi di bawah ini akan dipaksa update
            </p>
          </div>
        </form>
      </div>

      <ModalFooter>
        <Button
          type="button"
          onClick={onClose}
          variant="outline"
          disabled={loading}
        >
          Batal
        </Button>
        <Button
          type="submit"
          form="upload-form"
          disabled={loading}
          variant="default"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Proses...</span>
            </>
          ) : (
            "Upload"
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// Edit Modal Component
function EditVersionModal({
  version,
  onClose,
  onSuccess,
}: {
  version: AppVersion;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    releaseNotes: version.releaseNotes || "",
    isForceUpdate: version.isForceUpdate,
    isActive: version.isActive,
    minVersion: version.minVersion || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/app-version/${version.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        showToast("success", "Versi berhasil diperbarui");
        onSuccess();
      } else {
        showToast("error", data.error || "Gagal update versi");
      }
    } catch (error: unknown) {
      clientLogger.error("Error updating version:", error);
      showToast("error", "Terjadi kesalahan saat update versi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Edit v${version.version}`}
      size="md"
    >
      <div className="space-y-4">
        <form id="edit-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="edit-release-notes"
              className="block text-sm font-medium mb-1"
            >
              Catatan Rilis
            </label>
            <textarea
              id="edit-release-notes"
              value={formData.releaseNotes}
              onChange={(e) =>
                setFormData({ ...formData, releaseNotes: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              rows={4}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="forceUpdateEdit"
              checked={formData.isForceUpdate}
              onChange={(e) =>
                setFormData({ ...formData, isForceUpdate: e.target.checked })
              }
              className="h-4 w-4"
            />
            <label htmlFor="forceUpdateEdit" className="text-sm font-medium">
              Force Update
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.target.checked })
              }
              className="h-4 w-4"
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Aktif
            </label>
          </div>

          <div>
            <label
              htmlFor="edit-min-version"
              className="block text-sm font-medium mb-1"
            >
              Minimum Versi (Opsional)
            </label>
            <input
              id="edit-min-version"
              type="text"
              placeholder="1.0.50"
              value={formData.minVersion}
              onChange={(e) =>
                setFormData({ ...formData, minVersion: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Kosongkan jika versi ini tidak ingin memaksa minimum versi
              tertentu
            </p>
          </div>
        </form>
      </div>

      <ModalFooter>
        <Button type="button" onClick={onClose} variant="outline">
          Batal
        </Button>
        <Button
          type="submit"
          form="edit-form"
          disabled={loading}
          variant="default"
        >
          {loading ? "Menyimpan..." : "Simpan"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
