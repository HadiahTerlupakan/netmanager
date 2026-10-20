"use client";

import { useApi } from "@/lib/hooks/useApi";
import type { FetchError } from "@/lib/utils/fetch-wrapper";
import {
  isVpnNotConfigured,
  VPN_NOT_CONFIGURED_MESSAGE,
} from "@/app/admin/tenants/vpn/vpnShared";
import { VpnServerList } from "@/app/admin/network/mikrotik/components/VpnServerList";
import type {
  RouterConnectionMode,
  RouterOsVersion,
  VpnServerOption,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";

const SERVERS_URL = "/api/vpn-servers";
const ONLINE_STATUS = "online";
const NO_SERVER_MESSAGE = "Belum ada server VPN untuk tenant ini";
const NO_ONLINE_SERVER_MESSAGE =
  "Belum ada server VPN yang online untuk tenant ini";

/** Alasan "Pakai VPN" tidak bisa dinyalakan, atau null bila bisa. */
function getVpnUnavailableMessage(
  error: FetchError | null,
  isLoading: boolean,
  servers: VpnServerOption[],
): string | null {
  if (isVpnNotConfigured(error)) return VPN_NOT_CONFIGURED_MESSAGE;
  if (error) return error.message;
  if (isLoading) return null;
  if (servers.length === 0) return NO_SERVER_MESSAGE;
  if (!servers.some((server) => server.status === ONLINE_STATUS)) {
    return NO_ONLINE_SERVER_MESSAGE;
  }
  return null;
}
const SWITCH_CLASS =
  "w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 peer-disabled:opacity-50";
type VpnConnectionSectionProps = {
  rosVersion: RouterOsVersion;
  connectionMode: RouterConnectionMode;
  selectedServerIds: string[];
  isDraftOutdated: boolean;
  onRosVersionChange: (isV7: boolean) => void;
  onConnectionModeChange: (isVpn: boolean, defaultServerIds: string[]) => void;
  onServerIdsChange: (serverIds: string[]) => void;
};

type ToggleProps = {
  id: string;
  label: string;
  isChecked: boolean;
  isDisabled?: boolean;
  onChange: (isChecked: boolean) => void;
};

/** Saklar berlabel untuk pilihan form router. */
export function Toggle({
  id,
  label,
  isChecked,
  isDisabled,
  onChange,
}: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={isChecked}
          disabled={isDisabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <div className={SWITCH_CLASS} />
      </label>
    </div>
  );
}

/** Pilihan RouterOS v7, mode VPN, dan daftar server VPN berprioritas pada form router. */
export function VpnConnectionSection({
  rosVersion,
  connectionMode,
  selectedServerIds,
  isDraftOutdated,
  onRosVersionChange,
  onConnectionModeChange,
  onServerIdsChange,
}: VpnConnectionSectionProps) {
  const isV7 = rosVersion === "V7";
  const isVpn = connectionMode === "VPN";
  const { data, error, isLoading } = useApi<{ servers: VpnServerOption[] }>(
    isV7 ? SERVERS_URL : null,
  );
  const servers = data?.servers ?? [];
  const unavailableMessage = getVpnUnavailableMessage(
    error,
    isLoading,
    servers,
  );

  const handleVpnToggle = (isChecked: boolean) => {
    const onlineIds = servers
      .filter((server) => server.status === ONLINE_STATUS)
      .map((server) => server.id);
    onConnectionModeChange(isChecked, isChecked ? onlineIds : []);
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <Toggle
        id="mikrotik-ros-v7"
        label="RouterOS v7"
        isChecked={isV7}
        onChange={onRosVersionChange}
      />
      {isV7 && (
        <Toggle
          id="mikrotik-use-vpn"
          label="Pakai VPN"
          isChecked={isVpn}
          isDisabled={!isVpn && (isLoading || Boolean(unavailableMessage))}
          onChange={handleVpnToggle}
        />
      )}
      {isV7 && unavailableMessage && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {unavailableMessage}
        </p>
      )}
      {isV7 && isVpn && (
        <VpnServerList
          servers={servers}
          selectedIds={selectedServerIds}
          onChange={onServerIdsChange}
        />
      )}
      {isVpn && isDraftOutdated && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Daftar server berubah. Buka SCRIPT GENERATOR lagi untuk membuat script
          baru.
        </p>
      )}
    </div>
  );
}
