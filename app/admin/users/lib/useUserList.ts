"use client";

import { useState } from "react";
import { useUserFetch } from "./useUserFetch";
import { useUserSelection } from "./useUserSelection";
import { useUserMutations } from "./useUserMutations";
import { USER_LIST_CONSTANTS } from "./constants";
import type { User } from "./types";

export function useUserList(tenantIdFilter?: string | null) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [prevTenantId, setPrevTenantId] = useState(tenantIdFilter);

  if (prevTenantId !== tenantIdFilter) {
    setPrevTenantId(tenantIdFilter);
    setCurrentPage(1);
  }

  const setSearchTermAndReset = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const setStatusFilterAndReset = (status: "all" | "active" | "inactive") => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const { users, totalUsers, activeUsers, inactiveUsers, loading, mutate } =
    useUserFetch({
      page: currentPage,
      searchTerm,
      statusFilter,
      tenantIdFilter,
    });

  const { selectedUserIds, toggleUserSelection, clearSelection } =
    useUserSelection();

  const mutations = useUserMutations({ onSuccess: mutate });

  if (!loading && users.length === 0 && totalUsers > 0 && currentPage !== 1) {
    setCurrentPage(1);
  }

  const totalPages = Math.ceil(totalUsers / USER_LIST_CONSTANTS.ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * USER_LIST_CONSTANTS.ITEMS_PER_PAGE;

  return {
    users: users as User[],
    totalUsers,
    activeUsers,
    inactiveUsers,
    loading,
    searchTerm,
    setSearchTerm: setSearchTermAndReset,
    statusFilter,
    setStatusFilter: setStatusFilterAndReset,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    selectedUserIds,
    toggleUserSelection,
    clearSelection,
    deleteUserId: mutations.deleteUserId,
    setDeleteUserId: mutations.setDeleteUserId,
    deleting: mutations.deleting,
    handleDelete: mutations.handleDelete,
    forceLogoutUserId: mutations.forceLogoutUserId,
    setForceLogoutUserId: mutations.setForceLogoutUserId,
    forcingLogout: mutations.forcingLogout,
    handleForceLogout: mutations.handleForceLogout,
    loadUsers: mutate,
  };
}
