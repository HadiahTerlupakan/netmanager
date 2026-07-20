"use client";

import Link from "next/link";
import {
  HiOutlineArrowLeft,
  HiOutlineBuildingOffice,
  HiOutlineEnvelope,
  HiOutlineGlobeAlt,
  HiOutlineIdentification,
  HiOutlineKey,
  HiOutlineMap,
  HiOutlinePhone,
  HiOutlineShieldCheck,
  HiOutlineStar,
  HiOutlineUserCircle,
} from "react-icons/hi2";
import type { UserDetailDTO } from "@/modules/users";
import UserPerformanceStats from "./UserPerformanceStats";
import LeaveQuotaSummary from "./LeaveQuotaSummary";
import SalesPerformanceStats from "./SalesPerformanceStats";
import { formatPhoneDisplay } from "@/lib/utils/phone";

const DAY_LABELS: Record<string, string> = {
  Mon: "Sen",
  Tue: "Sel",
  Wed: "Rab",
  Thu: "Kam",
  Fri: "Jum",
  Sat: "Sab",
  Sun: "Min",
};

function formatWorkDays(workDays: string | null | undefined): string {
  if (!workDays) return "-";
  return workDays
    .split(",")
    .map((day) => DAY_LABELS[day.trim()] || day.trim())
    .join(", ");
}

interface ViewFormData {
  name: string;
  phone: string;
  isActive: boolean;
  isSales: boolean;
  departmentId: string;
  workingHourMode: string;
  startWorkTime: string;
  endWorkTime: string;
  workDays: string;
  flexibleTargetHour: number;
}

interface Department {
  id: string;
  name: string;
}

interface UsersDetailViewProps {
  userId: string;
  user: UserDetailDTO | null;
  formData: ViewFormData;
  departments: Department[];
  canUpdate: boolean;
  canViewLeaveQuotas: boolean;
  hasPermission: (permission: string) => boolean;
}

export function UsersDetailView({
  userId,
  user,
  formData,
  departments,
  canUpdate,
  canViewLeaveQuotas,
  hasPermission,
}: UsersDetailViewProps) {
  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/users"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            title="Kembali"
          >
            <HiOutlineArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Profile Pengguna
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Detail informasi pengguna
            </p>
          </div>
        </div>
        {canUpdate && (
          <Link
            href={`/admin/users/${userId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
          >
            <HiOutlineKey className="w-4 h-4" />
            Edit Data
          </Link>
        )}
      </div>

      {/* Profile Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-bl-full -mr-16 -mt-16 pointer-events-none" />

        <div className="relative flex flex-col md:flex-row gap-8 items-start">
          {/* Avatar */}
          <div className="shrink-0">
            <div className="w-32 h-32 rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <span className="text-4xl font-bold text-white">
                {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
              </span>
            </div>
          </div>

          {/* Main Info */}
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                {formData.name || "Nama Belum Diisi"}
              </h1>
              <div className="flex flex-wrap gap-3 mt-3">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                    formData.isActive
                      ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300"
                  }`}
                >
                  <HiOutlineShieldCheck className="w-4 h-4 mr-1.5" />
                  {formData.isActive ? "Aktif" : "Tidak Aktif"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mr-3">
                  <HiOutlineEnvelope className="w-4 h-4 text-gray-500" />
                </div>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex items-center text-gray-600 dark:text-gray-300">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mr-3">
                  <HiOutlinePhone className="w-4 h-4 text-gray-500" />
                </div>
                <span className="font-medium">
                  {formatPhoneDisplay(formData.phone)}
                </span>
              </div>
              <div className="flex items-center text-gray-600 dark:text-gray-300 sm:col-span-2">
                <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center mr-3">
                  <HiOutlineIdentification className="w-4 h-4 text-gray-500" />
                </div>
                <span className="font-medium">
                  {user?.role?.name || "User (Default)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Department Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <HiOutlineBuildingOffice className="w-5 h-5 text-indigo-500" />
            Departemen
          </h3>
          <p className="text-xl font-medium text-gray-900 dark:text-white">
            {departments.find((d) => d.id === formData.departmentId)?.name ||
              user?.department?.name ||
              "-"}
          </p>
          {canUpdate && (
            <Link
              href={`/admin/hr/employees/${userId}`}
              className="inline-block mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Kelola di HR
            </Link>
          )}
        </div>

        {/* Site Card - Multi-site */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <HiOutlineMap className="w-5 h-5 text-green-500" />
            Site / Area Kerja
          </h3>
          {user?.userSites && user.userSites.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {user.userSites
                .filter((us) => us.site)
                .map((us) => (
                  <span
                    key={us.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${
                      us.isPrimary
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {us.isPrimary && <HiOutlineStar className="w-3.5 h-3.5" />}
                    {us.site?.code} - {us.site?.name}
                  </span>
                ))}
            </div>
          ) : (
            <p className="text-xl font-medium text-gray-900 dark:text-white">
              {user?.site?.code ? `${user.site.code} - ${user.site.name}` : "-"}
            </p>
          )}
          {canUpdate && (
            <Link
              href={`/admin/hr/employees/${userId}`}
              className="inline-block mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Kelola di HR
            </Link>
          )}
        </div>

        {/* Tenant Card (Super Admin only) */}
        {hasPermission("tenants:read") && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <HiOutlineGlobeAlt className="w-5 h-5 text-amber-500" />
              Tenant
            </h3>
            <p className="text-xl font-medium text-gray-900 dark:text-white">
              {user?.tenant?.name || "-"}
            </p>
          </div>
        )}
      </div>

      {/* Working Hours — short summary + HR link */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <HiOutlineUserCircle className="w-5 h-5 text-blue-500" />
            Jam Kerja
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Mode:{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {formData.workingHourMode || "FIXED"}
            </span>
            {formData.workingHourMode === "FIXED" && formData.startWorkTime && (
              <>
                {" "}
                · {formData.startWorkTime} – {formData.endWorkTime || "-"} ·{" "}
                {formatWorkDays(formData.workDays)}
              </>
            )}
            {formData.workingHourMode === "FLEXIBLE" && (
              <> · Target {formData.flexibleTargetHour || 8} jam/hari</>
            )}
            {formData.workingHourMode === "SHIFT" && user?.shift && (
              <>
                {" "}
                · {user.shift.name} ({user.shift.startTime} –{" "}
                {user.shift.endTime})
              </>
            )}
          </p>
        </div>
        <Link
          href={`/admin/hr/employees/${userId}`}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shrink-0"
        >
          Kelola di HR
        </Link>
      </div>

      {/* Status Indicators */}
      <div className="flex flex-wrap gap-4">
        <div
          className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
            formData.isActive
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
          }`}
        >
          <HiOutlineShieldCheck className="w-4 h-4" />
          {formData.isActive ? "Akun Aktif" : "Akun Nonaktif"}
        </div>
        {formData.isSales && (
          <div className="px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
            <HiOutlineIdentification className="w-4 h-4" />
            Fitur Sales Aktif
          </div>
        )}
      </div>

      <UserPerformanceStats userId={userId} />

      {canViewLeaveQuotas && (
        <div className="space-y-3">
          <LeaveQuotaSummary
            userId={userId}
            workingHourMode={formData.workingHourMode}
          />
          <div className="flex justify-end">
            <Link
              href={`/admin/hr/employees/${userId}`}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Kelola di HR
            </Link>
          </div>
        </div>
      )}

      {formData.isSales && <SalesPerformanceStats userId={userId} />}
    </div>
  );
}
