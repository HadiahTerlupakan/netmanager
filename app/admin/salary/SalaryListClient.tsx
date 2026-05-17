"use client";

import { clientLogger } from "@/lib/client-logger";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  HiOutlineBanknotes,
  HiOutlineCalculator,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlineArrowPath,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";

interface Salary {
  id: string;
  month: number;
  year: number;
  status: string;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  user: {
    id: string;
    name: string | null;
    email: string;
    employeeType: string;
    departments?: { name: string } | null;
  };
  auditedBy?: { name: string | null } | null;
  approvedBy?: { name: string | null } | null;
  createdAt: string;
}

interface PeriodStats {
  total: number;
  draft: number;
  calculated: number;
  audited: number;
  approved: number;
  paid: number;
  totalNetSalary: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700",
  CALCULATED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  AUDITED:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800",
  APPROVED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  REVISED:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800",
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

export default function SalaryListClient() {
  const { data: _session } = useSession();
  const router = useRouter();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    currentDate.getMonth() + 1,
  );
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchSalaries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
      if (statusFilter) params.append("status", statusFilter);

      const res = await fetch(`/api/admin/salary?${params}`);
      const data = await res.json();
      const responseData = data.data || data;
      setSalaries(responseData.salaries || []);
      setStats(responseData.stats || null);
    } catch (error) {
      clientLogger.error("Error fetching salaries:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, statusFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void fetchSalaries();
    }, 0);
    return () => clearTimeout(handle);
  }, [fetchSalaries]);

  const handleCalculateBulk = async () => {
    if (!confirm("Hitung gaji untuk semua karyawan aktif?")) return;

    setCalculating(true);
    try {
      const res = await fetch("/api/admin/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "calculate-bulk",
          month: selectedMonth,
          year: selectedYear,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Berhasil menghitung ${data.processed} gaji!`);
        fetchSalaries();
      } else {
        alert(data.error || "Gagal menghitung gaji");
      }
    } catch (error) {
      clientLogger.error("Error:", error);
      alert("Terjadi kesalahan");
    } finally {
      setCalculating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Short format for table to prevent overflow
  const formatCurrencyCompact = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "decimal",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<Salary>[] = [
    {
      key: "user.name",
      header: "Karyawan",
      priority: "primary",
      minWidth: "180px",
      render: (item) => (
        <div className="py-1">
          <div
            className="font-semibold text-gray-900 dark:text-white truncate max-w-[150px]"
            title={item.user.name || ""}
          >
            {item.user.name || "N/A"}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
            {item.user.email}
          </div>
        </div>
      ),
    },
    {
      key: "user.departments.name",
      header: "Dept",
      priority: "secondary",
      render: (item) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {item.user.departments?.name || "-"}
        </span>
      ),
    },
    {
      key: "basicSalary",
      header: "Pokok",
      priority: "tertiary",
      align: "right",
      render: (item) => formatCurrencyCompact(item.basicSalary),
    },
    {
      key: "totalEarnings",
      header: "Earning",
      priority: "tertiary",
      align: "right",
      className: "text-green-600 dark:text-green-400 text-xs",
      render: (item) => `+${formatCurrencyCompact(item.totalEarnings)}`,
    },
    {
      key: "totalDeductions",
      header: "Deduct",
      priority: "tertiary",
      align: "right",
      className: "text-red-500 dark:text-red-400 text-xs",
      render: (item) => `-${formatCurrencyCompact(item.totalDeductions)}`,
    },
    {
      key: "netSalary",
      header: "Gaji Bersih",
      priority: "primary",
      align: "right",
      minWidth: "120px",
      render: (item) => (
        <span className="font-bold text-gray-900 dark:text-white">
          {formatCurrency(item.netSalary)}
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

  const renderActions = (salary: Salary) => (
    <div className="flex items-center gap-1">
      <Link
        href={`/admin/salary/${salary.id}`}
        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full text-gray-500 hover:text-indigo-600 transition-all active:scale-95"
        title="Lihat Detail"
      >
        <HiOutlineEye className="w-5 h-5" />
      </Link>
      <a
        href={`/admin/salary/slip/${salary.id}`}
        target="_blank"
        className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full text-gray-500 hover:text-emerald-600 transition-all active:scale-95"
        title="Lihat Slip"
      >
        <HiOutlineDocumentText className="w-5 h-5" />
      </a>
    </div>
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Manajemen Penggajian
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Kelola data gaji karyawan
          </p>
        </div>
        <Button onClick={handleCalculateBulk} disabled={calculating}>
          {calculating ? (
            <HiOutlineArrowPath className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <HiOutlineCalculator className="w-4 h-4 mr-2" />
          )}
          {calculating ? "Menghitung..." : "Hitung Gaji Bulk"}
        </Button>
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
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.audited}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Audited
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
              <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-300">
                Bulan
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm text-gray-900 dark:text-gray-50"
              >
                {MONTHS.map((name, idx) => (
                  <option key={idx} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-400">
                Tahun
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm text-gray-900 dark:text-gray-50"
              >
                {[2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
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
                <option value="CALCULATED">Calculated</option>
                <option value="AUDITED">Audited</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Daftar Gaji - {MONTHS[selectedMonth - 1]} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={salaries}
            columns={columns}
            keyField="id"
            loading={loading}
            emptyMessage={
              <div className="text-center py-12">
                <HiOutlineBanknotes className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Pencatatan Gaji Kosong
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Belum ada data gaji untuk periode {MONTHS[selectedMonth - 1]}{" "}
                  {selectedYear}.
                </p>
                <Button onClick={handleCalculateBulk} className="mt-6">
                  Generate Sekarang &rarr;
                </Button>
              </div>
            }
            renderActions={renderActions}
            onRowClick={(item) => router.push(`/admin/salary/${item.id}`)}
            className="border-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
