"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/hooks/useApi";
import {
  HiOutlineArrowLeft,
  HiOutlineCalculator,
  HiOutlineCheckCircle,
  HiOutlineBanknotes,
  HiOutlineArrowPath,
  HiOutlineXCircle,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import Link from "next/link";

// ============================================================================
// Types
// ============================================================================

interface PayrollEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  taxAmount: number;
  netSalary: number;
  status: string;
}

interface PayrollRunDetail {
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
  totalGrossSalary: number;
  totalDeductions: number;
  totalTax: number;
  notes: string | null;
  createdAt: string;
  calculatedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  entries: PayrollEntry[];
}

interface RunDetailResponse {
  run: PayrollRunDetail;
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

interface RunDetailClientProps {
  runId: string;
}

export default function RunDetailClient({ runId }: RunDetailClientProps) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const {
    data: response,
    isLoading: loading,
    mutate: refetch,
  } = useApi<RunDetailResponse>(`/api/admin/salary-v2/runs/${runId}`);

  const run = response?.run;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatCurrencyCompact = (amount: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "decimal",
      minimumFractionDigits: 0,
    }).format(amount);

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.getDate()} ${MONTHS[startDate.getMonth()]} - ${endDate.getDate()} ${MONTHS[endDate.getMonth()]} ${endDate.getFullYear()}`;
  };

  /** Execute action on payroll run */
  const handleAction = async (action: string) => {
    const confirmMessages: Record<string, string> = {
      calculate: "Hitung gaji untuk semua karyawan dalam run ini?",
      approve: "Setujui payroll run ini?",
      markPaid: "Tandai payroll run ini sebagai sudah dibayar?",
      cancel: "Batalkan payroll run ini?",
    };

    if (!confirm(confirmMessages[action] || "Lanjutkan?")) return;

    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/salary-v2/runs/${runId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        refetch();
      } else {
        alert(data.error || "Gagal menjalankan aksi");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setActionLoading(null);
    }
  };

  /** Render action buttons based on current status */
  const renderActionButtons = () => {
    if (!run) return null;

    const buttons: React.ReactNode[] = [];

    if (run.status === "DRAFT" || run.status === "CALCULATED") {
      buttons.push(
        <Button
          key="calculate"
          onClick={() => handleAction("calculate")}
          disabled={actionLoading !== null}
        >
          {actionLoading === "calculate" ? (
            <HiOutlineArrowPath className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <HiOutlineCalculator className="w-4 h-4 mr-2" />
          )}
          {actionLoading === "calculate" ? "Menghitung..." : "Hitung Gaji"}
        </Button>,
      );
    }

    if (run.status === "CALCULATED") {
      buttons.push(
        <Button
          key="approve"
          variant="success"
          onClick={() => handleAction("approve")}
          disabled={actionLoading !== null}
        >
          {actionLoading === "approve" ? (
            <HiOutlineArrowPath className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <HiOutlineCheckCircle className="w-4 h-4 mr-2" />
          )}
          {actionLoading === "approve" ? "Menyetujui..." : "Approve"}
        </Button>,
      );
    }

    if (run.status === "APPROVED") {
      buttons.push(
        <Button
          key="markPaid"
          variant="success"
          onClick={() => handleAction("markPaid")}
          disabled={actionLoading !== null}
        >
          {actionLoading === "markPaid" ? (
            <HiOutlineArrowPath className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <HiOutlineBanknotes className="w-4 h-4 mr-2" />
          )}
          {actionLoading === "markPaid" ? "Memproses..." : "Tandai Dibayar"}
        </Button>,
      );
    }

    if (run.status !== "PAID" && run.status !== "CANCELLED") {
      buttons.push(
        <Button
          key="cancel"
          variant="destructive"
          onClick={() => handleAction("cancel")}
          disabled={actionLoading !== null}
        >
          <HiOutlineXCircle className="w-4 h-4 mr-2" />
          Batalkan
        </Button>,
      );
    }

    return buttons;
  };

  // Entry table columns
  const columns: Column<PayrollEntry>[] = [
    {
      key: "employeeName",
      header: "Karyawan",
      priority: "primary",
      minWidth: "180px",
      render: (item) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          {item.employeeName}
        </span>
      ),
    },
    {
      key: "basicSalary",
      header: "Gaji Pokok",
      priority: "secondary",
      align: "right",
      render: (item) => formatCurrencyCompact(item.basicSalary),
    },
    {
      key: "totalEarnings",
      header: "Tunjangan",
      priority: "tertiary",
      align: "right",
      className: "text-green-600 dark:text-green-400 text-xs",
      render: (item) => `+${formatCurrencyCompact(item.totalEarnings)}`,
    },
    {
      key: "totalDeductions",
      header: "Potongan",
      priority: "tertiary",
      align: "right",
      className: "text-red-500 dark:text-red-400 text-xs",
      render: (item) => `-${formatCurrencyCompact(item.totalDeductions)}`,
    },
    {
      key: "taxAmount",
      header: "Pajak",
      priority: "tertiary",
      align: "right",
      className: "text-orange-500 dark:text-orange-400 text-xs",
      render: (item) => `-${formatCurrencyCompact(item.taxAmount)}`,
    },
    {
      key: "netSalary",
      header: "Gaji Bersih",
      priority: "primary",
      align: "right",
      minWidth: "130px",
      render: (item) => (
        <span className="font-bold text-gray-900 dark:text-white">
          {formatCurrency(item.netSalary)}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <p className="text-gray-500">Payroll run tidak ditemukan.</p>
        <Link href="/admin/salary-v2">
          <Button variant="outline" className="mt-4">
            <HiOutlineArrowLeft className="w-4 h-4 mr-2" />
            Kembali
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/salary-v2">
            <Button variant="ghost" className="p-2">
              <HiOutlineArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                {formatPeriod(run.periodStart, run.periodEnd)}
              </h1>
              <Badge
                className={`${STATUS_COLORS[run.status]} border-none shadow-none text-xs font-bold px-3 py-1 rounded-full`}
              >
                {run.status}
              </Badge>
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {TYPE_LABELS[run.type]} &middot; {run.totalEntries} karyawan
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {renderActionButtons()}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-50">
              {formatCurrency(run.totalGrossSalary)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Bruto
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {formatCurrency(run.totalDeductions)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Potongan
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(run.totalTax)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Pajak
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {formatCurrency(run.totalNetSalary)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Netto
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Gaji Karyawan</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveTable
            data={run.entries}
            columns={columns}
            keyField="id"
            loading={false}
            emptyMessage={
              <div className="text-center py-12">
                <HiOutlineBanknotes className="w-16 h-16 mx-auto mb-4 text-gray-200 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Belum Ada Entry
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Jalankan perhitungan gaji untuk mengisi data.
                </p>
              </div>
            }
            className="border-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
