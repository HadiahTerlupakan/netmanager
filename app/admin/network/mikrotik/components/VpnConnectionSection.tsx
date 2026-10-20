"use client";

import { HiChevronDown, HiChevronUp } from "react-icons/hi2";
import { useApi } from "@/lib/hooks/useApi";
import {
  isVpnNotConfigured,
  VPN_NOT_CONFIGURED_MESSAGE,
} from "@/app/admin/tenants/vpn/vpnShared";
import type {
  RouterConnectionMode,
  RouterOsVersion,
  VpnServerOption,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";

const SERVERS_URL = "/api/vpn-servers";
const ONLINE_STATUS = "online";
const NO_SERVER_MESSAGE = "Belum ada server VPN untuk tenant ini";
const SWITCH_CLASS =
  "w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 peer-disabled:opacity-50";
const ORDER_BUTTON_CLASS =
  "p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30";

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

function Toggle({ id, label, isChecked, isDisabled, onChange }: ToggleProps) {
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

/** Menukar posisi `index` dengan tetangganya (`offset` -1 naik, +1 turun). */
function moveServer(ids: string[], index: number, offset: number): string[] {
  const next = [...ids];
  [next[index], next[index + offset]] = [next[index + offset], next[index]];
  return next;
}

/** Server tercentang sesuai prioritas, lalu sisanya dalam urutan API. */
function orderServers(servers: VpnServerOption[], selectedIds: string[]) {
  const selected = selectedIds
    .map((id) => servers.find((server) => server.id === id))
    .filter((server): server is VpnServerOption => Boolean(server));
  const rest = servers.filter((server) => !selectedIds.includes(server.id));
  return [...selected, ...rest];
}

type ServerListProps = {
  servers: VpnServerOption[];
  selectedIds: string[];
  onChange: (serverIds: string[]) => void;
};

function VpnServerList({ servers, selectedIds, onChange }: ServerListProps) {
  return (
    <ul className="space-y-2">
      {orderServers(servers, selectedIds).map((server) => {
        const index = selectedIds.indexOf(server.id);
        const isSelected = index >= 0;
        return (
          <li
            key={server.id}
            className="flex items-center gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <input
              id={`vpn-server-${server.id}`}
              type="checkbox"
              checked={isSelected}
              disabled={isSelected && selectedIds.length === 1}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selectedIds, server.id]
                    : selectedIds.filter((id) => id !== server.id),
                )
              }
            />
            <label
              htmlFor={`vpn-server-${server.id}`}
              className="flex-1 text-sm text-gray-800 dark:text-gray-200"
            >
              {isSelected && `${index + 1}. `}
              {server.name}
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                {server.publicHost} · {server.status}
              </span>
            </label>
            {isSelected && (
              <>
                <button
                  type="button"
                  aria-label={`Naikkan prioritas ${server.name}`}
                  disabled={index === 0}
                  onClick={() => onChange(moveServer(selectedIds, index, -1))}
                  className={ORDER_BUTTON_CLASS}
                >
                  <HiChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Turunkan prioritas ${server.name}`}
                  disabled={index === selectedIds.length - 1}
                  onClick={() => onChange(moveServer(selectedIds, index, 1))}
                  className={ORDER_BUTTON_CLASS}
                >
                  <HiChevronDown className="w-4 h-4" />
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
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
  const unavailableMessage = isVpnNotConfigured(error)
    ? VPN_NOT_CONFIGURED_MESSAGE
    : (error?.message ??
      (!isLoading && servers.length === 0 ? NO_SERVER_MESSAGE : null));

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
          isDisabled={isLoading || Boolean(unavailableMessage)}
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
