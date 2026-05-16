"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";

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

/** Admin page untuk melihat daftar App Release dengan filter platform. */
export default function AppReleasesPage() {
  const router = useRouter();
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [platform, setPlatform] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (platform) params.set("platform", platform);

    let cancelled = false;

    fetch(`/api/admin/app-releases?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setReleases(data.data ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [platform]);

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
    {
      key: "versionCode",
      header: "Code",
      priority: "secondary",
    },
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
    {
      key: "id",
      header: "",
      priority: "primary",
      align: "right",
      render: (r) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/admin/app-releases/${r.id}`)}
        >
          Detail
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">App Releases</h1>
        <Link href="/admin/app-releases/new">
          <Button variant="default">+ Tambah Release</Button>
        </Link>
      </div>

      <div className="mb-4">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="border border-neutral-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Semua Platform</option>
          <option value="android">Android</option>
          <option value="ios">iOS</option>
        </select>
      </div>

      <ResponsiveTable
        data={releases}
        columns={columns}
        keyField="id"
        loading={loading}
        emptyMessage="Belum ada data release."
      />
    </div>
  );
}
