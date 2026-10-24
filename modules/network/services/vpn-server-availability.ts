import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import { VPN_SERVER_STATUS_ONLINE } from "../vpn/constants";
import { VpnServerNotAvailableError } from "../vpn/errors";
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
