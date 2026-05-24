"use client";

import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { Button } from "@/components/ui/Button";
import PageLoader from "@/components/ui/PageLoader";
import {
  HiOutlineArrowTrendingUp,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
  HiOutlineArrowPath,
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineUserPlus,
  HiOutlineUserMinus,
} from "react-icons/hi2";

interface RevenueSnapshot {
  id: string;
  snapshotDate: string;
  snapshotType: string;
  totalMRR: string;
  totalARR: string;
  newMRR: string;
  expansionMRR: string;
  contractionMRR: string;
  churnMRR: string;
  reactivationMRR: string;
  activeCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  arpu: number;
}

interface RevenueResponse {
  latest: RevenueSnapshot;
  history: RevenueSnapshot[];
}

function formatRupiah(amount: string | bigint | number): string {
  const value =
    typeof amount === "string"
      ? Number(BigInt(amount))
      : typeof amount === "bigint"
        ? Number(amount)
        : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(amount: string | bigint): string {
  const value =
    typeof amount === "string" ? Number(BigInt(amount)) : Number(amount);
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
}

export function ExecutiveDashboardClient() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, error, mutate } = useApi<RevenueResponse>(
    "/api/admin/finance/revenue-snapshot?history=30",
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        "/api/admin/finance/revenue-snapshot?recompute=true",
      );
      if (res.ok) await mutate();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
        {error.message || "Gagal memuat data"}
      </div>
    );
  }
  if (!data) return null;

  const { latest, history } = data;
  const previous = history.length >= 2 ? history[history.length - 2] : null;
  const mrrDelta = previous
    ? Number(BigInt(latest.totalMRR) - BigInt(previous.totalMRR))
    : 0;
  const mrrDeltaPct =
    previous && BigInt(previous.totalMRR) > 0n
      ? (mrrDelta / Number(BigInt(previous.totalMRR))) * 100
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Executive Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Snapshot terakhir: {formatDate(latest.snapshotDate)} —{" "}
            {latest.snapshotType}
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="default">
          <HiOutlineArrowPath
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Computing..." : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
          label="MRR (Monthly Recurring)"
          value={formatRupiah(latest.totalMRR)}
          delta={mrrDelta}
          deltaPct={mrrDeltaPct}
          accent="indigo"
        />
        <MetricCard
          icon={<HiOutlineArrowTrendingUp className="w-6 h-6" />}
          label="ARR (Annual Run-Rate)"
          value={formatRupiah(latest.totalARR)}
          accent="emerald"
        />
        <MetricCard
          icon={<HiOutlineUsers className="w-6 h-6" />}
          label="Pelanggan Aktif"
          value={`${latest.activeCustomers.toLocaleString("id-ID")} pelanggan`}
          accent="sky"
        />
        <MetricCard
          icon={<HiOutlineArrowTrendingUp className="w-6 h-6" />}
          label="ARPU"
          value={formatRupiah(latest.arpu)}
          accent="purple"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          MRR Movement Bulan Berjalan
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MovementCard
            icon={<HiOutlineUserPlus className="w-5 h-5" />}
            label="NEW"
            value={latest.newMRR}
            count={latest.newCustomers}
            color="emerald"
          />
          <MovementCard
            icon={<HiOutlineArrowUpTray className="w-5 h-5" />}
            label="EXPANSION"
            value={latest.expansionMRR}
            color="sky"
          />
          <MovementCard
            icon={<HiOutlineArrowDownTray className="w-5 h-5" />}
            label="CONTRACTION"
            value={latest.contractionMRR}
            color="orange"
          />
          <MovementCard
            icon={<HiOutlineUserMinus className="w-5 h-5" />}
            label="CHURN"
            value={latest.churnMRR}
            count={latest.churnedCustomers}
            color="red"
          />
          <MovementCard
            icon={<HiOutlineArrowPath className="w-5 h-5" />}
            label="REACTIVATION"
            value={latest.reactivationMRR}
            color="purple"
          />
        </div>
      </div>

      {history.length > 1 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Trend MRR &amp; Active Customers (30 Hari)
          </h2>
          <TrendChart history={history} />
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number;
  deltaPct?: number;
  accent: string;
}

