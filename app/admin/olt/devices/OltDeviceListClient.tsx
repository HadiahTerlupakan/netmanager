"use client";

import { useState, useEffect, useReducer } from "react";
import Link from "next/link";

interface OltDevice {
  id: string;
  name: string;
  vendor: string;
  model: string;
  ipAddress: string;
  totalPonPorts: number;
  status: string;
  location: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function OltDeviceListClient() {
  const [devices, setDevices] = useState<OltDevice[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    error?: string;
  } | null>(null);
  const [refreshKey, refresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(pagination.limit),
    });
    if (search) params.set("search", search);
    if (vendorFilter) params.set("vendor", vendorFilter);
    if (statusFilter) params.set("status", statusFilter);

    fetch(`/api/olt/devices?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setDevices(json.data.data);
          setPagination(json.data.pagination);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    pagination.page,
    pagination.limit,
    search,
    vendorFilter,
    statusFilter,
    refreshKey,
  ]);

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/olt/devices/${id}/test-connection`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setTestResult({
          id,
          success: json.data.connected,
          error: json.data.error,
        });
      }
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus OLT "${name}"?`)) return;
    await fetch(`/api/olt/devices/${id}`, { method: "DELETE" });
    setLoading(true);
    refresh();
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-800",
      MAINTENANCE: "bg-yellow-100 text-yellow-800",
      OFFLINE: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Perangkat OLT</h1>
        <Link
          href="/admin/olt/devices/tambah"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Tambah OLT
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Cari nama, IP, model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">Semua Vendor</option>
          <option value="ZTE">ZTE</option>
          <option value="HSGQ">HSGQ</option>
          <option value="HIOSO">Hioso</option>
          <option value="CDATA">C-Data</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">Active</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="OFFLINE">Offline</option>
        </select>
      </div>

      {testResult && (
        <div
          className={`p-3 rounded-lg ${testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
        >
          {testResult.success
            ? "Koneksi berhasil!"
            : `Koneksi gagal: ${testResult.error}`}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Nama
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Vendor
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Model
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                IP Address
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                PON Ports
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Belum ada OLT terdaftar
                </td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/olt/devices/${device.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {device.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{device.vendor}</td>
                  <td className="px-4 py-3">{device.model}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {device.ipAddress}
                  </td>
                  <td className="px-4 py-3">{device.totalPonPorts}</td>
                  <td className="px-4 py-3">{statusBadge(device.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestConnection(device.id)}
                        disabled={testingId === device.id}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
                      >
                        {testingId === device.id ? "Testing..." : "Test"}
                      </button>
                      <button
                        onClick={() => handleDelete(device.id, device.name)}
                        className="px-2 py-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Menampilkan {devices.length} dari {pagination.total} OLT
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
