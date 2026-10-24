import {
  serverSupportsProtocol,
  type VpnProtocol,
  type VpnServerOption,
} from "@/app/admin/network/mikrotik/mikrotikFormShared";

const OPTIONS: { value: VpnProtocol; label: string; hint: string }[] = [
  {
    value: "WIREGUARD",
    label: "WireGuard",
    hint: "paling ringan, butuh UDP keluar",
  },
  {
    value: "L2TP",
    label: "L2TP/IPsec",
    hint: "dikenal teknisi, untuk jaringan yang memblokir WireGuard",
  },
];

/** Server yang melayani protokol terpilih, urutan API dipertahankan. */
export function serversForProtocol(
  servers: VpnServerOption[],
  protocol: VpnProtocol,
): VpnServerOption[] {
  return servers.filter((server) => serverSupportsProtocol(server, protocol));
}

/** Pesan bila tak satu pun server tenant melayani protokol terpilih. */
export function noServerForProtocolMessage(protocol: VpnProtocol): string {
  const label = protocol === "L2TP" ? "L2TP" : "WireGuard";
  return `Belum ada server yang mendukung ${label} untuk tenant ini`;
}

type VpnProtocolPickerProps = {
  value: VpnProtocol;
  onChange: (protocol: VpnProtocol) => void;
  /** Awalan id radio, agar dua picker di satu halaman tidak bentrok. */
  idPrefix?: string;
  /** Protokol yang tidak bisa dipilih, mis. protokol yang sedang dipakai. */
  disabledValue?: VpnProtocol;
};

/** Pilihan protokol VPN: WireGuard atau L2TP/IPsec. */
export function VpnProtocolPicker({
  value,
  onChange,
  idPrefix = "vpn-protocol",
  disabledValue,
}: VpnProtocolPickerProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Protokol VPN
      </legend>
      {OPTIONS.map((option) => {
        const id = `${idPrefix}-${option.value.toLowerCase()}`;
        return (
          <div key={option.value} className="flex items-start gap-2">
            <input
              id={id}
              type="radio"
              name={`${idPrefix}-protocol`}
              className="mt-1"
              checked={value === option.value}
              disabled={option.value === disabledValue}
              onChange={() => onChange(option.value)}
            />
            <label
              htmlFor={id}
              className="text-sm text-gray-800 dark:text-gray-200"
            >
              {option.label}
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {option.hint}
              </span>
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
