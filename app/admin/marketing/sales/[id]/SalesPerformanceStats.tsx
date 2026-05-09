"use client";

import {
  HiOutlineClipboardDocumentCheck, // Approved
  HiOutlineXCircle, // Rejected
  HiOutlineClock, // Pending
  HiOutlineChartBar, // Total
  HiOutlineTrophy, // Target
  HiOutlineCalendarDays,
  HiOutlineStar,
} from "react-icons/hi2";

interface SalesPerformanceData {
  user: {
    id: string;
    name: string | null;
  };
  period?: string;
  target: number;
  canvasing: {
    approved: number;
    rejected: number;
    pending: number;
    total: number;
    progress: number;
  };
  points?: {
    approved: number;
    approvedValue: number;
    rejected: number;
    pending: number;
    pendingValue: number;
    total: number;
    totalValue: number;
  };
  totalAllTime: number;
  totalPointsAllTime?: number;
  recentActivity: {
    id: string;
    pelangganName: string;
    status: string;
    createdAt: string;
    address: string | null;
    pointClaims?: { status: string; pointValue: number } | null;
  }[];
}

const periodLabels: Record<string, string> = {
  day: "Hari Ini",
  week: "Minggu Ini",
  month: "Bulan Ini",
  all: "Semua Waktu",
};

export default function SalesPerformanceStats({
  data,
  period = "month",
}: {
  data: SalesPerformanceData | null;
  period?: string;
}) {
  if (!data) return null;

  const { canvasing, points, target, recentActivity, totalPointsAllTime } =
    data;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <HiOutlineChartBar className="w-6 h-6 text-indigo-500" />
        Performa {periodLabels[period] || "Bulan Ini"}
      </h2>

      {/* Target Progress Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <HiOutlineTrophy className="w-5 h-5 text-amber-500" />
              Target Canvasing
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pencapaian {periodLabels[period]?.toLowerCase() || "bulan ini"}
            </p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
              {canvasing.approved}
            </span>
            <span className="text-gray-400 text-sm"> / {target}</span>
          </div>
        </div>

        <div className="w-full h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              canvasing.progress >= 100 ? "bg-emerald-500" : "bg-indigo-500"
            }`}
            style={{ width: `${Math.min(canvasing.progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs font-medium">
          <span className="text-indigo-600 dark:text-indigo-400">
            {canvasing.progress}% Tercapai
          </span>
          <span className="text-gray-500">
            {Math.max(0, target - canvasing.approved)} lagi untuk mencapai
            target
          </span>
        </div>
      </div>

      {/* Canvasing Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Disetujui"
          value={canvasing.approved}
          icon={HiOutlineClipboardDocumentCheck}
          color="emerald"
          subtext="Canvasing valid"
        />
        <StatCard
          label="Menunggu"
          value={canvasing.pending}
          icon={HiOutlineClock}
          color="amber"
          subtext="Sedang diproses"
        />
        <StatCard
          label="Ditolak"
          value={canvasing.rejected}
          icon={HiOutlineXCircle}
          color="rose"
          subtext="Tidak valid / Batal"
        />
      </div>

      {/* Points Stats */}
      {points && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <HiOutlineStar className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            Statistik Poin
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
              <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                {points.approvedValue}
              </p>
              <p className="text-xs text-yellow-600/70 dark:text-yellow-400/60 font-medium">
                Poin Disetujui
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-3xl font-bold text-gray-700 dark:text-gray-200">
                {points.pendingValue}
              </p>
              <p className="text-xs text-gray-500 font-medium">Poin Pending</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              <p className="text-3xl font-bold text-gray-700 dark:text-gray-200">
                {points.total}
              </p>
              <p className="text-xs text-gray-500 font-medium">Total Claim</p>
            </div>
            <div className="text-center p-4 bg-linear-to-br from-emerald-500 to-teal-600 rounded-xl text-white">
              <p className="text-3xl font-bold">{totalPointsAllTime || 0}</p>
              <p className="text-xs font-medium text-emerald-100">
                Total Poin (Semua)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCalendarDays className="w-5 h-5 text-gray-500" />
            Aktivitas Terakhir
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {recentActivity.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Belum ada aktivitas canvasing.
            </div>
          ) : (
            recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {activity.pelangganName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {activity.address || "Alamat tidak tersedia"}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    {activity.pointClaims && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          activity.pointClaims.status === "APPROVED"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
                        }`}
                      >
                        ⭐ {activity.pointClaims.pointValue}
                      </span>
                    )}
                    <StatusBadge status={activity.status} />
                    <p className="text-xs text-gray-400">
                      {new Date(activity.createdAt).toLocaleDateString(
                        "id-ID",
                        {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  subtext: string;
}

function StatCard({ label, value, icon: Icon, color, subtext }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    emerald:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
    amber:
      "bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
    rose: "bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        <p className="text-xs text-gray-400">{subtext}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
        Disetujui
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
        Ditolak
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
      Menunggu
    </span>
  );
}
