import { MikroTikRouterVpnMigrationRepository } from "../repositories/MikroTikRouterVpnMigrationRepository";
import { VpnCoreRouterTombstoneRepository } from "../repositories/VpnCoreRouterTombstoneRepository";
import { VpnServerRepository } from "../repositories/VpnServerRepository";
import { VpnDraftService } from "../services/VpnDraftService";
import { VpnRouterMigrationService } from "../services/VpnRouterMigrationService";

/** Buat service pindah router PUBLIC ⇄ VPN dengan repository default. */
export function createVpnRouterMigrationService() {
  const servers = new VpnServerRepository();
  return new VpnRouterMigrationService(
    new MikroTikRouterVpnMigrationRepository(),
    servers,
    new VpnDraftService(servers),
    new VpnCoreRouterTombstoneRepository(),
  );
}
