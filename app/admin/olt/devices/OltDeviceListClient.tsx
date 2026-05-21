"use client";

import { useState, useEffect, useReducer } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";
import { EmptyState } from "@/components/ui/EmptyState";
import { HiOutlineServerStack } from "react-icons/hi2";

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
      ACTIVE:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      MAINTENANCE:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      OFFLINE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}`}
      >
        {status}
      </span>
    );
  };

  const columns: Column<OltDevice>[] = [
    {
      key: "name",
      header: "Nama",
      priority: "primary",
      render: (device) => (
        <Link
          href={`/admin/olt/devices/${device.id}`}
          className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          {device.name}
        </Link>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      priority: "secondary",
    },
    {
      key: "model",
      header: "Model",
      priority: "secondary",
    },
    {
      key: "ipAddress",
      header: "IP Address",
      priority: "tertiary",
      render: (device) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {device.ipAddress}
        </span>
      ),
    },
    {
      key: "totalPonPorts",
      header: "PON Ports",
      priority: "tertiary",
    },
    {
      key: "status",
      header: "Status",
      priority: "secondary",
      render: (device) => statusBadge(device.status),
    },
  ];

  if (loading && devices.length === 0) {
    return <PageLoader variant="section" message="Memuat data OLT..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Perangkat OLT
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola perangkat OLT yang terdaftar di jaringan
          </p>
        </div>
        <Link href="/admin/olt/devices/tambah">
          <Button variant="default">+ Tambah OLT</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Cari nama, IP, model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">Semua Status</option>
          <option value="ACTIVE">Active</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="OFFLINE">Offline</option>
        </select>
      </div>

      {/* Test Result Alert */}
      {testResult && (
        <div
          className={`p-3 rounded-lg text-sm ${
            testResult.success
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
          }`}
        >
          {testResult.success
            ? "Koneksi berhasil!"
            : `Koneksi gagal: ${testResult.error}`}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={devices}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage={
            <EmptyState
              icon={<HiOutlineServerStack className="w-12 h-12" />}
              title="Belum ada OLT terdaftar"
              description="Tambahkan perangkat OLT pertama untuk mulai mengelola jaringan"
              action={
                <Link href="/admin/olt/devices/tambah">
                  <Button variant="default">+ Tambah OLT</Button>
                </Link>
              }
            />
          }
          renderActions={(device) => (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTestConnection(device.id)}
                loading={testingId === device.id}
              >
                Test
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(device.id, device.name)}
              >
                Hapus
              </Button>
            </div>
          )}
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          itemsPerPage={pagination.limit}
          onItemsPerPageChange={(limit) =>
            setPagination((p) => ({
              ...p,
              limit: limit === "all" ? p.total : limit,
              page: 1,
            }))
          }
        />
      </div>
    </div>
  );
}
