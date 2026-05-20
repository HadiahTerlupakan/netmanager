"use client";

import { useState, useEffect, useReducer } from "react";

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

  const handleCreate = async (e: React.FormEvent) => {
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bandwidth Profiles</h1>

      <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium mb-3">Tambah Profile</h3>
        <div className="grid grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">OLT *</label>
            <select
              value={oltId}
              onChange={(e) => setOltId(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
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
            <label className="block text-xs text-gray-600 mb-1">Nama *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="10M/5M"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Download (kbps) *
            </label>
            <input
              type="number"
              value={downloadRate}
              onChange={(e) => setDownloadRate(e.target.value)}
              required
              min={64}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="10000"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Upload (kbps) *
            </label>
            <input
              type="number"
              value={uploadRate}
              onChange={(e) => setUploadRate(e.target.value)}
              required
              min={64}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="5000"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Deskripsi
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {submitting ? "Menyimpan..." : "Tambah"}
        </button>
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Nama
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Download
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Upload
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Deskripsi
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Belum ada profile
                </td>
              </tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{formatRate(p.downloadRate)}</td>
                  <td className="px-4 py-3">{formatRate(p.uploadRate)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.description ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
