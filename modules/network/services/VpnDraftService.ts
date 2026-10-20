import { randomBytes } from "node:crypto";
import type { IVpnCoreRouterTombstoneRepository } from "../domain/ports/IVpnCoreRouterTombstoneRepository";
import type {
  IVpnServerRepository,
  VpnServerSummary,
} from "../domain/ports/IVpnServerRepository";
import { VpnDraftForbiddenError } from "../vpn/errors";
import {
  getVpnCoreAddress,
  getVpnCoreClient,
  VpnCoreError,
} from "../vpn/VpnCoreClient";
import type { CoreRouter } from "../vpn/types";
import { VpnCoreRouterTombstoneRepository } from "../repositories/VpnCoreRouterTombstoneRepository";
import { buildVpnApiUserScript } from "./vpn-api-user-script";
import { assertServersOnline } from "./vpn-server-availability";

/** Handshake dianggap segar (tunnel hidup) bila lebih baru dari ini. */
export const VPN_HANDSHAKE_FRESH_MS = 180_000;
const HTTP_NOT_FOUND = 404;
const API_USERNAME_PREFIX = "netmanager-";
const API_USERNAME_BYTES = 4;
const API_PASSWORD_BYTES = 24;

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

/** Draft untuk router yang sudah ada; tanpa kredensial karena user API lama dipakai. */
export type VpnExtendDraftResult = Pick<
  VpnDraftResult,
  "draftId" | "address" | "script"
>;

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

/**
 * True bila router core masih draft. Router yang sudah dipakai (aktif atau
 * sudah di-claim) tidak boleh dipakai ulang, dihapus lewat previousDraftId,
 * maupun di-claim router kedua.
 */
export function isUnclaimedDraft(router: CoreRouter): boolean {
  return router.status === "pending" && router.ref === "";
}

/** True bila handshake terakhir router core masih dalam `VPN_HANDSHAKE_FRESH_MS`. */
export function isHandshakeFresh(router: CoreRouter, now: number): boolean {
  if (!router.lastHandshakeAt) return false;
  return now - Date.parse(router.lastHandshakeAt) <= VPN_HANDSHAKE_FRESH_MS;
}

/** True bila hub router core, diurutkan menurut prioritas, sama persis dengan `hubIds`. */
export function hasSameHubOrder(router: CoreRouter, hubIds: string[]): boolean {
  const ordered = orderedHubIds(router);
  return (
    ordered.length === hubIds.length &&
    ordered.every((id, i) => id === hubIds[i])
  );
}

/** Draft router VPN untuk tenant: daftar server, pembuatan/penggunaan ulang draft, status tunnel. */
export class VpnDraftService {
  constructor(
    private readonly repo: IVpnServerRepository,
    private readonly now: () => number = Date.now,
    private readonly tombstones: Pick<
      IVpnCoreRouterTombstoneRepository,
      "has"
    > = new VpnCoreRouterTombstoneRepository(),
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
    const { router, coreScript } = await this.prepareDraft(tenantId, input);
    const apiUsername =
      input.apiUsername ??
      `${API_USERNAME_PREFIX}${randomBytes(API_USERNAME_BYTES).toString("hex")}`;
    const apiPassword =
      input.apiPassword ??
      randomBytes(API_PASSWORD_BYTES).toString("base64url");
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

  /**
   * Draft untuk router publik yang sudah tersimpan: skripnya hanya menambah
   * alamat core ke user API `apiUsername` yang sudah dipakai netmanager, tanpa
   * membuat user atau menyentuh password.
   */
  async createExtendDraft(
    tenantId: string,
    input: Pick<VpnDraftInput, "serverIds" | "previousDraftId">,
    apiUsername: string,
  ): Promise<VpnExtendDraftResult> {
    const { router, coreScript } = await this.prepareDraft(tenantId, input);
    const apiScript = buildVpnApiUserScript({
      username: apiUsername,
      coreAddress: getVpnCoreAddress(),
      mode: "extend",
    });
    return {
      draftId: router.id,
      address: router.address,
      script: `${coreScript}\n${apiScript}`,
    };
  }

  /** Status tunnel sebuah draft milik tenant. */
  async getStatus(tenantId: string, draftId: string): Promise<VpnDraftStatus> {
    const router = await getVpnCoreClient().getRouter(draftId);
    assertDraftOwned(router, tenantId);
    return {
      stage: isHandshakeFresh(router, this.now()) ? "tunnel_up" : "waiting",
      lastHandshakeAt: router.lastHandshakeAt,
      activeServerId: router.activeHubId,
    };
  }

  private async prepareDraft(
    tenantId: string,
    input: Pick<VpnDraftInput, "serverIds" | "previousDraftId">,
  ): Promise<{ router: CoreRouter; coreScript: string }> {
    await assertServersOnline(this.repo, tenantId, input.serverIds);
    const core = getVpnCoreClient();
    const reused = await this.reusePrevious(tenantId, input);
    const router =
      reused ??
      (await core.createRouter({
        label: vpnDraftLabel(tenantId),
        hubIds: input.serverIds,
      }));
    const coreScript = await core.routerScript(router.id, "full");
    return { router, coreScript };
  }

  /**
   * Mengembalikan draft sebelumnya bila hub-nya sama; bila beda, menghapusnya.
   * Draft yang sudah di-tombstone (claim gagal) tidak pernah dipakai lagi.
   */
  private async reusePrevious(
    tenantId: string,
    input: Pick<VpnDraftInput, "serverIds" | "previousDraftId">,
  ): Promise<CoreRouter | null> {
    if (!input.previousDraftId) return null;
    if (await this.tombstones.has(input.previousDraftId)) return null;
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
    if (!isUnclaimedDraft(previous)) return null;
    if (hasSameHubOrder(previous, input.serverIds)) return previous;
    await core.deleteRouter(previous.id);
    return null;
  }
}
