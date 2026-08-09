"use client";

import Link from "next/link";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { toast } from "react-hot-toast";
import {
  HiOutlinePlus,
  HiOutlineMapPin,
  HiOutlineCurrencyDollar,
  HiOutlineClipboardDocumentCheck,
  HiOutlineClock,
} from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";
import { usePermission } from "@/hooks/use-permission";
import { StatCard } from "@/components/common/StatCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  PLANNING_STATUS_CONFIG,
  formatBudget,
  formatDateShort,
} from "@/modules/planning";
import type { PlanningDashboardDTO } from "@/modules/planning";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
);

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "#9ca3af",
  PENDING_APPROVAL: "#f59e0b",
  APPROVED_LEVEL1: "#3b82f6",
  APPROVED: "#22c55e",
  IN_PROGRESS: "#6366f1",
  COMPLETED: "#10b981",
  REJECTED: "#ef4444",
  CANCELLED: "#6b7280",
};

export default function PlanningDashboardClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("planning:create");

  const { data: dashboard, isLoading } = useApi<PlanningDashboardDTO>(
    "/api/planning/dashboard",
    {
      onError: () => toast.error("Gagal memuat data dashboard planning"),
    },
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <EmptyState
        icon={<HiOutlineMapPin className="w-12 h-12" />}
        title="Belum ada data planning"
        description="Buat planning OSP pertama untuk mulai melacak ekspansi jaringan."
        action={
          canCreate && (
            <Link href="/admin/planning/baru">
              <Button>
                <HiOutlinePlus className="w-4 h-4" />
                Buat Planning
              </Button>
            </Link>
          )
        }
      />
    );
  }

  const totalPlanning = dashboard.timelineStats.totalPlanning;

  const statusDoughnutData = {
    labels: dashboard.statusDistribution.map(
      (s) => PLANNING_STATUS_CONFIG[s.status].label,
    ),
    datasets: [
      {
        data: dashboard.statusDistribution.map((s) => s.count),
        backgroundColor: dashboard.statusDistribution.map(
          (s) => STATUS_COLORS[s.status] || "#9ca3af",
        ),
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.8)",
      },
    ],
  };

  const budgetBarData = {
    labels: ["Estimasi", "Aktual"],
    datasets: [
      {
        label: "Budget",
        data: [
          dashboard.budgetSummary.totalEstimatedBudget,
          dashboard.budgetSummary.totalActualBudget,
        ],
        backgroundColor: ["#6366f1", "#22c55e"],
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Planning OSP
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Dashboard perencanaan ekspansi jaringan
          </p>
        </div>
        {canCreate && (
          <Link href="/admin/planning/baru">
            <Button>
              <HiOutlinePlus className="w-4 h-4" />
              Buat Planning
            </Button>
          </Link>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Planning"
          value={totalPlanning}
          icon={<HiOutlineClipboardDocumentCheck className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          label="Sedang Berjalan"
          value={
            dashboard.statusDistribution.find((s) => s.status === "IN_PROGRESS")
              ?.count ?? 0
          }
          icon={<HiOutlineClock className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          label="Total Estimasi Budget"
          value={formatBudget(dashboard.budgetSummary.totalEstimatedBudget)}
          icon={<HiOutlineCurrencyDollar className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          label="Selesai Tepat Waktu"
          value={dashboard.timelineStats.completedOnTime}
          icon={<HiOutlineClipboardDocumentCheck className="w-6 h-6" />}
          color="orange"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Distribusi Status
          </h3>
          {totalPlanning > 0 ? (
            <div className="relative h-64">
              <Doughnut
                data={statusDoughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom",
                      labels: {
                        font: { size: 11 },
                        padding: 12,
                        color: document.documentElement.classList.contains(
                          "dark",
                        )
                          ? "#e5e7eb"
                          : "#374151",
                      },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
              Belum ada data
            </div>
          )}
        </div>

        {/* Budget comparison */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Ringkasan Budget
          </h3>
          <div className="relative h-64">
            <Bar
              data={budgetBarData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    ticks: {
                      callback: (value) => formatBudget(Number(value)),
                      color: document.documentElement.classList.contains("dark")
                        ? "#9ca3af"
                        : "#6b7280",
                    },
                    grid: {
                      color: document.documentElement.classList.contains("dark")
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(0,0,0,0.05)",
                    },
                  },
                  x: {
                    ticks: {
                      color: document.documentElement.classList.contains("dark")
                        ? "#9ca3af"
                        : "#6b7280",
                    },
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
          {dashboard.budgetSummary.variance !== 0 && (
            <p
              className={`text-xs mt-3 ${dashboard.budgetSummary.variance > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
            >
              Variance: {formatBudget(dashboard.budgetSummary.variance)} (
              {dashboard.budgetSummary.variancePercentage.toFixed(1)}%)
            </p>
          )}
        </div>
      </div>

      {/* Timeline stats + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Statistik Timeline
          </h3>
          <dl className="space-y-3">
            <StatRow
              label="Selesai tepat waktu"
              value={dashboard.timelineStats.completedOnTime}
            />
            <StatRow
              label="Selesai terlambat"
              value={dashboard.timelineStats.completedLate}
            />
            <StatRow
              label="Berjalan on-track"
              value={dashboard.timelineStats.inProgressOnTrack}
            />
            <StatRow
              label="Berjalan overdue"
              value={dashboard.timelineStats.inProgressOverdue}
            />
            <StatRow
              label="Rata-rata penyelesaian"
              value={
                dashboard.timelineStats.averageCompletionDays != null
                  ? `${dashboard.timelineStats.averageCompletionDays} hari`
                  : "-"
              }
            />
          </dl>
        </div>

        {/* Recent planning */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Planning Terbaru
            </h3>
            <Link
              href="/admin/planning/daftar"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Lihat semua →
            </Link>
          </div>
          {dashboard.recentPlanning.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              Belum ada planning
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {dashboard.recentPlanning.map((item) => {
                const config = PLANNING_STATUS_CONFIG[item.status];
                return (
                  <li key={item.id}>
                    <Link
                      href={`/admin/planning/${item.id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {formatDateShort(item.updatedAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${config.className}`}
                      >
                        {config.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900 dark:text-white">
        {value}
      </dd>
    </div>
  );
}
