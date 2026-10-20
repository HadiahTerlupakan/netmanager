import type { VpnServerStatus } from "./vpnShared";

const STATUS_STYLE: Record<VpnServerStatus, { label: string; cls: string }> = {
  pending_install: {
    label: "Menunggu instal",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  online: {
    label: "Online",
    cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  offline: {
    label: "Offline",
    cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  expired: {
    label: "Kedaluwarsa",
    cls: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
};

/** Lencana status server VPN. */
export default function VpnStatusBadge({
  status,
}: {
  status: VpnServerStatus;
}) {
  const { label, cls } = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
