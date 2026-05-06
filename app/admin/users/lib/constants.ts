export const USER_LIST_CONSTANTS = {
  ITEMS_PER_PAGE: 10,
  SEARCH_DEBOUNCE_MS: 500,
  MAX_SITES_DISPLAY: 2,
} as const;

export const USER_LIST_ENDPOINTS = {
  USERS: "/api/admin/users",
  USER_DELETE: (userId: string) => `/api/admin/users/${userId}`,
  USER_FORCE_LOGOUT: (userId: string) =>
    `/api/admin/users/${userId}/force-logout`,
} as const;

export const USER_LIST_MESSAGES = {
  LOADING: "Memuat data pengguna...",
  ERROR: {
    FETCH_FAILED: "Gagal memuat data pengguna",
    DELETE_FAILED: "Gagal menghapus pengguna",
    FORCE_LOGOUT_FAILED: "Gagal force logout user",
    GENERIC: "Terjadi kesalahan",
  },
  SUCCESS: {
    DELETE: "Pengguna berhasil dihapus",
    FORCE_LOGOUT: "User berhasil di-logout paksa",
  },
  EMPTY: {
    NO_USERS: "Tidak ada pengguna ditemukan",
    NO_USERS_FILTERED: "Coba ubah filter atau kata kunci pencarian Anda",
    NO_USERS_INITIAL: "Mulai dengan menambahkan pengguna baru",
  },
} as const;
