"use client";

import { useApi } from "@/lib/hooks/useApi";
import {
  HiOutlineFire,
  HiOutlineExclamationCircle,
  HiOutlineExclamationTriangle,
  HiOutlineClock,
  HiOutlineCheckCircle,
} from "react-icons/hi2";

interface IncidentAnalyticsResponse {
  windowDays: number;
  totalIncidents: number;
  totalResolved: number;
  totalActive: number;
  avgResolutionMinutes: number;
  bySeverity: {
    CRITICAL: number;
    MAJOR: number;
    MINOR: number;
  };
  recentlyResolved: Array<{
    id: string;
    title: string;
    severity: "CRITICAL" | "MAJOR" | "MINOR";
    durationMinutes: number;
    resolvedAt: string;
  }>;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins === 0 ? `${hours}j` : `${hours}j ${mins}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}h` : `${days}h ${remHours}j`;
}

export function IncidentMetricsCards() {
  const { data, isLoading } = useApi<IncidentAnalyticsResponse>(
    "/api/admin/incidents/analytics?days=30",
  );

  if (isLoading || !data) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<HiOutlineExclamationCircle className="w-6 h-6" />}
          label="Total 30 Hari"
          value={`${data.totalIncidents}`}
          accent="indigo"
          subtext={`${data.totalActive} aktif, ${data.totalResolved} resolved`}
        />
        <MetricCard
          icon={<HiOutlineClock className="w-6 h-6" />}
          label="MTTR (rata-rata resolve)"
          value={
            data.totalResolved > 0
              ? formatDuration(data.avgResolutionMinutes)
              : "—"
          }
          accent="sky"
          subtext={
            data.totalResolved > 0
              ? `Dari ${data.totalResolved} insiden resolved`
              : "Belum ada yang resolved"
          }
        />
        <MetricCard
          icon={<HiOutlineFire className="w-6 h-6" />}
          label="Kritis"
          value={`${data.bySeverity.CRITICAL}`}
          accent={data.bySeverity.CRITICAL > 0 ? "red" : "emerald"}
        />
        <MetricCard
          icon={<HiOutlineExclamationTriangle className="w-6 h-6" />}
          label="Besar"
          value={`${data.bySeverity.MAJOR}`}
          accent={data.bySeverity.MAJOR > 0 ? "orange" : "emerald"}
        />
      </div>

      {data.recentlyResolved.length > 0 && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Resolved Terakhir
            </h2>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.recentlyResolved.map((inc) => (
              <li
                key={inc.id}
                className="px-6 py-3 flex items-center gap-3 text-sm"
              >
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-gray-900 dark:text-white truncate flex-1">
                  {inc.title}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {formatDuration(inc.durationMinutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  subtext?: string;
}

function MetricCard({ icon, label, value, accent, subtext }: MetricCardProps) {
  const styles: Record<string, string> = {
    indigo:
      "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300",
    sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
    red: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
    orange:
      "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300",
    emerald:
      "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center gap-3 mb-2">
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
      {subtext && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {subtext}
        </p>
      )}
    </div>
  );
}
