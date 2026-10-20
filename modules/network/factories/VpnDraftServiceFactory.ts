import { VpnServerRepository } from "../repositories/VpnServerRepository";
import { VpnDraftService } from "../services/VpnDraftService";

/** Buat service draft VPN dengan repository default. */
export function createVpnDraftService() {
  return new VpnDraftService(new VpnServerRepository());
}
