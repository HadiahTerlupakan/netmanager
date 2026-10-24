import { MikroTikRouterVpnRepository } from "../repositories/MikroTikRouterVpnRepository";
import { VpnServerRepository } from "../repositories/VpnServerRepository";
import { VpnRouterProtocolService } from "../services/VpnRouterProtocolService";

/** Buat service ganti protokol router VPN dengan repository default. */
export function createVpnRouterProtocolService() {
  return new VpnRouterProtocolService(
    new MikroTikRouterVpnRepository(),
    new VpnServerRepository(),
  );
}
