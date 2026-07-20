"use client";

import { useState } from "react";
import Link from "next/link";
import { HiOutlineIdentification, HiOutlineUsers } from "react-icons/hi2";
import { useUserFetch } from "@/app/admin/users/lib/useUserFetch";
import UserStats from "@/app/admin/users/components/UserStats";
import UserFilters from "@/app/admin/users/components/UserFilters";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";
import { buttonVariants } from "@/components/ui/Button";
import {
  USER_LIST_CONSTANTS,
  USER_LIST_MESSAGES,
} from "@/app/admin/users/lib/constants";
import type { User } from "@/app/admin/users/lib/types";

const HR_EMPTY_MESSAGES = {
  NO_EMPLOYEES: "Tidak ada data pegawai",
  NO_EMPLOYEES_FILTERED: "Coba ubah filter atau kata kunci pencarian Anda",
  NO_EMPLOYEES_INITIAL: "Data pegawai akan muncul di sini",
};

function getHrEmployeeColumns(): Column<User>[] {
  return [
    {
      key: "name",
      header: "Pegawai",
      priority: "primary",
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="relative shrink-0 h-10 w-10 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <HiOutlineUsers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {user.name || user.email.split("@")[0]}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {user.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "departments",
      header: "Departemen",
      priority: "secondary",
      render: (user) =>
        user.departments?.name ? (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {user.departments.name}
          </span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        ),
    },
    {
      key: "sites",
      header: "Site",
      priority: "secondary",
      render: (user) => {
        if (user.userSites && user.userSites.length > 0) {
          const validSites = user.userSites.filter((us) => us.site);
          const displayed = validSites.slice(
            0,
            USER_LIST_CONSTANTS.MAX_SITES_DISPLAY,
          );
          const remaining =
            validSites.length - USER_LIST_CONSTANTS.MAX_SITES_DISPLAY;
          return (
            <div className="flex flex-wrap gap-1">
              {displayed.map((us) => (
                <span
                  key={us.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    us.isPrimary
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {us.site.code}
                </span>
              ))}
              {remaining > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                  +{remaining}
                </span>
              )}
            </div>
          );
        }
        return user.sites?.code ? (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {user.sites.code}
          </span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        );
      },
    },
    {
      key: "isAttendanceRequired",
      header: "Wajib Absen",
      priority: "secondary",
      render: (user) =>
        user.isAttendanceRequired ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            YA
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
            TIDAK
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      priority: "primary",
      render: (user) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            user.isActive
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {user.isActive ? "Aktif" : "Nonaktif"}
        </span>
      ),
    },
  ];
}

function renderHrEmployeeActions(user: User) {
  return (
    <>
      <Link
        href={`/admin/hr/employees/${user.id}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
      >
        <HiOutlineIdentification className="w-4 h-4" />
        Kelola Kepegawaian
      </Link>
      <Link
        href={`/admin/users/${user.id}?view=true`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        title="Lihat akun Pengguna"
      >
        Akun
      </Link>
    </>
  );
}

/**
 * Daftar pegawai untuk HR: penempatan & link ke detail kepegawaian.
 * Akun login dikelola di menu Pengguna. Reuse template list users.
 */
export function HrEmployeesListClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { users, totalUsers, activeUsers, inactiveUsers, loading } =
    useUserFetch({ page: currentPage, searchTerm, statusFilter });

  const totalPages = Math.ceil(totalUsers / USER_LIST_CONSTANTS.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * USER_LIST_CONSTANTS.ITEMS_PER_PAGE;

  const setSearchAndReset = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };
  const setStatusAndReset = (status: "all" | "active" | "inactive") => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  if (loading && users.length === 0) {
    return <PageLoader variant="page" message={USER_LIST_MESSAGES.LOADING} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Data Pegawai
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola penempatan, jam kerja, dan kuota cuti. Akun login ada di menu
            Pengguna.
          </p>
        </div>
        <Link
          href="/admin/users"
          className={buttonVariants({ variant: "outline" })}
        >
          <HiOutlineUsers className="w-5 h-5" />
          <span>Kelola Akun Pengguna</span>
        </Link>
      </div>

      <UserStats
        totalUsers={totalUsers}
        activeUsers={activeUsers}
        inactiveUsers={inactiveUsers}
      />

      <UserFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchAndReset}
        statusFilter={statusFilter}
        setStatusFilter={setStatusAndReset}
      />

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {users.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <HiOutlineUsers className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              {HR_EMPTY_MESSAGES.NO_EMPLOYEES}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchTerm || statusFilter !== "all"
                ? HR_EMPTY_MESSAGES.NO_EMPLOYEES_FILTERED
                : HR_EMPTY_MESSAGES.NO_EMPLOYEES_INITIAL}
            </p>
          </div>
        ) : (
          <ResponsiveTable
            data={users}
            columns={getHrEmployeeColumns()}
            keyField="id"
            renderActions={renderHrEmployeeActions}
          />
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Menampilkan {startIndex + 1} -{" "}
              {Math.min(
                startIndex + USER_LIST_CONSTANTS.ITEMS_PER_PAGE,
                totalUsers,
              )}{" "}
              dari {totalUsers} pegawai
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Hal {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
