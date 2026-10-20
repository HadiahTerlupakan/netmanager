import type { RouterOSAPI } from "node-routeros-v2";
import type { VpnRouterRecord } from "../domain/ports/IMikroTikRouterVpnRepository";
import { runProvisioningConnection } from "./mikrotik-provisioning.connection";

/** Nama skrip yang dipasang skrip tempel core untuk berpindah server. */
export const VPN_SWITCH_SCRIPT_NAME = "netmanager-vpn-switch";
/** Interface WireGuard yang dipasang skrip tempel core. */
export const VPN_INTERFACE_NAME = "netmanager-vpn";

/** Endpoint WireGuard sebuah server VPN. */
export interface VpnPeerEndpoint {
  host: string;
  port: number;
  publicKey: string;
}

type RouterOSRow = Record<string, string>;

function firstRowId(rows: unknown, missingMessage: string): string {
  const row = Array.isArray(rows)
    ? (rows[0] as RouterOSRow | undefined)
    : undefined;
  if (!row?.[".id"]) throw new Error(missingMessage);
  return row[".id"];
}

/**
 * Mengganti isi skrip switch di router. Kata API RouterOS diberi awalan
 * panjang dan aman biner, jadi sumber skrip dikirim apa adanya tanpa escape.
 */
export async function setSwitchScript(
  conn: RouterOSAPI,
  source: string,
): Promise<void> {
  const rows = await conn.write("/system/script/print", [
    `?name=${VPN_SWITCH_SCRIPT_NAME}`,
  ]);
  const id = firstRowId(
    rows,
    `Skrip ${VPN_SWITCH_SCRIPT_NAME} tidak ada di router`,
  );
  await conn.write("/system/script/set", [`=.id=${id}`, `=source=${source}`]);
}

/** Mengarahkan peer WireGuard router ke server VPN yang diberikan. */
export async function setPeerEndpoint(
  conn: RouterOSAPI,
  endpoint: VpnPeerEndpoint,
): Promise<void> {
  const rows = await conn.write("/interface/wireguard/peers/print", [
    `?interface=${VPN_INTERFACE_NAME}`,
  ]);
  const id = firstRowId(
    rows,
    `Peer WireGuard pada ${VPN_INTERFACE_NAME} tidak ada di router`,
  );
  await conn.write("/interface/wireguard/peers/set", [
    `=.id=${id}`,
    `=endpoint-address=${endpoint.host}`,
    `=endpoint-port=${endpoint.port}`,
    `=public-key=${endpoint.publicKey}`,
  ]);
}

/** Menjalankan operasi RouterOS pada router tersimpan dengan kredensial API-nya. */
export function withVpnRouterConnection<T>(
  router: VpnRouterRecord,
  operation: (conn: RouterOSAPI) => Promise<T>,
): Promise<T> {
  return runProvisioningConnection({
    routerDetails: {
      ip: router.ipAddress,
      port: router.apiPort,
      username: router.apiUsernameGenerated || router.apiUsername,
      password: router.apiPasswordGenerated || router.apiPassword,
    },
    operation,
  });
}
