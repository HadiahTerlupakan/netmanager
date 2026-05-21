"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import ResponsiveTable, { type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";

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

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
  REGISTERED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  UNREGISTERED:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
  OFFLINE:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800",
  DISABLED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
  LOS: "bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-800",
};

export default function OltOnuListClient() {
  const [onus, setOnus] = useState<OnuItem[]>([]);
  const [loading, startTransition] = useTransition();
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

    startTransition(async () => {
      const res = await fetch(`/api/olt/onu?${params}`);
      const json = await res.json();
      if (cancelled) return;
      if (json.success) {
        setOnus(json.data.data);
        setTotalPages(json.data.pagination.totalPages);
        setTotal(json.data.pagination.total);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, statusFilter, search]);

  const columns: Column<OnuItem>[] = [
    {
      key: "serialNumber",
      header: "Serial Number",
      priority: "primary",
      render: (item) => (
        <Link
          href={`/admin/olt/onu/${item.id}`}
          className="text-indigo-600 dark:text-indigo-400 hover:underline font-mono text-xs"
        >
          {item.serialNumber}
        </Link>
      ),
    },
    {
      key: "olt",
      header: "OLT",
      priority: "secondary",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300 text-xs">
          {item.olt?.name ?? "-"}
        </span>
      ),
    },
    {
      key: "ponPort",
      header: "PON:Index",
      priority: "secondary",
      render: (item) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {item.ponPort}:{item.onuIndex}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (item) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: "vlanId",
      header: "VLAN",
      priority: "tertiary",
      render: (item) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {item.vlanId ?? "-"}
        </span>
      ),
    },
    {
      key: "pelangganId",
      header: "Pelanggan",
      priority: "tertiary",
      render: (item) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {item.pelangganId ? "Assigned" : "-"}
        </span>
      ),
    },
  ];

  if (loading && onus.length === 0) {
    return <PageLoader variant="section" message="Memuat data ONU..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Daftar ONU
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {total} ONU terdaftar di sistem
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/olt/onu/unregistered">
            <Button variant="warning" size="sm">
              Unregistered
            </Button>
          </Link>
          <Link href="/admin/olt/onu/pre-register">
            <Button variant="default" size="sm">
              Pre-Register
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Cari serial number..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={onus}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage="Tidak ada data ONU"
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
