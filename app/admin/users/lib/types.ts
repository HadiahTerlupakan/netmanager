import type { UserListItemDTO } from "@/modules/users";

/**
 * Tipe user di halaman list admin.
 *
 * Re-export dari modules/users supaya kontrak antara backend DTO dan UI tetap
 * sinkron. Tambahan `site` dan `lastVersionUpdate`-backward-compat disimpan
 * sebagai optional field karena masih dipakai di beberapa render lama.
 */
export type User = UserListItemDTO;

export interface UserListResponse {
  users: User[];
  meta: {
    total: number;
    active: number;
    inactive: number;
  };
}

export interface UserListFilters {
  search?: string;
  status?: "all" | "active" | "inactive";
  tenantId?: string;
  page: number;
  limit: number;
}
