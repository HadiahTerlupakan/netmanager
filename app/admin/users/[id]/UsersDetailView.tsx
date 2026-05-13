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
                <span className="font-medium">{formData.phone || "-"}</span>
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

      {/* Working Hours Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <HiOutlineUserCircle className="w-5 h-5 text-blue-500" />
          Pengaturan Jam Kerja
        </h3>

        {/* Mode Badge */}
        <div className="mb-4">
          {formData.workingHourMode === "FIXED" && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <HiOutlineBuildingOffice className="w-4 h-4 mr-2" />
              Jam Kerja Tetap (FIXED)
            </span>
          )}
          {formData.workingHourMode === "SHIFT" && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              <HiOutlineUserCircle className="w-4 h-4 mr-2" />
              Jam Kerja Shift (SHIFT)
            </span>
          )}
          {formData.workingHourMode === "FLEXIBLE" && (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
              <HiOutlineUserCircle className="w-4 h-4 mr-2" />
              Jam Kerja Fleksibel (FLEXIBLE)
            </span>
          )}
        </div>

        {/* Mode Details */}
        <div className="space-y-3 text-sm">
          {formData.workingHourMode === "FIXED" && (
            <>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">
                  Jam Masuk
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formData.startWorkTime || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">
                  Jam Pulang
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formData.endWorkTime || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500 dark:text-gray-400">
                  Hari Kerja
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatWorkDays(formData.workDays)}
                </span>
              </div>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                ℹ️ Jika tidak check-in pada hari kerja, akan ditandai sebagai{" "}
                <strong>ALPHA</strong> (Tidak Masuk).
              </div>
            </>
          )}

          {formData.workingHourMode === "SHIFT" && (
            <>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Shift</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {user?.shift
                    ? user.shift.name
                    : user?.shiftId
                      ? "Shift Terpilih"
                      : "Belum dipilih"}
                </span>
              </div>
              {user?.shift && (
                <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="text-gray-500 dark:text-gray-400">
                    Jadwal Shift
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {user.shift.startTime} - {user.shift.endTime}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500 dark:text-gray-400">
                  Hari Kerja
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatWorkDays(formData.workDays)}
                </span>
              </div>
              <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg text-xs text-purple-700 dark:text-purple-300">
                ℹ️ Jadwal mengikuti pola shift. Jika tidak check-in pada hari
                kerja, akan ditandai sebagai <strong>ALPHA</strong>.
              </div>
            </>
          )}

          {formData.workingHourMode === "FLEXIBLE" && (
            <>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">
                  Target Jam Kerja
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formData.flexibleTargetHour || 8} jam / hari
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-500 dark:text-gray-400">
                  Sifat Absensi
                </span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  Akumulasi Bulanan
                </span>
              </div>
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg text-xs text-green-700 dark:text-green-300">
                ✅ <strong>Tidak ada ALPHA</strong> - Bebas check-in kapan saja.
                Yang dihitung adalah total akumulasi jam kerja dalam 1 bulan.
              </div>
            </>
          )}
        </div>
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
        <LeaveQuotaSummary
          userId={userId}
          workingHourMode={formData.workingHourMode}
        />
      )}

      {formData.isSales && <SalesPerformanceStats userId={userId} />}
    </div>
  );
}
