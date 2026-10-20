import { VpnServerRepository } from "../repositories/VpnServerRepository";
import { VpnServerService } from "../services/VpnServerService";

/** Buat service server VPN dengan repository default. */
export function createVpnServerService() {
  return new VpnServerService(new VpnServerRepository());
}
