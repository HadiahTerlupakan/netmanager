import type { VpnProtocol } from "@prisma/client";
import type { IMikroTikRouterVpnRepository } from "../domain/ports/IMikroTikRouterVpnRepository";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import { VpnRouterInvalidError } from "../vpn/errors";
import { toCoreProtocol } from "../vpn/protocol";
import { getVpnCoreClient } from "../vpn/VpnCoreClient";
import { assertServersUsable } from "./vpn-server-availability";
import {
  requireActiveVpnRouter,
  type ActiveVpnRouter,
} from "./VpnRouterService";

const SAME_PROTOCOL_MESSAGE = "Router sudah memakai protokol ini";

/**
 * Ganti protokol tunnel router VPN dalam dua langkah (paste dulu): script
 * protokol baru ditempel di router, baru kemudian core dan hub dipindahkan.
 */
export class VpnRouterProtocolService {
  constructor(
    private readonly repo: IMikroTikRouterVpnRepository,
    private readonly servers: Pick<IVpnServerRepository, "tenantServers">,
  ) {}

  /**
   * Script tempel untuk `protocol`. Core membuat login PPP bila belum ada,
   * tetapi protokol router di core dan di database tidak berubah.
   */
  async previewScript(
    routerId: string,
    tenantId: string,
    protocol: VpnProtocol,
  ): Promise<string> {
    const router = await this.requireOtherProtocol(
      routerId,
      tenantId,
      protocol,
    );
    const serverIds = (await this.repo.listServers(router.id, tenantId)).map(
      (s) => s.id,
    );
    const coreProtocol = toCoreProtocol(protocol);
    await assertServersUsable(this.servers, tenantId, serverIds, coreProtocol);
    return getVpnCoreClient().protocolScript(
      router.vpnCoreRouterId,
      coreProtocol,
    );
  }

  /**
   * Memindah router ke `protocol` di core dan hub; database diubah hanya bila
   * core berhasil. Alur R1: script dari `previewScript` harus sudah ditempel di
   * router lebih dulu. Panggilan langsung tanpa script itu tetap memindah core,
   * dan router offline sampai script protokol baru ditempel.
   */
  async apply(
    routerId: string,
    tenantId: string,
    protocol: VpnProtocol,
  ): Promise<void> {
    const router = await this.requireOtherProtocol(
      routerId,
      tenantId,
      protocol,
    );
    await getVpnCoreClient().setRouterProtocol(
      router.vpnCoreRouterId,
      toCoreProtocol(protocol),
    );
    await this.repo.setVpnProtocol(router.id, tenantId, protocol);
  }

  private async requireOtherProtocol(
    routerId: string,
    tenantId: string,
    protocol: VpnProtocol,
  ): Promise<ActiveVpnRouter> {
    const router = await requireActiveVpnRouter(this.repo, routerId, tenantId);
    if (router.vpnProtocol === protocol) {
      throw new VpnRouterInvalidError(SAME_PROTOCOL_MESSAGE);
    }
    return router;
  }
}
