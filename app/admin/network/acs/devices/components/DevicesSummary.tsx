import { Activity, AlertTriangle, Wifi, WifiOff } from "lucide-react";

import type { StatusFilter } from "@/app/admin/network/acs/devices/DevicesClient";

type DevicesSummaryProps = {
  summary: { total: number; online: number; offline: number; critical: number };
  activeFilter: StatusFilter;
  onFilterChange: (filter: StatusFilter) => void;
};

const cards = [
  {
    key: "all" as StatusFilter,
    label: "Total",
    icon: Activity,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    ring: "ring-blue-500",
  },
  {
    key: "online" as StatusFilter,
    label: "Online",
    icon: Wifi,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-900/20",
    ring: "ring-green-500",
  },
  {
    key: "offline" as StatusFilter,
    label: "Offline",
    icon: WifiOff,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-900/20",
    ring: "ring-red-500",
  },
  {
    key: "critical" as StatusFilter,
    label: "Critical RX",
    icon: AlertTriangle,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    ring: "ring-orange-500",
  },
] as const;

export function DevicesSummary({
  summary,
  activeFilter,
  onFilterChange,
}: DevicesSummaryProps) {
  const values = {
    all: summary.total,
    online: summary.online,
    offline: summary.offline,
    critical: summary.critical,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ key, label, icon: Icon, color, bg, ring }) => (
        <button
          key={key}
          type="button"
          onClick={() => onFilterChange(activeFilter === key ? "all" : key)}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
            activeFilter === key
              ? `${bg} border-transparent ring-2 ${ring}`
              : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
          }`}
        >
          <div className={`p-2 rounded-lg ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div className="text-left">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {values[key]}
            </div>
            <div className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">
              {label}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
