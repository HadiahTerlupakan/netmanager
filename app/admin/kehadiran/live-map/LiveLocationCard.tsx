import {
  HiOutlineClock,
  HiOutlineExclamationTriangle,
  HiOutlineMapPin,
  HiOutlineSignal,
} from "react-icons/hi2";
import { format, formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import Image from "next/image";

import type { EmployeeLocation } from "./live-location.types";
import { trackingOffLabel } from "./tracking-off-label";

function getBatteryPercentage(batteryLevel: number): number {
  return batteryLevel <= 1
    ? Math.round(batteryLevel * 100)
    : Math.round(batteryLevel);
}

function batteryClass(percentage: number): string {
  if (percentage > 50) {
    return "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400";
  }
  if (percentage > 20) {
    return "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400";
  }
  return "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400";
}

/** Kartu satu karyawan yang sedang bekerja di tampilan Cards live map. */
export function LiveLocationCard({ loc }: { loc: EmployeeLocation }) {
  const offLabel = trackingOffLabel(loc);
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 hover:shadow-md transition border ${
        offLabel
          ? "border-red-300 dark:border-red-800"
          : "border-gray-100 dark:border-gray-700"
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        {loc.userImage ? (
          <div className="relative w-12 h-12">
            <Image
              src={loc.userImage}
              alt={loc.userName}
              fill
              className="rounded-full object-cover"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {loc.userName[0]}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 dark:text-white truncate">
            {loc.userName}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {loc.departmentName || "-"}
          </p>
        </div>
        {loc.isMoving && (
          <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
            <HiOutlineSignal className="w-3 h-3" />
            Moving
          </span>
        )}
      </div>

      {offLabel && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          <HiOutlineExclamationTriangle className="w-4 h-4 shrink-0" />
          <span>Tracking mati: {offLabel}</span>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <HiOutlineMapPin className="w-4 h-4 text-blue-500 dark:text-blue-400" />
          <span className="truncate">{loc.siteName || "Unknown"}</span>
        </div>

        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
          <HiOutlineClock className="w-4 h-4 text-green-500 dark:text-green-400" />
          <span>Check-in: {format(new Date(loc.checkInTime), "HH:mm")}</span>
        </div>

        {loc.latitude !== null && loc.longitude !== null && (
          <div className="flex items-center gap-2 text-gray-400 text-xs">
            <span>
              📍 {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
        <span>
          Update:{" "}
          {loc.recordedAt
            ? formatDistanceToNow(new Date(loc.recordedAt), {
                addSuffix: true,
                locale: id,
              })
            : "belum ada"}
        </span>
        {loc.batteryLevel !== null && (
          <span
            className={`px-2 py-1 rounded ${batteryClass(getBatteryPercentage(loc.batteryLevel))}`}
          >
            🔋 {getBatteryPercentage(loc.batteryLevel)}%
          </span>
        )}
      </div>
    </div>
  );
}
