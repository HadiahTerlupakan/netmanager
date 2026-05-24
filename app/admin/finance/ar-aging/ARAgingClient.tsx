"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import {
  HiOutlineCurrencyDollar,
  HiOutlineUserGroup,
  HiOutlineArrowPath,
} from "react-icons/hi2";

interface ARAgingSnapshot {
  id: string;
  snapshotDate: string;
  current: string;
  overdue30: string;
  overdue60: string;
  overdue90: string;
  totalOutstanding: string;
  totalCustomers: number;
}

interface CustomerBreakdownRow {
  pelangganId: string;
  current: string;
  overdue30: string;
  overdue60: string;
  overdue90: string;
  total: string;
  invoiceCount: number;
  oldestDueDate: string;
}

interface ARAgingResponse {
  latest: ARAgingSnapshot;
  history: ARAgingSnapshot[];
  breakdown: CustomerBreakdownRow[] | null;
}

function formatRupiah(amount: string | bigint): string {
  const value = typeof amount === "string" ? BigInt(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ARAgingClient() {
  const [withBreakdown, setWithBreakdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const url = `/api/admin/finance/ar-aging?history=30${
    withBreakdown ? "&breakdown=true" : ""
  }`;

  const { data, isLoading, error, mutate } = useApi<ARAgingResponse>(url);

  const handleRecompute = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/admin/finance/ar-aging?recompute=true${
          withBreakdown ? "&breakdown=true" : ""
        }`,
      );
      if (res.ok) {
        await mutate();
      }
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
        {error.message || "Gagal memuat data AR aging"}
      </div>
    );
  }
  if (!data) return null;

  const { latest, history, breakdown } = data;
  const buckets = [
    {
      label: "Belum Jatuh Tempo",
      value: latest.current,
      color: "emerald",
    },
    {
      label: "1-30 Hari",
      value: latest.overdue30,
      color: "yellow",
    },
    {
      label: "31-60 Hari",
      value: latest.overdue60,
      color: "orange",
    },
    {
      label: "60+ Hari",
      value: latest.overdue90,
      color: "red",
    },
  ];

  const breakdownColumns: Column<CustomerBreakdownRow>[] = [
    {
      key: "pelangganId",
      header: "Pelanggan",
      priority: "primary",
      render: (row) => (
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
          {row.pelangganId}
        </span>
      ),
    },
    {
      key: "invoiceCount",
      header: "# Invoice",
      priority: "secondary",
      align: "center",
      render: (row) => row.invoiceCount,
    },
    {
      key: "oldestDueDate",
      header: "Due Tertua",
      priority: "tertiary",
      render: (row) => formatDate(row.oldestDueDate),
    },
    {
      key: "current",
      header: "Belum Jatuh",
      priority: "tertiary",
      align: "right",
      render: (row) => (
        <span className="text-xs">{formatRupiah(row.current)}</span>
      ),
    },
    {
      key: "overdue30",
      header: "1-30",
      priority: "secondary",
      align: "right",
      render: (row) => (
        <span className="text-xs text-yellow-700 dark:text-yellow-400">
          {formatRupiah(row.overdue30)}
        </span>
      ),
    },
    {
      key: "overdue60",
      header: "31-60",
      priority: "secondary",
      align: "right",
      render: (row) => (
        <span className="text-xs text-orange-700 dark:text-orange-400">
          {formatRupiah(row.overdue60)}
        </span>
      ),
    },
    {
      key: "overdue90",
      header: "60+",
      priority: "primary",
      align: "right",
      render: (row) => (
        <span className="text-xs text-red-700 dark:text-red-400 font-semibold">
          {formatRupiah(row.overdue90)}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      priority: "primary",
      align: "right",
      render: (row) => (
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {formatRupiah(row.total)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            AR Aging Report
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Snapshot terakhir: {formatDate(latest.snapshotDate)}
          </p>
        </div>
        <Button
          onClick={handleRecompute}
          disabled={refreshing}
          variant="default"
        >
          <HiOutlineArrowPath
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Computing..." : "Refresh Snapshot"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {buckets.map((bucket) => (
          <BucketCard key={bucket.label} {...bucket} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SummaryCard
          icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
          label="Total Outstanding"
          value={formatRupiah(latest.totalOutstanding)}
          accent="indigo"
        />
        <SummaryCard
          icon={<HiOutlineUserGroup className="w-6 h-6" />}
          label="Pelanggan dengan Piutang"
          value={`${latest.totalCustomers} pelanggan`}
          accent="sky"
        />
      </div>

      {history.length > 1 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Trend 30 Hari Terakhir
          </h2>
          <TrendTable history={history} />
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Breakdown Per Pelanggan
          </h2>
          {!withBreakdown ? (
            <Button variant="outline" onClick={() => setWithBreakdown(true)}>
              Muat Breakdown
            </Button>
          ) : (
            <span className="text-xs text-gray-500">
              Realtime, bukan dari snapshot
            </span>
          )}
        </div>
        {withBreakdown && breakdown ? (
          <ResponsiveTable
            data={breakdown}
            columns={breakdownColumns}
            keyField="pelangganId"
            emptyMessage="Tidak ada pelanggan dengan piutang."
          />
        ) : (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Klik &quot;Muat Breakdown&quot; untuk melihat detail per pelanggan.
          </div>
        )}
      </div>
    </div>
  );
}

interface BucketCardProps {
  label: string;
  value: string;
  color: string;
}

function BucketCard({ label, value, color }: BucketCardProps) {
  const accents: Record<string, string> = {
    emerald: "border-emerald-500 text-emerald-700 dark:text-emerald-300",
    yellow: "border-yellow-500 text-yellow-700 dark:text-yellow-300",
    orange: "border-orange-500 text-orange-700 dark:text-orange-300",
    red: "border-red-500 text-red-700 dark:text-red-300",
  };

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 ${
        accents[color] ?? "border-gray-500"
      } p-6`}
    >
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {label}
      </p>
      <p className="text-2xl font-bold mt-2">{formatRupiah(value)}</p>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}

function SummaryCard({ icon, label, value, accent }: SummaryCardProps) {
  const styles: Record<string, string> = {
    indigo:
      "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300",
    sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          styles[accent] ?? styles.indigo
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
          {value}
        </p>
      </div>
    </div>
  );
}

function TrendTable({ history }: { history: ARAgingSnapshot[] }) {
  const trendColumns: Column<ARAgingSnapshot>[] = [
    {
      key: "snapshotDate",
      header: "Tanggal",
      priority: "primary",
      render: (row) => formatDate(row.snapshotDate),
    },
    {
      key: "current",
      header: "Belum Jatuh",
      priority: "secondary",
      align: "right",
      render: (row) => (
        <span className="text-xs">{formatRupiah(row.current)}</span>
      ),
    },
    {
      key: "overdue30",
      header: "1-30",
      priority: "tertiary",
      align: "right",
      render: (row) => (
        <span className="text-xs">{formatRupiah(row.overdue30)}</span>
      ),
    },
    {
      key: "overdue60",
      header: "31-60",
      priority: "tertiary",
      align: "right",
      render: (row) => (
        <span className="text-xs">{formatRupiah(row.overdue60)}</span>
      ),
    },
    {
      key: "overdue90",
      header: "60+",
      priority: "secondary",
      align: "right",
      render: (row) => (
        <span className="text-xs text-red-700 dark:text-red-400">
          {formatRupiah(row.overdue90)}
        </span>
      ),
    },
    {
      key: "totalOutstanding",
      header: "Total",
      priority: "primary",
      align: "right",
      render: (row) => (
        <span className="text-sm font-semibold">
          {formatRupiah(row.totalOutstanding)}
        </span>
      ),
    },
  ];

  return (
    <ResponsiveTable
      data={[...history].reverse()}
      columns={trendColumns}
      keyField="id"
      emptyMessage="Belum ada history snapshot."
    />
  );
}
