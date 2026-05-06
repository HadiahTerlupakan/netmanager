"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HiOutlinePlus, HiOutlineBuildingOffice } from "react-icons/hi2";
import { usePresence } from "@/lib/realtime/hooks/usePresence";
import { usePermission } from "@/hooks/use-permission";
import { useUserList } from "./lib/useUserList";
import UserStats from "./components/UserStats";
import UserFilters from "./components/UserFilters";
import UserModals from "./components/UserModals";
import { UserTable } from "./components/UserTable";
import { ComparisonBar } from "./components/ComparisonBar";

/**
 * User list page - thin orchestrator component.
 */
export default function UserList() {
  const { onlineUserIds } = usePresence();
  const { hasPermission } = usePermission();
  const searchParams = useSearchParams();
  const tenantIdFilter = searchParams.get("tenantId");

  const onlineUsers = useMemo(
    () => new Set(onlineUserIds as string[]),
    [onlineUserIds],
  );

  const canCreate = hasPermission("users:create");
  const canUpdate = hasPermission("users:update");
  const canDelete = hasPermission("users:delete");
  const canForceLogout = hasPermission("users:update");

  const {
    users,
    totalUsers,
    activeUsers,
    inactiveUsers,
    loading,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    selectedUserIds,
    toggleUserSelection,
    clearSelection,
    deleteUserId,
    setDeleteUserId,
    deleting,
    handleDelete,
    forceLogoutUserId,
    setForceLogoutUserId,
    forcingLogout,
    handleForceLogout,
  } = useUserList(tenantIdFilter);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Pengguna
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola pengguna sistem
          </p>
        </div>
        {canCreate && (
          <Link
            href={
              tenantIdFilter
                ? `/admin/users/new?tenantId=${tenantIdFilter}`
                : "/admin/users/new"
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
          >
            <HiOutlinePlus className="w-5 h-5 text-white" />
            <span className="text-white">Tambah Pengguna</span>
          </Link>
        )}
      </div>

      {/* Tenant Filter Banner */}
      {tenantIdFilter && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HiOutlineBuildingOffice className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                Memfilter berdasarkan Tenant
              </p>
              <p className="text-xs text-indigo-700 dark:text-indigo-400">
                Menampilkan semua akun administrator untuk tenant yang dipilih.
              </p>
            </div>
          </div>
          <Link
            href="/admin/users"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline"
          >
            Hapus Filter
          </Link>
        </div>
      )}

      <UserStats
        totalUsers={totalUsers}
        activeUsers={activeUsers}
        inactiveUsers={inactiveUsers}
      />

      <UserFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />

      <UserTable
        users={users}
        loading={loading}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canForceLogout={canForceLogout}
        onlineUsers={onlineUsers}
        selectedUserIds={selectedUserIds}
        toggleUserSelection={toggleUserSelection}
        setDeleteUserId={setDeleteUserId}
        setForceLogoutUserId={setForceLogoutUserId}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        totalUsers={totalUsers}
        startIndex={startIndex}
      />

      <ComparisonBar
        selectedUserIds={selectedUserIds}
        clearSelection={clearSelection}
      />

      <UserModals
        deleteUserId={deleteUserId}
        setDeleteUserId={setDeleteUserId}
        deleting={deleting}
        handleDelete={handleDelete}
        forceLogoutUserId={forceLogoutUserId}
        setForceLogoutUserId={setForceLogoutUserId}
        forcingLogout={forcingLogout}
        handleForceLogout={handleForceLogout}
      />
    </div>
  );
}
