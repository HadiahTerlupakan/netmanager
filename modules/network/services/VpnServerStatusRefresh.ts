import { runAsSystemContext } from "@/lib/tenant-context";
import { createVpnServerService } from "../factories/VpnServerServiceFactory";
import { isVpnConfigured } from "../vpn/VpnCoreClient";
import type { VpnServerService } from "./VpnServerService";

/**
 * Menyegarkan status server VPN yang dilihat tenant dari core, sekali per
 * siklus monitor. Tanpa ini status hanya diperbarui saat superadmin membuka
 * halaman server VPN. Tidak melakukan apa pun bila VPN belum dikonfigurasi;
 * galat core diteruskan ke pemanggil.
 */
export async function refreshVpnServerStatuses(
  service: Pick<
    VpnServerService,
    "refreshServerStatuses"
  > = createVpnServerService(),
): Promise<void> {
  if (!isVpnConfigured()) return;
  await runAsSystemContext("refreshVpnServerStatuses: cermin status hub", () =>
    service.refreshServerStatuses(),
  );
}
