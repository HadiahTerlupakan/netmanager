import type { VpnProtocol } from "@prisma/client";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import { VPN_SERVER_STATUS_ONLINE } from "../vpn/constants";
import { VpnServerNotAvailableError } from "../vpn/errors";
import { fromCoreProtocol } from "../vpn/protocol";
import type { CoreVpnProtocol } from "../vpn/types";

/**
 * Melempar `VpnServerNotAvailableError` kecuali setiap server di `serverIds`
 * di-assign ke tenant, sedang online, dan melayani `protocol`.
 */
export async function assertServersUsable(
  servers: Pick<IVpnServerRepository, "tenantServers">,
  tenantId: string,
  serverIds: string[],
  protocol: CoreVpnProtocol,
): Promise<void> {
  const usable = new Set(
    (await servers.tenantServers(tenantId))
      .filter(
        (s) =>
          s.status === VPN_SERVER_STATUS_ONLINE &&
          s.protocols.includes(protocol),
      )
      .map((s) => s.id),
  );
  if (!serverIds.every((id) => usable.has(id))) {
    throw new VpnServerNotAvailableError();
  }
}

/**
 * Protokol yang dilayani sebuah server tenant yang sedang online. Melempar
 * `VpnServerNotAvailableError` bila server tidak di-assign atau offline.
 */
export async function onlineServerProtocols(
  servers: Pick<IVpnServerRepository, "tenantServers">,
  tenantId: string,
  serverId: string,
): Promise<VpnProtocol[]> {
  const server = (await servers.tenantServers(tenantId)).find(
    (s) => s.id === serverId && s.status === VPN_SERVER_STATUS_ONLINE,
  );
  if (!server) throw new VpnServerNotAvailableError();
  return server.protocols
    .filter((p): p is CoreVpnProtocol => p === "wireguard" || p === "l2tp")
    .map(fromCoreProtocol);
}