function MetricCard({
  icon,
  label,
  value,
  delta,
  deltaPct,
  accent,
}: MetricCardProps) {
  const styles: Record<string, string> = {
    indigo:
      "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300",
    emerald:
      "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
    sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
    purple:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
  };

  const showDelta =
    delta !== undefined && deltaPct !== undefined && delta !== 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            styles[accent] ?? styles.indigo
          }`}
        >
          {icon}
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {label}
        </p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {showDelta && (
        <p
          className={`text-xs mt-1 ${
            delta > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {delta > 0 ? "+" : ""}
          {formatRupiah(delta)} ({deltaPct.toFixed(1)}%) vs sebelumnya
        </p>
      )}
    </div>
  );
}

interface MovementCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  count?: number;
  color: string;
}

function MovementCard({ icon, label, value, count, color }: MovementCardProps) {
  const styles: Record<string, string> = {
    emerald:
      "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300",
    sky: "border-sky-500 bg-sky-50/50 dark:bg-sky-900/10 text-sky-700 dark:text-sky-300",
    orange:
      "border-orange-500 bg-orange-50/50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300",
    red: "border-red-500 bg-red-50/50 dark:bg-red-900/10 text-red-700 dark:text-red-300",
    purple:
      "border-purple-500 bg-purple-50/50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300",
  };

  return (
    <div className={`border-l-4 rounded p-4 ${styles[color] ?? styles.sky}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold uppercase">{label}</span>
      </div>
      <p className="text-lg font-bold">{formatRupiah(value)}</p>
      {count !== undefined && (
        <p className="text-xs opacity-75 mt-1">{count} pelanggan</p>
      )}
    </div>
  );
}

function TrendChart({ history }: { history: RevenueSnapshot[] }) {
  const maxMRR = Math.max(...history.map((r) => Number(BigInt(r.totalMRR))));
  const maxCustomers = Math.max(...history.map((r) => r.activeCustomers));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          MRR
        </h3>
        <div className="flex items-end gap-1 h-32">
          {history.map((row) => {
            const height =
              maxMRR > 0 ? (Number(BigInt(row.totalMRR)) / maxMRR) * 100 : 0;
            return (
              <div
                key={`mrr-${row.id}`}
                className="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div
                  className="w-full bg-indigo-500 dark:bg-indigo-400 rounded-t transition-all hover:bg-indigo-600"
                  style={{ height: `${height}%` }}
                  title={`${formatDate(row.snapshotDate)}: ${formatRupiah(row.totalMRR)}`}
                />
                <span className="absolute bottom-full mb-1 hidden group-hover:block text-xs bg-gray-900 text-white px-2 py-1 rounded whitespace-nowrap z-10">
                  {formatDate(row.snapshotDate)}: {formatCompact(row.totalMRR)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Active Customers
        </h3>
        <div className="flex items-end gap-1 h-24">
          {history.map((row) => {
            const height =
              maxCustomers > 0 ? (row.activeCustomers / maxCustomers) * 100 : 0;
            return (
              <div
                key={`cust-${row.id}`}
                className="flex-1 flex flex-col items-center justify-end group relative"
              >
                <div
                  className="w-full bg-sky-500 dark:bg-sky-400 rounded-t transition-all hover:bg-sky-600"
                  style={{ height: `${height}%` }}
                  title={`${formatDate(row.snapshotDate)}: ${row.activeCustomers}`}
                />
                <span className="absolute bottom-full mb-1 hidden group-hover:block text-xs bg-gray-900 text-white px-2 py-1 rounded whitespace-nowrap z-10">
                  {formatDate(row.snapshotDate)}: {row.activeCustomers}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>{formatDate(history[0].snapshotDate)}</span>
        <span>{formatDate(history[history.length - 1].snapshotDate)}</span>
      </div>
    </div>
  );
}
