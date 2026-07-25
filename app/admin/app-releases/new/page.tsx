"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";

interface NewReleaseForm {
  platform: string;
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseNotes: string;
  isForceUpdate: boolean;
  minSupportedVersion: string;
  architecture: string;
  minOsVersion: string;
  rolloutPercentage: number;
  apkSizeBytes: number;
}

const INITIAL_FORM: NewReleaseForm = {
  platform: "android",
  version: "",
  versionCode: 0,
  downloadUrl: "",
  releaseNotes: "",
  isForceUpdate: false,
  minSupportedVersion: "",
  architecture: "",
  minOsVersion: "",
  rolloutPercentage: 100,
  apkSizeBytes: 0,
};

/** Admin page untuk membuat App Release baru. */
export default function NewAppReleasePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewReleaseForm>(INITIAL_FORM);

  const setField = <K extends keyof NewReleaseForm>(
    key: K,
    value: NewReleaseForm[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      ...form,
      minSupportedVersion: form.minSupportedVersion || null,
      architecture: form.architecture || null,
      minOsVersion: form.minOsVersion || null,
      apkSizeBytes: form.apkSizeBytes || null,
      releaseNotes: form.releaseNotes || null,
    };

    try {
      const res = await fetch("/api/admin/app-releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Release berhasil dibuat");
        router.push("/admin/app-releases");
      } else {
        toast.error(data.message ?? "Gagal menyimpan release");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/app-releases")}
        >
          ← Kembali
        </Button>
        <h1 className="text-2xl font-bold">Tambah Release Baru</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Platform">
          <select
            value={form.platform}
            onChange={(e) => setField("platform", e.target.value)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="android">Android</option>
            <option value="ios">iOS</option>
          </select>
        </Field>

        <Field label="Version (semver, contoh: 1.0.8)">
          <input
            value={form.version}
            onChange={(e) => setField("version", e.target.value)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="1.0.0"
            required
          />
        </Field>

        <Field label="Version Code (integer, contoh: 10)">
          <input
            type="number"
            value={form.versionCode}
            onChange={(e) => setField("versionCode", Number(e.target.value))}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            min={1}
            required
          />
        </Field>

        <Field label="Download URL">
          <input
            value={form.downloadUrl}
            onChange={(e) => setField("downloadUrl", e.target.value)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://..."
            type="url"
            required
          />
        </Field>

        <Field label="Release Notes">
          <textarea
            value={form.releaseNotes}
            onChange={(e) => setField("releaseNotes", e.target.value)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={4}
            placeholder="Deskripsi perubahan di versi ini..."
          />
        </Field>

        <Field label="Min Supported Version (opsional)">
          <input
            value={form.minSupportedVersion}
            onChange={(e) => setField("minSupportedVersion", e.target.value)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="contoh: 1.0.0"
          />
        </Field>

        <Field label="Min OS Version (opsional)">
          <input
            value={form.minOsVersion}
            onChange={(e) => setField("minOsVersion", e.target.value)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="contoh: 8.0"
          />
        </Field>

        <Field label="Architecture (opsional)">
          <select
            value={form.architecture}
            onChange={(e) => setField("architecture", e.target.value)}
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">— Universal —</option>
            <option value="arm64-v8a">arm64-v8a</option>
            <option value="armeabi-v7a">armeabi-v7a</option>
            <option value="x86_64">x86_64</option>
            <option value="universal">universal</option>
          </select>
        </Field>

        <Field label="APK Size (bytes, opsional)">
          <input
            type="number"
            value={form.apkSizeBytes || ""}
            onChange={(e) =>
              setField(
                "apkSizeBytes",
                e.target.value ? Number(e.target.value) : 0,
              )
            }
            className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 w-full bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            min={0}
            placeholder="opsional"
          />
        </Field>

        <Field label={`Rollout Percentage (${form.rolloutPercentage}%)`}>
          <input
            type="range"
            min={0}
            max={100}
            value={form.rolloutPercentage}
            onChange={(e) =>
              setField("rolloutPercentage", Number(e.target.value))
            }
            className="w-full accent-indigo-600"
          />
        </Field>

        <div className="pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isForceUpdate}
              onChange={(e) => setField("isForceUpdate", e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-sm font-medium">
              Force Update — block app sampai user install versi ini
            </span>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="default" loading={submitting}>
            Simpan Release
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/app-releases")}
          >
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Helper komponen label + field wrapper. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          {label}
        </label>
      )}
      {children}
    </div>
  );
}
