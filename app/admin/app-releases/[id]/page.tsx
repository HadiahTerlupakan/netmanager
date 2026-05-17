"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";

interface AppRelease {
  id: string;
  platform: string;
  version: string;
  versionCode: number;
  isForceUpdate: boolean;
  isActive: boolean;
  minSupportedVersion: string | null;
  minOsVersion: string | null;
  downloadUrl: string;
  releaseNotes: string | null;
  rolloutPercentage: number;
  releasedAt: string;
}

/** Admin page untuk melihat detail dan mengedit App Release. */
export default function AppReleaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [release, setRelease] = useState<AppRelease | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    data: serverRelease,
    isLoading: loading,
    error: fetchError,
  } = useApi<AppRelease>(id ? `/api/admin/app-releases/${id}` : null);

  useEffect(() => {
    if (fetchError) {
      toast.error("Gagal memuat data release");
    }
  }, [fetchError]);

  const [didHydrate, setDidHydrate] = useState(false);
  if (serverRelease && !didHydrate) {
    setDidHydrate(true);
    setRelease(serverRelease);
  }

  const setField = <K extends keyof AppRelease>(
    key: K,
    value: AppRelease[K],
  ) => {
    if (!release) return;
    setRelease({ ...release, [key]: value });
  };

  const handleSave = async () => {
    if (!release) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/app-releases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isForceUpdate: release.isForceUpdate,
          isActive: release.isActive,
          minSupportedVersion: release.minSupportedVersion,
          minOsVersion: release.minOsVersion,
          downloadUrl: release.downloadUrl,
          releaseNotes: release.releaseNotes,
          rolloutPercentage: release.rolloutPercentage,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Release berhasil diperbarui");
        router.refresh();
      } else {
        toast.error(data.message ?? "Gagal menyimpan perubahan");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (
      !confirm(
        "Yakin nonaktifkan release ini? Aksi ini tidak dapat dibatalkan dari sini.",
      )
    )
      return;

    try {
      const res = await fetch(`/api/admin/app-releases/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Release berhasil dinonaktifkan");
        router.push("/admin/app-releases");
      } else {
        const data = await res.json();
        toast.error(data.message ?? "Gagal menonaktifkan release");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    }
  };

  if (loading) {
    return <div className="p-6 text-neutral-500">Memuat data release...</div>;
  }

  if (!release) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">Release tidak ditemukan.</p>
        <Button
          variant="outline"
          onClick={() => router.push("/admin/app-releases")}
        >
          ← Kembali ke daftar
        </Button>
      </div>
    );
  }

  const releasedAtFormatted = new Date(release.releasedAt).toLocaleDateString(
    "id-ID",
    { day: "2-digit", month: "long", year: "numeric" },
  );

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/app-releases")}
        >
          ← Kembali
        </Button>
        <h1 className="text-2xl font-bold capitalize">
          {release.platform} {release.version}{" "}
          <span className="text-neutral-400 font-normal text-lg">
            (code {release.versionCode})
          </span>
        </h1>
      </div>

      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        ID: {release.id} · Dirilis: {releasedAtFormatted}
      </p>

      <div className="space-y-4">
        {/* Toggle: Active */}
        <div className="flex items-center gap-2">
          <input
            id="isActive"
            type="checkbox"
            checked={release.isActive}
            onChange={(e) => setField("isActive", e.target.checked)}
            className="w-4 h-4 accent-indigo-600"
          />
          <label
            htmlFor="isActive"
            className="text-sm font-medium cursor-pointer"
          >
            Aktif — release ini ditampilkan ke pengguna
          </label>
        </div>

        {/* Toggle: Force Update */}
        <div className="flex items-center gap-2">
          <input
            id="isForceUpdate"
            type="checkbox"
            checked={release.isForceUpdate}
            onChange={(e) => setField("isForceUpdate", e.target.checked)}
            className="w-4 h-4 accent-indigo-600"
          />
          <label
            htmlFor="isForceUpdate"
            className="text-sm font-medium cursor-pointer"
          >
            Force Update — block app sampai user install versi ini
          </label>
        </div>

        {/* Download URL */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Download URL
          </label>
          <input
            value={release.downloadUrl}
            onChange={(e) => setField("downloadUrl", e.target.value)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            type="url"
          />
        </div>

        {/* Min Supported Version */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Min Supported Version (opsional)
          </label>
          <input
            value={release.minSupportedVersion ?? ""}
            onChange={(e) =>
              setField("minSupportedVersion", e.target.value || null)
            }
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="contoh: 1.0.0"
          />
        </div>

        {/* Min OS Version */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Min OS Version (opsional)
          </label>
          <input
            value={release.minOsVersion ?? ""}
            onChange={(e) => setField("minOsVersion", e.target.value || null)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="contoh: 8.0"
          />
        </div>

        {/* Release Notes */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Release Notes
          </label>
          <textarea
            value={release.releaseNotes ?? ""}
            onChange={(e) => setField("releaseNotes", e.target.value || null)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={4}
          />
        </div>

        {/* Rollout Percentage */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Rollout Percentage ({release.rolloutPercentage}%)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={release.rolloutPercentage}
            onChange={(e) =>
              setField("rolloutPercentage", Number(e.target.value))
            }
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-neutral-400 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t border-neutral-200 dark:border-white/10">
          <Button variant="default" onClick={handleSave} loading={saving}>
            Simpan Perubahan
          </Button>
          <Button variant="destructive" onClick={handleDeactivate}>
            Nonaktifkan
          </Button>
        </div>
      </div>
    </div>
  );
}
