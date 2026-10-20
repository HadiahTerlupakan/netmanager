import type {
  MikroTikRouterEntity,
  MikroTikRouterUpdateData,
} from "../domain/entities/MikroTikRouterEntity";
import { VpnRouterInvalidError } from "../vpn/errors";
import {
  isVpnOverlayAddress,
  VPN_OVERLAY_ADDRESS_MESSAGE,
} from "../vpn/overlay";
import {
  getVpnCoreClient,
  isVpnConfigured,
  VpnCoreError,
} from "../vpn/VpnCoreClient";
import { vpnDraftLabel } from "./VpnDraftService";

/** Pesan untuk PATCH yang mengubah alamat/kredensial router VPN. */
export const VPN_LOCKED_FIELDS_MESSAGE =
  "Alamat dan kredensial router VPN dikelola otomatis";
const HTTP_NOT_FOUND = 404;

type LockedRouter = Pick<
  MikroTikRouterEntity,
  "connectionMode" | "ipAddress" | "apiPort" | "apiUsername" | "apiPassword"
>;

/** Melempar `VpnRouterInvalidError` bila router publik memakai alamat overlay VPN. */
export function assertPublicAddressAllowed(
  ipAddress: string | undefined,
): void {
  if (ipAddress && isVpnOverlayAddress(ipAddress)) {
    throw new VpnRouterInvalidError(VPN_OVERLAY_ADDRESS_MESSAGE);
  }
}

function changesLockedField(
  router: LockedRouter,
  data: MikroTikRouterUpdateData,
): boolean {
  const changed = <T>(next: T | undefined, current: T) =>
    next !== undefined && next !== current;
  return (
    changed(data.ipAddress, router.ipAddress) ||
    changed(
      data.apiPort === undefined ? undefined : Number(data.apiPort),
      router.apiPort,
    ) ||
    changed(data.apiUsername, router.apiUsername) ||
    changed(data.apiPassword, router.apiPassword)
  );
}

/**
 * Data PATCH yang aman untuk router. Router VPN: alamat tunnel dan kredensial
 * API tidak boleh berubah (nasname harus tetap IP tunnel), nilai yang sama
 * tetap diterima agar form edit bisa menyimpan, dan versi RouterOS tetap v7.
 * Router publik: alamat baru tidak boleh berada di overlay VPN.
 */
export function guardRouterUpdate(
  router: LockedRouter,
  data: MikroTikRouterUpdateData,
): MikroTikRouterUpdateData {
  if (router.connectionMode !== "VPN") {
    assertPublicAddressAllowed(data.ipAddress);
    return data;
  }
  if (changesLockedField(router, data)) {
    throw new VpnRouterInvalidError(VPN_LOCKED_FIELDS_MESSAGE);
  }
  return { ...data, rosVersion: undefined };
}

async function isOwnDraftAddress(
  draftId: string,
  tenantId: string,
  ipAddress: string,
): Promise<boolean> {
  if (!isVpnConfigured()) return false;
  try {
    const draft = await getVpnCoreClient().getRouter(draftId);
    return (
      draft.label === vpnDraftLabel(tenantId) && draft.address === ipAddress
    );
  } catch (error) {
    if (error instanceof VpnCoreError && error.status === HTTP_NOT_FOUND) {
      return false;
    }
    throw error;
  }
}

/**
 * Test koneksi ke alamat overlay hanya untuk alamat draft VPN milik tenant;
 * tanpa ini tenant bisa mencoba login API router tenant lain lewat tunnel.
 */
export async function assertTestAddressAllowed(params: {
  ipAddress?: string;
  tenantId: string;
  vpnDraftId?: string;
}): Promise<void> {
  if (!params.ipAddress || !isVpnOverlayAddress(params.ipAddress)) return;
  if (
    params.vpnDraftId &&
    (await isOwnDraftAddress(
      params.vpnDraftId,
      params.tenantId,
      params.ipAddress,
    ))
  ) {
    return;
  }
  throw new VpnRouterInvalidError(VPN_OVERLAY_ADDRESS_MESSAGE);
}
