import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { USER_LIST_CONSTANTS, USER_LIST_MESSAGES } from "./constants";
import { fetchUsers, deleteUser, forceLogoutUser } from "./userApi";
import type { User, UserListFilters } from "./types";

/**
 * Custom hook to manage user list state and operations.
 */
export function useUserList(tenantIdFilter?: string | null) {
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forceLogoutUserId, setForceLogoutUserId] = useState<string | null>(
    null,
  );
  const [forcingLogout, setForcingLogout] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, USER_LIST_CONSTANTS.SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when filter changes (compare prev value during render)
  const [prevFilterKey, setPrevFilterKey] = useState<string>(
    `${debouncedSearchTerm}|${statusFilter}|${tenantIdFilter ?? ""}`,
  );
  const filterKey = `${debouncedSearchTerm}|${statusFilter}|${tenantIdFilter ?? ""}`;
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);

      const filters: UserListFilters = {
        page: currentPage,
        limit: USER_LIST_CONSTANTS.ITEMS_PER_PAGE,
        search: debouncedSearchTerm || undefined,
        status: statusFilter,
        tenantId: tenantIdFilter || undefined,
      };

      const response = await fetchUsers(filters);

      setUsers(response.users);
      setTotalUsers(response.meta.total);
      setActiveUsers(response.meta.active);
      setInactiveUsers(response.meta.inactive);
    } catch (error) {
      clientLogger.error("Error fetching users:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : USER_LIST_MESSAGES.ERROR.FETCH_FAILED,
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, statusFilter, tenantIdFilter]);

  const [prevLoadKey, setPrevLoadKey] = useState<string | null>(null);
  const loadKey = `${currentPage}|${debouncedSearchTerm}|${statusFilter}|${tenantIdFilter ?? ""}`;
  if (prevLoadKey !== loadKey) {
    setPrevLoadKey(loadKey);
    void loadUsers();
  }

  // Auto-reset page jika halaman kosong padahal ada data di halaman sebelumnya
  // (contoh: user terakhir di halaman 2 dihapus -> page 2 jadi kosong)
  if (!loading && users.length === 0 && totalUsers > 0 && currentPage !== 1) {
    setCurrentPage(1);
  }

  const handleDelete = useCallback(
    async (userId: string) => {
      setDeleting(true);
      try {
        await deleteUser(userId);
        setDeleteUserId(null);
        toast.success(USER_LIST_MESSAGES.SUCCESS.DELETE);
        await loadUsers();
      } catch (error) {
        clientLogger.error("Error deleting user:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : USER_LIST_MESSAGES.ERROR.DELETE_FAILED,
        );
      } finally {
        setDeleting(false);
      }
    },
    [loadUsers],
  );

  const handleForceLogout = useCallback(async (userId: string) => {
    setForcingLogout(true);
    try {
      const message = await forceLogoutUser(userId);
      toast.success(message);
      setForceLogoutUserId(null);
    } catch (error) {
      clientLogger.error("Error force logout user:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : USER_LIST_MESSAGES.ERROR.FORCE_LOGOUT_FAILED,
      );
    } finally {
      setForcingLogout(false);
    }
  }, []);

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedUserIds([]);
  }, []);

  const totalPages = Math.ceil(totalUsers / USER_LIST_CONSTANTS.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * USER_LIST_CONSTANTS.ITEMS_PER_PAGE;

  return {
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
    loadUsers,
  };
}
