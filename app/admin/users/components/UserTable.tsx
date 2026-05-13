import Link from "next/link";
import { HiOutlinePlus, HiOutlineUsers } from "react-icons/hi2";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import PageLoader from "@/components/ui/PageLoader";
import { USER_LIST_CONSTANTS, USER_LIST_MESSAGES } from "../lib/constants";
import { getUserColumns, renderUserActions } from "../lib/userColumns";
import type { User } from "../lib/types";
import { buttonVariants } from "@/components/ui/Button";

interface UserTableProps {
  users: User[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canForceLogout: boolean;
  currentUserId: string | null;
  onlineUsers: Set<string>;
  selectedUserIds: string[];
  toggleUserSelection: (userId: string) => void;
  setDeleteUserId: (userId: string) => void;
  setForceLogoutUserId: (userId: string) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  totalUsers: number;
  startIndex: number;
}

/**
 * User table with pagination.
 */
export function UserTable({
  users,
  loading,
  searchTerm,
  statusFilter,
  canCreate,
  canUpdate,
  canDelete,
  canForceLogout,
  currentUserId,
  onlineUsers,
  selectedUserIds,
  toggleUserSelection,
  setDeleteUserId,
  setForceLogoutUserId,
  currentPage,
  setCurrentPage,
  totalPages,
  totalUsers,
  startIndex,
}: UserTableProps) {
  const columns = getUserColumns({
    onlineUsers,
    selectedUserIds,
    toggleUserSelection,
    canUpdate,
    canDelete,
    canForceLogout,
    currentUserId,
    setDeleteUserId,
    setForceLogoutUserId,
  });

  const renderActions = (user: User) =>
    renderUserActions(user, {
      canUpdate,
      canDelete,
      canForceLogout,
      currentUserId,
      setDeleteUserId,
      setForceLogoutUserId,
    });

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <PageLoader variant="section" message={USER_LIST_MESSAGES.LOADING} />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <HiOutlineUsers className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            {USER_LIST_MESSAGES.EMPTY.NO_USERS}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {searchTerm || statusFilter !== "all"
              ? USER_LIST_MESSAGES.EMPTY.NO_USERS_FILTERED
              : USER_LIST_MESSAGES.EMPTY.NO_USERS_INITIAL}
          </p>
          {canCreate && (
            <Link
              href="/admin/users/new"
              className={buttonVariants({ variant: "default" })}
            >
              <HiOutlinePlus className="w-5 h-5" />
              <span>Tambah Pengguna</span>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <ResponsiveTable
        data={users}
        columns={columns}
        keyField="id"
        renderActions={renderActions}
      />

      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Menampilkan {startIndex + 1} -{" "}
            {Math.min(
              startIndex + USER_LIST_CONSTANTS.ITEMS_PER_PAGE,
              totalUsers,
            )}{" "}
            dari {totalUsers} pengguna
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
  );
}
