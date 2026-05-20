"use client";

import { useState, useEffect, useReducer } from "react";
import Link from "next/link";

interface VlanConfig {
  id: string;
  ponPort: number | null;
  vlanId: number;
  vlanName: string | null;
  purpose: string;
}

export default function VlanConfigClient({ oltId }: { oltId: string }) {
  const [configs, setConfigs] = useState<VlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [vlanId, setVlanId] = useState("");
  const [vlanName, setVlanName] = useState("");
  const [ponPort, setPonPort] = useState("");
  const [purpose, setPurpose] = useState("INTERNET");
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/olt/devices/${oltId}/vlan-config`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setConfigs(json.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [oltId, refreshKey]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vlanId) return;
    setSubmitting(true);
    try {
      await fetch(`/api/olt/devices/${oltId}/vlan-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vlanId: Number(vlanId),
          vlanName: vlanName || undefined,
          ponPort: ponPort ? Number(ponPort) : undefined,
          purpose,
        }),
      });
      setVlanId("");
      setVlanName("");
      setPonPort("");
      setLoading(true);
      refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (configId: string) => {
    if (!confirm("Hapus VLAN config ini?")) return;
    await fetch(`/api/olt/devices/${oltId}/vlan-config?configId=${configId}`, {
      method: "DELETE",
    });
    setLoading(true);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/olt/devices/${oltId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Kembali ke detail OLT
        </Link>
        <h1 className="text-2xl font-bold mt-1">VLAN Configuration</h1>
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium mb-3">Tambah VLAN</h3>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              VLAN ID *
            </label>
            <input
              type="number"
              value={vlanId}
              onChange={(e) => setVlanId(e.target.value)}
              min={1}
              max={4094}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nama</label>
            <input
              type="text"
              value={vlanName}
              onChange={(e) => setVlanName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Internet VLAN"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              PON Port (kosong = semua)
            </label>
            <input
              type="number"
              value={ponPort}
              onChange={(e) => setPonPort(e.target.value)}
              min={1}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Purpose</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="INTERNET">Internet</option>
              <option value="IPTV">IPTV</option>
              <option value="VOIP">VoIP</option>
              <option value="MANAGEMENT">Management</option>
            </select>
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
                VLAN ID
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Nama
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                PON Port
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Purpose
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
            ) : configs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Belum ada VLAN config
                </td>
              </tr>
            ) : (
              configs.map((cfg) => (
                <tr key={cfg.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{cfg.vlanId}</td>
                  <td className="px-4 py-3">{cfg.vlanName ?? "-"}</td>
                  <td className="px-4 py-3">{cfg.ponPort ?? "Semua"}</td>
                  <td className="px-4 py-3">{cfg.purpose}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(cfg.id)}
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
