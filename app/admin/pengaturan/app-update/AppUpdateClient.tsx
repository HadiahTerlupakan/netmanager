"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiOutlineCloudArrowUp,
  HiOutlinePlayPause,
  HiOutlineTrash,
  HiOutlineDevicePhoneMobile,
} from "react-icons/hi2";

import { clientLogger } from "@/lib/client-logger";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";

interface AppUpdateRow {
  id: string;
  manifestId: string;
  channel: "staging" | "production" | string;
  runtimeVersion: string;
  platform: string;
  bundleSize: number;
  bundleHash: string;
  releaseNotes: string | null;
  commitTime: string;
  isActive: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CHANNEL_OPTIONS: AppUpdateRow["channel"][] = ["staging", "production"];
const PLATFORM_OPTIONS = ["android", "ios"] as const;

export function AppUpdateClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("app_version:create");
  const canUpdate = hasPermission("app_version:update");
  const canDelete = hasPermission("app_version:delete");
  const { showToast } = useToast();

  const [rows, setRows] = useState<AppUpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AppUpdateRow | null>(null);
  const [filterChannel, setFilterChannel] = useState<string>("");
  const [filterPlatform, setFilterPlatform] = useState<string>("");

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (filterChannel) params.set("channel", filterChannel);
      if (filterPlatform) params.set("platform", filterPlatform);

