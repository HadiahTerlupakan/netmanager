import { USER_LIST_ENDPOINTS, USER_LIST_MESSAGES } from "./constants";
import type { UserListResponse, UserListFilters } from "./types";

/**
 * Fetch users list with filters and pagination.
 */
export async function fetchUsers(
  filters: UserListFilters,
): Promise<UserListResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append("page", filters.page.toString());
  queryParams.append("limit", filters.limit.toString());

  if (filters.tenantId) queryParams.append("tenantId", filters.tenantId);
  if (filters.search) queryParams.append("search", filters.search);
  if (filters.status && filters.status !== "all")
    queryParams.append("status", filters.status);

  const response = await fetch(
    `${USER_LIST_ENDPOINTS.USERS}?${queryParams.toString()}`,
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || USER_LIST_MESSAGES.ERROR.FETCH_FAILED);
  }

  const data = await response.json();
  const users = data.data?.users || data.users || [];
  const meta = data.data?.meta || data.meta || {};

  return {
    users,
    meta: {
      total: meta.total || 0,
      active: meta.active || 0,
      inactive: meta.inactive || 0,
    },
  };
}

/**
 * Delete user by ID.
 */
export async function deleteUser(userId: string): Promise<void> {
  const response = await fetch(USER_LIST_ENDPOINTS.USER_DELETE(userId), {
    method: "DELETE",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || USER_LIST_MESSAGES.ERROR.DELETE_FAILED);
  }
}

/**
 * Force logout user by ID.
 */
export async function forceLogoutUser(userId: string): Promise<string> {
  const response = await fetch(USER_LIST_ENDPOINTS.USER_FORCE_LOGOUT(userId), {
    method: "POST",
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || USER_LIST_MESSAGES.ERROR.FORCE_LOGOUT_FAILED);
  }

  const data = await response.json();
  return data.message || USER_LIST_MESSAGES.SUCCESS.FORCE_LOGOUT;
}
