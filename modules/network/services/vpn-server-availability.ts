import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import { VPN_SERVER_STATUS_ONLINE } from "../vpn/constants";
import { VpnServerNotAvailableError } from "../vpn/errors";

/**
 * Melempar `VpnServerNotAvailableError` kecuali setiap server di `serverIds`
 * di-assign ke tenant dan sedang online.
 */
export async function assertServersOnline(
  servers: Pick<IVpnServerRepository, "tenantServers">,
  tenantId: string,
  serverIds: string[],
): Promise<void> {
  const online = new Set(
    (await servers.tenantServers(tenantId))
      .filter((s) => s.status === VPN_SERVER_STATUS_ONLINE)
      .map((s) => s.id),
  );
  if (!serverIds.every((id) => online.has(id))) {
    throw new VpnServerNotAvailableError();
  }
}