      const res = await fetch(`/api/admin/app-update?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRows(data.data || []);
        if (data.meta) {
          setPagination((prev) => ({ ...prev, ...data.meta }));
        }
      } else {
        setError(data.error || "Gagal memuat daftar update");
      }
    } catch (err: unknown) {
      clientLogger.error("Error loading app updates:", err);
      setError("Gagal memuat daftar update");
    } finally {
      setLoading(false);
    }
  }, [filterChannel, filterPlatform, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const refresh = useCallback(() => {
    fetchRows();
  }, [fetchRows]);

  const handleToggleActive = async (row: AppUpdateRow) => {
    try {
      const res = await fetch(`/api/admin/app-update/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          "success",
          row.isActive ? "Update dinonaktifkan" : "Update diaktifkan",
        );
        refresh();
      } else {
        showToast("error", data.error || "Gagal mengubah status");
      }
    } catch (err: unknown) {
      clientLogger.error("Error toggling active:", err);
      showToast("error", "Terjadi kesalahan saat mengubah status");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/admin/app-update/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", "Expo update berhasil dihapus");
        refresh();
      } else {
        showToast("error", data.error || "Gagal menghapus update");
      }
    } catch (err: unknown) {
      clientLogger.error("Error deleting update:", err);
      showToast("error", "Terjadi kesalahan saat menghapus update");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "-";
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const columns: Column<AppUpdateRow>[] = useMemo(
    () => [
      {
        key: "channel",
        header: "Channel",
        priority: "primary",
        render: (item) => (
          <span
            className={`px-2 py-1 text-xs rounded-full font-semibold ${
              item.channel === "production"
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
            }`}
          >
            {item.channel.toUpperCase()}
          </span>
        ),
      },
      {
        key: "runtimeVersion",
        header: "Runtime",
        priority: "primary",
        render: (item) => (
          <div>
            <div className="font-semibold">v{item.runtimeVersion}</div>
            <div className="text-xs text-gray-500">{item.platform}</div>
          </div>
        ),
      },
      {
        key: "bundleSize",
        header: "Size",
        priority: "secondary",
        render: (item) => formatBytes(item.bundleSize),
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
        key: "commitTime",
        header: "Dipublish",
        priority: "tertiary",
        render: (item) => formatDate(item.commitTime),
      },
    ],
    [],
  );

  const renderActions = (row: AppUpdateRow) => (
    <div className="flex gap-1">
      {canUpdate && (
        <Button
          type="button"
          onClick={() => handleToggleActive(row)}
          variant="ghost"
          size="icon-sm"
          title={row.isActive ? "Nonaktifkan" : "Aktifkan"}
        >
          <HiOutlinePlayPause className="h-4 w-4" />
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          onClick={() => setDeleteConfirm(row)}
          variant="ghost"
          size="icon-sm"
          title="Hapus"
          className="text-red-600 hover:bg-red-50"
        >
          <HiOutlineTrash className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Update Aplikasi (Expo OTA)
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Kelola JS bundle update untuk aplikasi mobile via Expo Updates.
            Untuk perubahan native (permission/library), tetap rilis APK lewat
            Play Store.
          </p>
        </div>
        {canCreate && (
          <Button
            type="button"
            onClick={() => setShowUploadModal(true)}
            variant="default"
          >
            <HiOutlineCloudArrowUp className="h-5 w-5" />
            Upload Bundle Baru
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filterChannel}
          onChange={(event) => setFilterChannel(event.target.value)}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="">Semua Channel</option>
          {CHANNEL_OPTIONS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>
        <select
          value={filterPlatform}
          onChange={(event) => setFilterPlatform(event.target.value)}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="">Semua Platform</option>
          {PLATFORM_OPTIONS.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <ResponsiveTable
          data={rows}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Belum ada Expo update yang diupload"
          renderActions={renderActions}
        />
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Halaman {pagination.page} dari {pagination.totalPages}
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

      {showUploadModal && (
        <UploadUpdateModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Hapus Expo Update"
        description={
          deleteConfirm
            ? `Hapus bundle ${deleteConfirm.runtimeVersion} (${deleteConfirm.channel} • ${deleteConfirm.platform})? File bundle akan dihapus permanen.`
            : ""
        }
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

function UploadUpdateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState<"staging" | "production">("staging");
  const [platform, setPlatform] = useState<"android" | "ios">("android");
  const [runtimeVersion, setRuntimeVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [manifestText, setManifestText] = useState("");
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [assetFiles, setAssetFiles] = useState<File[]>([]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bundleFile) {
      showToast("error", "Bundle file wajib disertakan");
      return;
    }
    if (!manifestText.trim()) {
      showToast("error", "Manifest JSON wajib disertakan");
      return;
    }
    try {
      JSON.parse(manifestText);
    } catch {
      showToast("error", "Manifest harus JSON valid");
      return;
    }

    setLoading(true);
    setProgress(0);
    setStatus("Mengupload bundle...");

    try {
      const form = new FormData();
      form.append("channel", channel);
      form.append("platform", platform);
      form.append("runtimeVersion", runtimeVersion);
      form.append("releaseNotes", releaseNotes);
      form.append("manifest", manifestText);
      form.append("bundle", bundleFile);
      assetFiles.forEach((file) => form.append("assets", file));

      const result = await new Promise<{ success: boolean; error?: string }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          });
          xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            try {
              const data = JSON.parse(xhr.responseText) as {
                success?: boolean;
                error?: string;
              };
              if (xhr.status >= 200 && xhr.status < 300 && data.success) {
                resolve({ success: true });
              } else {
                resolve({
                  success: false,
                  error: data.error || `HTTP ${xhr.status}`,
                });
              }
            } catch {
              resolve({
                success: false,
                error: `HTTP ${xhr.status}: ${xhr.statusText}`,
              });
            }
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.open("POST", "/api/admin/app-update");
          xhr.send(form);
        },
      );

      if (result.success) {
        showToast("success", "Expo update berhasil diupload");
        onSuccess();
      } else {
        showToast("error", result.error || "Gagal upload");
      }
    } catch (err: unknown) {
      clientLogger.error("Upload update error:", err);
      showToast(
        "error",
        err instanceof Error ? err.message : "Terjadi kesalahan",
      );
    } finally {
      setLoading(false);
      setProgress(0);
      setStatus("");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Upload Expo Update" size="lg">
      <div className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <HiOutlineDevicePhoneMobile className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-blue-800 dark:text-blue-200">
              Generate bundle dengan:{" "}
              <code>npx expo export --platform android</code> atau{" "}
              <code>npx expo export --platform ios</code>. Hasil ada di folder
              <code> dist/</code>. Upload <strong>bundle</strong> (file{" "}
              <code>.hbc</code>/<code>.bundle</code>), <strong>manifest</strong>{" "}
              (<code>dist/metadata.json</code> atau manifest custom), dan semua{" "}
              <strong>assets</strong> dari folder <code>dist/assets</code>.
            </div>
          </div>
        </div>

        <form
          id="app-update-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Channel <span className="text-red-500">*</span>
              </label>
              <select
                value={channel}
                onChange={(event) =>
                  setChannel(event.target.value as "staging" | "production")
                }
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                disabled={loading}
              >
                <option value="staging">staging</option>
                <option value="production">production</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Platform <span className="text-red-500">*</span>
              </label>
              <select
                value={platform}
                onChange={(event) =>
                  setPlatform(event.target.value as "android" | "ios")
                }
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                disabled={loading}
              >
                <option value="android">android</option>
                <option value="ios">ios</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Runtime Version <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={runtimeVersion}
              onChange={(event) => setRuntimeVersion(event.target.value)}
              placeholder="1.0.4"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Harus cocok dengan native APK build (mis.{" "}
              <code>app.json &gt; expo.runtimeVersion</code>). Hanya app dengan
              runtime version sama yang menerima bundle ini.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Bundle File <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".bundle,.hbc,.js"
              onChange={(event) =>
                setBundleFile(event.target.files?.[0] || null)
              }
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            />
            {bundleFile && (
              <p className="text-xs text-green-600 mt-1">
                ✅ {bundleFile.name} (
                {(bundleFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Manifest JSON <span className="text-red-500">*</span>
            </label>
            <textarea
              value={manifestText}
              onChange={(event) => setManifestText(event.target.value)}
              rows={6}
              placeholder='{"id":"...","createdAt":"...","launchAsset":{"hash":"..."},"assets":[]}'
              className="w-full px-3 py-2 border rounded-lg font-mono text-xs dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Asset Files (opsional, dari <code>dist/assets/</code>)
            </label>
            <input
              type="file"
              multiple
              onChange={(event) =>
                setAssetFiles(Array.from(event.target.files ?? []))
              }
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            />
            {assetFiles.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {assetFiles.length} file dipilih
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Catatan Rilis (opsional)
            </label>
            <textarea
              value={releaseNotes}
              onChange={(event) => setReleaseNotes(event.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              disabled={loading}
            />
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div
                  className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
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
          form="app-update-form"
          disabled={loading || !bundleFile}
          variant="default"
        >
          {loading ? "Proses..." : "Upload"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
