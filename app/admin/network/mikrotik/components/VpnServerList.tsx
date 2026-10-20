import { HiChevronDown, HiChevronUp } from "react-icons/hi2";
import type { VpnServerOption } from "@/app/admin/network/mikrotik/mikrotikFormShared";

const ORDER_BUTTON_CLASS =
  "p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30";

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

/** Daftar server VPN: centang, urutan prioritas, dan tombol naik/turun. */
export function VpnServerList({
  servers,
  selectedIds,
  onChange,
}: ServerListProps) {
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
