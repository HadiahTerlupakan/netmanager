const SUCCESS_CLASS =
  "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
const REJECTED_CLASS =
  "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
const NEUTRAL_CLASS =
  "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";

const BADGES: Record<string, { label: string; className: string }> = {
  LOGIN: { label: "Login", className: SUCCESS_CLASS },
  LOGIN_REJECTED_OUTDATED_APP: {
    label: "Ditolak: versi aplikasi lama",
    className: REJECTED_CLASS,
  },
};

/** Label dan warna aksi di Log Login. */
export function loginActionBadge(action: string) {
  return BADGES[action] ?? { label: action, className: NEUTRAL_CLASS };
}
