const LABELS = { WIREGUARD: "WireGuard", L2TP: "L2TP" } as const;

/** Label protokol tunnel router VPN; tidak tampil untuk router publik (null). */
export function VpnProtocolBadge({
  protocol,
}: {
  protocol: keyof typeof LABELS | null;
}) {
  if (!protocol) return null;
  const label = LABELS[protocol];
  return (
    <span
      title={`Protokol VPN: ${label}`}
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
    >
      {label}
    </span>
  );
}
