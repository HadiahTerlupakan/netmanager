/**
 * Constants untuk RADIUS admin module
 */

export const RADIUS_CONSTANTS = {
  RECENT_SESSIONS_LIMIT: 50,
  HISTORY_PAGE_DEFAULT: 1,
  HISTORY_LIMIT_DEFAULT: 20,
} as const;

export const RADIUS_API = {
  STATS: "/api/admin/radius/dashboard/stats",
  RECENT_SESSIONS: "/api/admin/radius/dashboard/recent-sessions",
  SESSION_HISTORY: (username: string) =>
    `/api/admin/radius/sessions/${encodeURIComponent(username)}/history`,
  RESET_CONNECTION: "/api/admin/radius/sessions/reset",
  FORCE_DELETE_USER: (username: string) =>
    `/api/admin/radius/users/${encodeURIComponent(username)}`,
} as const;

export const RADIUS_MESSAGES = {
  ERROR: {
    DASHBOARD: "Gagal memuat dashboard RADIUS",
    HISTORY: "Gagal memuat history sesi",
    RESET: "Gagal reset koneksi",
    DELETE_USER: "Gagal menghapus user dari RADIUS",
  },
} as const;
