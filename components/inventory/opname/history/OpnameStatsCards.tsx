"use client";

import {
  FiAlertTriangle,
  FiEdit2,
  FiEye,
  FiFilter,
  FiMinusCircle,
  FiTrash2,
} from "react-icons/fi";
import type { IconType } from "react-icons";

import type { OpnameHistoryStats } from "./useOpnameHistory";

type StatCardProps = {
  label: string;
  value: string | number;
  icon: IconType;
  iconBg: string;
  iconColor: string;
  valueColor: string;
};

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {label}
          </p>
          <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-full ${iconBg}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

type OpnameStatsCardsProps = {
  stats: OpnameHistoryStats;
};

export function OpnameStatsCards({ stats }: OpnameStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard
        label="Total Items"
        value={stats.totalRecords}
        icon={FiFilter}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        valueColor="text-gray-900 dark:text-white"
      />
      <StatCard
        label="Akurasi Stok"
        value={`${stats.akurasiPercent}%`}
        icon={FiEye}
        iconBg="bg-green-100"
        iconColor="text-green-600"
        valueColor="text-green-600"
      />
      <StatCard
        label="Kondisi Baik"
        value={stats.totalKondisiBaik}
        icon={FiEdit2}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        valueColor="text-blue-600"
      />
      <StatCard
        label="Barang Rusak"
        value={stats.totalKondisiRusak}
        icon={FiAlertTriangle}
        iconBg="bg-orange-100"
        iconColor="text-orange-600"
        valueColor="text-orange-600"
      />
      <StatCard
        label="Barang Hilang"
        value={stats.totalHilang}
        icon={FiMinusCircle}
        iconBg="bg-purple-100"
        iconColor="text-purple-600"
        valueColor="text-purple-600"
      />
      <StatCard
        label="Butuh Perhatian"
        value={stats.totalPerluPerhatian}
        icon={FiTrash2}
        iconBg="bg-red-100"
        iconColor="text-red-600"
        valueColor="text-red-600"
      />
    </div>
  );
}
