"use client";

import { useCallback, useState } from "react";
import { HiOutlineTrash } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/use-permission";
import { clientLogger } from "@/lib/client-logger";

interface AppRelease {
  id: string;
  platform: string;
  version: string;
  versionCode: number;
  isForceUpdate: boolean;
  isActive: boolean;
  releasedAt: string;
  releaseNotes: string | null;
}

interface ReleaseForm {
  platform: string;
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  isForceUpdate: boolean;
  architecture: string;
  rolloutPercentage: number;
}

const PLATFORM_OPTIONS = ["android", "ios"] as const;
const ARCH_OPTIONS = ["universal", "arm64-v8a", "armeabi-v7a", "x86_64"];

const INITIAL_FORM: ReleaseForm = {
  platform: "android",
  version: "",
  versionCode: 0,
  downloadUrl: "",
  releaseNotes: "",
  isForceUpdate: false,
  architecture: "universal",
  rolloutPercentage: 100,
};

const INPUT_CLASS =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export function AppReleasesTab() {
  const { hasPermission } = usePermission();
  const canManage = hasPermission("app-release:manage");
  const { showToast } = useToast();

  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ReleaseForm>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<AppRelease | null>(null);

  const fetchReleases = useCallback(async (filter: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("platform", filter);
      const qs = params.toString();
      const url = qs
        ? `/api/admin/app-releases?${qs}`
        : "/api/admin/app-releases";
      const res = await fetch(url);
      const data = await res.json();
      setReleases(data?.data ?? []);
    } catch (err) {
      clientLogger.error("Error loading app releases:", err);
      setError("Gagal memuat data release");
    } finally {
      setLoading(false);
    }
  }, []);

  const [hasFetched, setHasFetched] = useState(false);
  if (!hasFetched) {
    setHasFetched(true);
    void fetchReleases(platformFilter);
  }

  const setField = <K extends keyof ReleaseForm>(
    key: K,
    value: ReleaseForm[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/app-releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          minSupportedVersion: null,
          architecture: form.architecture || null,
          minOsVersion: null,
          apkSizeBytes: null,
          releaseNotes: form.releaseNotes || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("success", "Release berhasil dibuat");
        setShowForm(false);
        setForm(INITIAL_FORM);
        void fetchReleases(platformFilter);
      } else {
        showToast(
          "error",
          data.message ?? data.error ?? "Gagal menyimpan release",
        );
      }
    } catch (err) {
      clientLogger.error("Error creating app release:", err);
      showToast("error", "Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/admin/app-releases/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("success", "Release dinonaktifkan");
        void fetchReleases(platformFilter);
      } else {
        const data = (await res.json().catch((): null => null)) as {
          error?: string;
        } | null;
        showToast("error", data?.error ?? "Gagal menghapus release");
      }
    } catch (err) {
      clientLogger.error("Error deleting app release:", err);
      showToast("error", "Terjadi kesalahan saat menghapus");
    } finally {
      setDeleteConfirm(null);
    }
  };

  const columns: Column<AppRelease>[] = [
    {
      key: "platform",
      header: "Platform",
      priority: "primary",
      render: (r) => (
        <span className="capitalize font-medium">{r.platform}</span>
      ),
    },
    {
      key: "version",
      header: "Version",
      priority: "primary",
      render: (r) => (
        <span className="font-bold text-indigo-700 dark:text-indigo-400">
          {r.version}
        </span>
      ),
    },
    { key: "versionCode", header: "Code", priority: "secondary" },
    {
      key: "isForceUpdate",
      header: "Force Update",
      priority: "secondary",
      align: "center",
      render: (r) => (
        <span
          className={
            r.isForceUpdate
              ? "text-amber-600 font-semibold"
              : "text-neutral-400"
          }
        >
          {r.isForceUpdate ? "Ya" : "—"}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      priority: "primary",
      align: "center",
      render: (r) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            r.isActive
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
          }`}
        >
          {r.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
    {
      key: "releasedAt",
      header: "Tanggal Rilis",
      priority: "secondary",
      render: (r) =>
        new Date(r.releasedAt).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
    },
  ];

  const renderActions = (r: AppRelease) => (
    <div className="flex gap-1">
      {canManage && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Hapus"
          className="text-red-600 hover:bg-red-50"
          onClick={() => setDeleteConfirm(r)}
        >
          <HiOutlineTrash className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Rilis APK (Play Store)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Catat versi APK setiap kali upload ke Play Store. Notifikasi update
            akan muncul otomatis di aplikasi mobile pengguna yang masih pakai
            versi lama.
          </p>
        </div>
        {canManage && !showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            + Tambah Release
          </Button>
        )}
      </div>

      {showForm && canManage && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Platform">
              <select
                value={form.platform}
                onChange={(e) => setField("platform", e.target.value)}
                className={INPUT_CLASS}
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Version">
              <input
                type="text"
                value={form.version}
                onChange={(e) => setField("version", e.target.value)}
                placeholder="1.0.9"
                className={INPUT_CLASS}
                required
              />
            </Field>
            <Field label="Version Code">
              <input
                type="number"
                value={form.versionCode || ""}
                onChange={(e) =>
                  setField("versionCode", Number(e.target.value))
                }
                placeholder="34"
                className={INPUT_CLASS}
                required
              />
            </Field>
            <Field label="Architecture">
              <select
                value={form.architecture}
                onChange={(e) => setField("architecture", e.target.value)}
                className={INPUT_CLASS}
              >
                {ARCH_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Download URL (Play Store)">
                <input
                  type="url"
                  value={form.downloadUrl}
                  onChange={(e) => setField("downloadUrl", e.target.value)}
                  placeholder="https://play.google.com/store/apps/details?id=com.netmanager.mobile"
                  className={INPUT_CLASS}
                  required
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Release Notes">
                <textarea
                  value={form.releaseNotes}
                  onChange={(e) => setField("releaseNotes", e.target.value)}
                  placeholder="Deskripsi update, fitur baru, bug fix..."
                  rows={3}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 sm:col-span-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.isForceUpdate}
                onChange={(e) => setField("isForceUpdate", e.target.checked)}
              />
              Force Update (blokir app lama sampai update)
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setForm(INITIAL_FORM);
              }}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Release"}
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <select
          value={platformFilter}
          onChange={(e) => {
            const next = e.target.value;
            setPlatformFilter(next);
            void fetchReleases(next);
          }}
          className="px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="">Semua Platform</option>
          {PLATFORM_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
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
          data={releases}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Belum ada data release. Klik Tambah Release untuk mencatat rilis APK pertama."
          renderActions={renderActions}
        />
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Hapus App Release"
        description={
          deleteConfirm
            ? `Nonaktifkan release ${deleteConfirm.version} (versionCode ${deleteConfirm.versionCode})?`
            : ""
        }
        confirmText="Hapus"
        cancelText="Batal"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
