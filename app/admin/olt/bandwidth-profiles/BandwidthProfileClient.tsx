"use client";

import { useState, useEffect, useReducer } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";

interface Profile {
  id: string;
  name: string;
  oltId: string;
  uploadRate: number;
  downloadRate: number;
  description: string | null;
}

export default function BandwidthProfileClient() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [uploadRate, setUploadRate] = useState("");
  const [downloadRate, setDownloadRate] = useState("");
  const [description, setDescription] = useState("");
  const [oltId, setOltId] = useState("");
  const [olts, setOlts] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/olt/bandwidth-profiles").then((r) => r.json()),
      fetch("/api/olt/devices?limit=100").then((r) => r.json()),
    ])
      .then(([profilesRes, oltsRes]) => {
        if (cancelled) return;
        if (profilesRes.success) setProfiles(profilesRes.data);
        if (oltsRes.success) setOlts(oltsRes.data.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleCreate = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!name || !uploadRate || !downloadRate || !oltId) return;
    setSubmitting(true);
    try {
      await fetch("/api/olt/bandwidth-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oltId,
          name,
          uploadRate: Number(uploadRate),
          downloadRate: Number(downloadRate),
          description: description || undefined,
        }),
      });
      setName("");
      setUploadRate("");
      setDownloadRate("");
      setDescription("");
      setLoading(true);
      refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus profile ini?")) return;
    await fetch(`/api/olt/bandwidth-profiles/${id}`, { method: "DELETE" });
    setLoading(true);
    refresh();
  };

  const formatRate = (kbps: number) => {
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(0)} Mbps`;
    return `${kbps} kbps`;
  };

  const columns: Column<Profile>[] = [
    {
      key: "name",
      header: "Nama",
      priority: "primary",
      render: (item) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {item.name}
        </span>
      ),
    },
    {
      key: "downloadRate",
      header: "Download",
      priority: "primary",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300 text-sm">
          {formatRate(item.downloadRate)}
        </span>
      ),
    },
    {
      key: "uploadRate",
      header: "Upload",
      priority: "primary",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300 text-sm">
          {formatRate(item.uploadRate)}
        </span>
      ),
    },
    {
      key: "description",
      header: "Deskripsi",
      priority: "secondary",
      render: (item) => (
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {item.description ?? "-"}
        </span>
      ),
    },
  ];

  if (loading && profiles.length === 0) {
    return (
      <PageLoader variant="section" message="Memuat bandwidth profiles..." />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Bandwidth Profiles
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola profil bandwidth untuk ONU di setiap OLT
          </p>
        </div>
      </div>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle>Tambah Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  OLT *
                </label>
                <select
                  value={oltId}
                  onChange={(e) => setOltId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Pilih OLT</option>
                  {olts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="10M/5M"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Download (kbps) *
                </label>
                <input
                  type="number"
                  value={downloadRate}
                  onChange={(e) => setDownloadRate(e.target.value)}
                  required
                  min={64}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="10000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Upload (kbps) *
                </label>
                <input
                  type="number"
                  value={uploadRate}
                  onChange={(e) => setUploadRate(e.target.value)}
                  required
                  min={64}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="5000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Deskripsi
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Opsional"
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="default"
              size="sm"
              loading={submitting}
            >
              Tambah Profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={profiles}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Belum ada bandwidth profile"
          renderActions={(item) => (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDelete(item.id)}
            >
              Hapus
            </Button>
          )}
        />
      </div>
    </div>
  );
}
