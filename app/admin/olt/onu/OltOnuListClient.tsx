"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface OnuItem {
  id: string;
  serialNumber: string;
  ponPort: number;
  onuIndex: number;
  status: string;
  vlanId: number | null;
  bandwidthProfile: string | null;
  pelangganId: string | null;
  olt?: { name: string; vendor: string };
}

export default function OltOnuListClient() {
  const [onus, setOnus] = useState<OnuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);

    fetch(`/api/olt/onu?${params}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setOnus(json.data.data);
          setTotalPages(json.data.pagination.totalPages);
          setTotal(json.data.pagination.total);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, statusFilter, search]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-800",
      REGISTERED: "bg-blue-100 text-blue-800",
      UNREGISTERED: "bg-gray-100 text-gray-800",
      OFFLINE: "bg-red-100 text-red-800",
      DISABLED: "bg-yellow-100 text-yellow-800",
      LOS: "bg-red-200 text-red-900",
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Daftar ONU</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/olt/onu/unregistered"
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Unregistered
          </Link>
          <Link
            href="/admin/olt/onu/pre-register"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Pre-Register
          </Link>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Cari serial number..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">Active</option>
          <option value="REGISTERED">Registered</option>
          <option value="UNREGISTERED">Unregistered</option>
          <option value="OFFLINE">Offline</option>
          <option value="DISABLED">Disabled</option>
          <option value="LOS">LOS</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Serial Number
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                OLT
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                PON:Index
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Status
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                VLAN
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                Pelanggan
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : onus.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Tidak ada data ONU
                </td>
              </tr>
            ) : (
              onus.map((onu) => (
                <tr key={onu.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/olt/onu/${onu.id}`}
                      className="text-blue-600 hover:underline font-mono text-xs"
                    >
                      {onu.serialNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{onu.olt?.name ?? "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {onu.ponPort}:{onu.onuIndex}
                  </td>
                  <td className="px-4 py-3">{statusBadge(onu.status)}</td>
                  <td className="px-4 py-3 text-xs">{onu.vlanId ?? "-"}</td>
                  <td className="px-4 py-3 text-xs">
                    {onu.pelangganId ? "Assigned" : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">{total} ONU total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
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
