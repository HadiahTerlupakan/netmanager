import { randomBytes } from "node:crypto";
import type {
  IVpnServerRepository,
  VpnServerSummary,
} from "../domain/ports/IVpnServerRepository";
import {
  VpnDraftForbiddenError,
  VpnServerNotAvailableError,
} from "../vpn/errors";
import {
  getVpnCoreAddress,
  getVpnCoreClient,
  VpnCoreError,
} from "../vpn/VpnCoreClient";
import type { CoreRouter } from "../vpn/types";
import { buildVpnApiUserScript } from "./vpn-api-user-script";

/** Handshake dianggap segar (tunnel hidup) bila lebih baru dari ini. */
export const VPN_HANDSHAKE_FRESH_MS = 180_000;
const HTTP_NOT_FOUND = 404;
const SERVER_STATUS_ONLINE = "online";
const API_USERNAME_PREFIX = "netmanager-";
const API_USERNAME_BYTES = 4;
const API_PASSWORD_BYTES = 18;

/** Label router di core yang menandai pemilik draft. */
export function vpnDraftLabel(tenantId: string): string {
  return `nm:${tenantId}`;
}

/** Melempar `VpnDraftForbiddenError` bila router core bukan milik tenant. */
export function assertDraftOwned(router: CoreRouter, tenantId: string): void {
  if (router.label !== vpnDraftLabel(tenantId)) {
    throw new VpnDraftForbiddenError();
  }
}

export interface VpnDraftInput {
  serverIds: string[];
  previousDraftId?: string;
  apiUsername?: string;
  apiPassword?: string;
}

export interface VpnDraftResult {
  draftId: string;
  address: string;
  apiUsername: string;
  apiPassword: string;
  script: string;
}

export interface VpnDraftStatus {
  stage: "waiting" | "tunnel_up";
  lastHandshakeAt: string | null;
  activeServerId: string | null;
}

function orderedHubIds(router: CoreRouter): string[] {
  return [...router.hubs]
    .sort((a, b) => a.priority - b.priority)
    .map((h) => h.hubId);
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Draft router VPN untuk tenant: daftar server, pembuatan/penggunaan ulang draft, status tunnel. */
export class VpnDraftService {
  constructor(
    private readonly repo: IVpnServerRepository,
    private readonly now: () => number = Date.now,
  ) {}

  /** Server VPN yang di-assign ke tenant. */
  listTenantServers(tenantId: string): Promise<VpnServerSummary[]> {
    return this.repo.tenantServers(tenantId);
  }

  /** Membuat draft baru atau memakai ulang `previousDraftId` bila daftar hub sama. */
  async createDraft(
    tenantId: string,
    input: VpnDraftInput,
  ): Promise<VpnDraftResult> {
    await this.assertServersAvailable(tenantId, input.serverIds);
    const core = getVpnCoreClient();
    const reused = await this.reusePrevious(tenantId, input);
    const router =
      reused ??
      (await core.createRouter({
        label: vpnDraftLabel(tenantId),
        hubIds: input.serverIds,
      }));
    const apiUsername =
      input.apiUsername ??
      `${API_USERNAME_PREFIX}${randomBytes(API_USERNAME_BYTES).toString("hex")}`;
    const apiPassword =
      input.apiPassword ??
      randomBytes(API_PASSWORD_BYTES).toString("base64url");
    const coreScript = await core.routerScript(router.id, "full");
    const apiScript = buildVpnApiUserScript({
      username: apiUsername,
      password: apiPassword,
      coreAddress: getVpnCoreAddress(),
      mode: "create",
    });
    return {
      draftId: router.id,
      address: router.address,
      apiUsername,
      apiPassword,
      script: `${coreScript}\n${apiScript}`,
    };
  }

  /** Status tunnel sebuah draft milik tenant. */
  async getStatus(tenantId: string, draftId: string): Promise<VpnDraftStatus> {
    const router = await getVpnCoreClient().getRouter(draftId);
    assertDraftOwned(router, tenantId);
    const handshakeAt = router.lastHandshakeAt
      ? Date.parse(router.lastHandshakeAt)
      : null;
    const fresh =
      handshakeAt !== null &&
      this.now() - handshakeAt <= VPN_HANDSHAKE_FRESH_MS;
    return {
      stage: fresh ? "tunnel_up" : "waiting",
      lastHandshakeAt: router.lastHandshakeAt,
      activeServerId: router.activeHubId,
    };
  }

  private async assertServersAvailable(
    tenantId: string,
    serverIds: string[],
  ): Promise<void> {
    const assigned = await this.repo.tenantServers(tenantId);
    const online = new Set(
      assigned
        .filter((s) => s.status === SERVER_STATUS_ONLINE)
        .map((s) => s.id),
    );
    if (!serverIds.every((id) => online.has(id))) {
      throw new VpnServerNotAvailableError();
    }
  }

  /** Mengembalikan draft sebelumnya bila hub-nya sama; bila beda, menghapusnya. */
  private async reusePrevious(
    tenantId: string,
    input: VpnDraftInput,
  ): Promise<CoreRouter | null> {
    if (!input.previousDraftId) return null;
    const core = getVpnCoreClient();
    let previous: CoreRouter;
    try {
      previous = await core.getRouter(input.previousDraftId);
    } catch (error) {
      if (error instanceof VpnCoreError && error.status === HTTP_NOT_FOUND) {
        return null;
      }
      throw error;
    }
    assertDraftOwned(previous, tenantId);
    if (sameList(orderedHubIds(previous), input.serverIds)) return previous;
    await core.deleteRouter(previous.id);
    return null;
  }
}
