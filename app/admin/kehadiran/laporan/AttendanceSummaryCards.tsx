import {
  MdAccessTime,
  MdPeople,
  MdPersonOff,
  MdTrendingUp,
} from "react-icons/md";
import type { AttendanceSummary, OvertimeSummary } from "./types";

interface AttendanceSummaryCardsProps {
  readonly attendance: AttendanceSummary;
  readonly overtime: OvertimeSummary;
  readonly formatDuration: (minutes: number) => string;
}

/** Shows the attendance and overtime KPI summary cards. */
export function AttendanceSummaryCards({
  attendance,
  overtime,
  formatDuration,
}: AttendanceSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Total Kehadiran</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {attendance.totalAttendance}
            </p>
          </div>
          <MdPeople className="text-3xl text-blue-200 dark:text-blue-900/40" />
        </div>
        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
          Rate: {attendance.attendanceRate}%
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-teal-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Avg. Jam Kerja</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {formatDuration(attendance.avgDurationMinutes || 0)}
            </p>
          </div>
          <MdAccessTime className="text-3xl text-teal-200 dark:text-teal-900/40" />
        </div>
        <div className="mt-2 text-xs text-teal-600 dark:text-teal-400 font-medium">
          per hari / karyawan
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-yellow-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Terlambat</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {attendance.lateCount}
            </p>
          </div>
          <MdAccessTime className="text-3xl text-yellow-200 dark:text-yellow-900/40" />
        </div>
        <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
          {attendance.lateRate.toFixed(1)}% dari total hadir
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-red-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Bolos (Alpha)</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {attendance.alphaCount}
            </p>
          </div>
          <MdPersonOff className="text-3xl text-red-200 dark:text-red-900/40" />
        </div>
        <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
          {attendance.alphaRate.toFixed(1)}% dari total
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-purple-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Total Lembur</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {overtime.totalRequests}{" "}
              <span className="text-sm font-normal text-gray-400">Request</span>
            </p>
          </div>
          <MdTrendingUp className="text-3xl text-purple-200 dark:text-purple-900/40" />
        </div>
        <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
          Total: {formatDuration(overtime.totalDuration)}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm">Rata-rata Lembur</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {overtime.avgDuration}{" "}
              <span className="text-sm font-normal text-gray-400">Menit</span>
            </p>
          </div>
          <MdTrendingUp className="text-3xl text-green-200 dark:text-green-900/40" />
        </div>
        <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
          per karyawan aktif
        </div>
      </div>
    </div>
  );
}
