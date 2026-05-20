"use client";

import { useState, useEffect, useReducer } from "react";

interface PreRegItem {
  id: string;
  serialNumber: string;
  oltId: string | null;
  pelangganId: string | null;
  bandwidthProfile: string | null;
  vlanId: number | null;
  status: string;
  createdAt: string;
}

export default function PreRegisterClient() {
  const [items, setItems] = useState<PreRegItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [serialNumber, setSerialNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/olt/onu/pre-register")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setItems(json.data.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/olt/onu/pre-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serialNumber: serialNumber.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Gagal pre-register");
        return;
      }
      setSerialNumber("");
      setLoading(true);
      refresh();
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800",
      COMPLETED: "bg-green-100 text-green-800",
      EXPIRED: "bg-gray-100 text-gray-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pre-Register ONU</h1>

      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Serial Number ONU
          </label>
          <input
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Masukkan SN ONU yang akan dipasang..."
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !serialNumber.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Pre-Register"}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-50 text-red-800 rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Serial Number
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Tanggal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  Belum ada pre-registration
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    {item.serialNumber}
                  </td>
                  <td className="px-4 py-3">{statusBadge(item.status)}</td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(item.createdAt).toLocaleString("id-ID")}
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
