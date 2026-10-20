import { MikroTikRouterVpnRepository } from "../repositories/MikroTikRouterVpnRepository";
import { VpnServerRepository } from "../repositories/VpnServerRepository";
import { VpnRouterService } from "../services/VpnRouterService";

/** Buat service VPN router dengan repository default. */
export function createVpnRouterService() {
  return new VpnRouterService(
    new MikroTikRouterVpnRepository(),
    new VpnServerRepository(),
  );
}
