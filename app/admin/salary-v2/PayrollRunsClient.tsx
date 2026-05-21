"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import {
  HiOutlineBanknotes,
  HiOutlinePlusCircle,
  HiOutlineArrowPath,
  HiOutlineCog6Tooth,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import Link from "next/link";

// ============================================================================
// Types
// ============================================================================

interface PayrollRun {
  id: string;
  periodStart: string;
  periodEnd: string;
  type: "MONTHLY" | "THR" | "BONUS" | "CORRECTION";
  status:
    | "DRAFT"
    | "CALCULATING"
    | "CALCULATED"
    | "APPROVED"
    | "PAID"
    | "CANCELLED";
  totalEntries: number;
  totalNetSalary: number;
  createdAt: string;
  createdBy?: { name: string | null } | null;
}

interface PayrollRunsResponse {
  runs: PayrollRun[];
  stats?: {
    total: number;
    draft: number;
    calculating: number;
    calculated: number;
    approved: number;
    paid: number;
    totalNetSalary: number;
  } | null;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  DRAFT:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
  CALCULATING:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  CALCULATED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  APPROVED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  CANCELLED:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800",
};

const TYPE_LABELS: Record<string, string> = {
  MONTHLY: "Bulanan",
  THR: "THR",
  BONUS: "Bonus",
  CORRECTION: "Koreksi",
};

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// ============================================================================
// Component
// ============================================================================

export default function PayrollRunsClient() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.append("status", statusFilter);
    if (typeFilter) params.append("type", typeFilter);
    return `/api/admin/salary-v2/runs?${params}`;
  }, [statusFilter, typeFilter]);

  const {
    data: response,
    isLoading: loading,
    mutate: refetch,
  } = useApi<PayrollRunsResponse>(apiUrl);

  const runs = response?.runs ?? [];
  const stats = response?.stats ?? null;

  /** Buat payroll run baru */
  const handleCreateRun = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/salary-v2/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MONTHLY" }),
      });
      const data = await res.json();
      if (data.success && data.data?.id) {
        router.push(`/admin/salary-v2/${data.data.id}`);
      } else {
        alert(data.error || "Gagal membuat payroll run");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.getDate()} ${MONTHS[startDate.getMonth()]} - ${endDate.getDate()} ${MONTHS[endDate.getMonth()]} ${endDate.getFullYear()}`;
  };

  // Table columns
  const columns: Column<PayrollRun>[] = [
    {
      key: "periodStart",
      header: "Periode",
      priority: "primary",
      minWidth: "200px",
      render: (item) => (
        <div className="py-1">
          <div className="font-semibold text-gray-900 dark:text-white">
            {formatPeriod(item.periodStart, item.periodEnd)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {TYPE_LABELS[item.type] || item.type}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipe",
      priority: "secondary",
      render: (item) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {TYPE_LABELS[item.type] || item.type}
        </span>
      ),
    },
    {
      key: "totalEntries",
      header: "Karyawan",
      priority: "secondary",
      align: "center",
      render: (item) => (
        <span className="text-sm font-medium">{item.totalEntries}</span>
      ),
    },
    {
      key: "totalNetSalary",
      header: "Total Gaji Bersih",
      priority: "primary",
      align: "right",
      minWidth: "150px",
      render: (item) => (
        <span className="font-bold text-gray-900 dark:text-white">
          {formatCurrency(item.totalNetSalary)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      align: "center",
      render: (item) => (
        <Badge
          className={`${STATUS_COLORS[item.status]} border-none shadow-none text-[10px] font-bold px-2 py-0.5 rounded-full`}
        >
          {item.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Payroll V2
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manajemen penggajian karyawan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/salary-v2/components">
            <Button variant="outline">
              <HiOutlineCog6Tooth className="w-4 h-4 mr-1" />
              Komponen
            </Button>
          </Link>
          <Link href="/admin/salary-v2/profiles">
            <Button variant="outline">
              <HiOutlineUserGroup className="w-4 h-4 mr-1" />
              Profil
            </Button>
          </Link>
          <Button onClick={handleCreateRun} disabled={creating}>
            {creating ? (
              <HiOutlineArrowPath className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <HiOutlinePlusCircle className="w-4 h-4 mr-2" />
            )}
            {creating ? "Membuat..." : "Buat Payroll Baru"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                {stats.total}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-gray-500">
                {stats.draft}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Draft
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.calculated}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Calculated
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.approved}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Approved
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.paid}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Paid
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {formatCurrency(stats.totalNetSalary)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Total Gaji
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-400">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm text-gray-900 dark:text-gray-50"
              >
                <option value="">Semua</option>
                <option value="DRAFT">Draft</option>
                <option value="CALCULATING">Calculating</option>
                <option value="CALCULATED">Calculated</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-400">
                Tipe
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm text-gray-900 dark:text-gray-50"
              >
                <option value="">Semua</option>
                <option value="MONTHLY">Bulanan</option>
                <option value="THR">THR</option>
                <option value="BONUS">Bonus</option>
                <option value="CORRECTION">Koreksi</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={() => refetch()}>
                <HiOutlineArrowPath className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Payroll Run</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={runs}
            columns={columns}
            keyField="id"
            loading={loading}
            emptyMessage={
              <div className="text-center py-12">
                <HiOutlineBanknotes className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Belum Ada Payroll Run
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Buat payroll run baru untuk memulai proses penggajian.
                </p>
                <Button onClick={handleCreateRun} className="mt-6">
                  Buat Payroll Baru &rarr;
                </Button>
              </div>
            }
            onRowClick={(item) => router.push(`/admin/salary-v2/${item.id}`)}
            className="border-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
