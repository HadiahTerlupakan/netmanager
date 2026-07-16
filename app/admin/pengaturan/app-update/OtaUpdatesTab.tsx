"use client";

import { useCallback, useMemo, useState } from "react";
import { HiOutlinePlayPause, HiOutlineTrash } from "react-icons/hi2";

import { clientLogger } from "@/lib/client-logger";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";

interface ContactSettings {
  url: string | null;
  label: string | null;
}

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

export function OtaUpdatesTab() {
  const { hasPermission } = usePermission();
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
  const [deleteConfirm, setDeleteConfirm] = useState<AppUpdateRow | null>(null);
  const [filterChannel, setFilterChannel] = useState<string>("");
  const [filterPlatform, setFilterPlatform] = useState<string>("");

  // Contact settings state
  const [contactForm, setContactForm] = useState<ContactSettings>({
    url: null,
    label: null,
  });
  const [savingContact, setSavingContact] = useState(false);

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

  /** Mengambil pengaturan kontak admin dari API. */
  const fetchContactSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/app-update/contact-settings");
      const data = await res.json();
      if (data.success) {
        setContactForm({
          url: data.data?.url ?? null,
          label: data.data?.label ?? null,
        });
      }
    } catch (err: unknown) {
      clientLogger.error("Error loading contact settings:", err);
    }
  }, []);

  const [hasFetchedRows, setHasFetchedRows] = useState(false);
  if (!hasFetchedRows) {
    setHasFetchedRows(true);
    void fetchRows();
  }

  const [hasFetchedContact, setHasFetchedContact] = useState(false);
  if (!hasFetchedContact) {
    setHasFetchedContact(true);
    void fetchContactSettings();
  }

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

  /** Menyimpan pengaturan kontak admin ke API. */
  const handleSaveContact = async () => {
    setSavingContact(true);
    try {
      const res = await fetch("/api/admin/app-update/contact-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appUpdateContactUrl: contactForm.url || null,
          appUpdateContactLabel: contactForm.label || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", "Pengaturan kontak berhasil disimpan");
      } else {
        showToast("error", data.error || "Gagal menyimpan pengaturan kontak");
      }
    } catch (err: unknown) {
      clientLogger.error("Error saving contact settings:", err);
      showToast("error", "Terjadi kesalahan saat menyimpan pengaturan kontak");
    } finally {
      setSavingContact(false);
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
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          OTA (JS Bundle)
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kelola JS bundle update via Expo Updates. Untuk perubahan native,
          rilis APK lewat Play Store (tab Rilis APK).
        </p>
      </div>

      {/* Pengaturan Kontak Admin */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Kontak Admin untuk Update APK
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Tautan dan label tombol yang ditampilkan di aplikasi mobile saat user
          perlu mengunduh APK versi terbaru. Kosongkan untuk menyembunyikan
          tombol.
        </p>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="contact-url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              URL Hubungi Admin
            </label>
            <input
              id="contact-url"
              type="text"
              value={contactForm.url ?? ""}
              onChange={(e) =>
                setContactForm((prev) => ({
                  ...prev,
                  url: e.target.value || null,
                }))
              }
              placeholder="https://wa.me/628123456789 atau mailto:admin@radpro.id"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label
              htmlFor="contact-label"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Label Tombol
            </label>
            <input
              id="contact-label"
              type="text"
              value={contactForm.label ?? ""}
              onChange={(e) =>
                setContactForm((prev) => ({
                  ...prev,
                  label: e.target.value || null,
                }))
              }
              placeholder="Hubungi Admin via WhatsApp"
              maxLength={50}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {canUpdate && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSaveContact}
                disabled={savingContact}
                variant="default"
                size="sm"
              >
                {savingContact ? "Menyimpan..." : "Simpan Pengaturan Kontak"}
              </Button>
            </div>
          )}
        </div>
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
