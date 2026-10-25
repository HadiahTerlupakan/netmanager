import type {
  MikroTikRouterEntity,
  MikroTikRouterUpdateData,
} from "../domain/entities/MikroTikRouterEntity";
import { ValidationError } from "@/lib/errors";
import { ISOLIR_SERVICE_VPN_ONLY_MESSAGE } from "@/lib/validations/mikrotik";
import { VpnRouterInvalidError } from "../vpn/errors";
import { isVpnOverlayAddress } from "../vpn/overlay";
import {
  getVpnCoreClient,
  isVpnConfigured,
  VpnCoreError,
} from "../vpn/VpnCoreClient";
import { vpnDraftLabel } from "./VpnDraftService";
import { assertNotVpnOverlayTarget, literalIp } from "./vpn-overlay-target";

/** Pesan untuk PATCH yang mengubah alamat/kredensial router VPN. */
export const VPN_LOCKED_FIELDS_MESSAGE =
  "Alamat dan kredensial router VPN dikelola otomatis";
const HTTP_NOT_FOUND = 404;

type LockedRouter = Pick<
  MikroTikRouterEntity,
  "connectionMode" | "ipAddress" | "apiPort" | "apiUsername" | "apiPassword"
>;

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
 * Router publik: alamat baru tidak boleh menunjuk ke overlay VPN dan mode
 * Server isolir ditolak.
 */
export async function guardRouterUpdate(
  router: LockedRouter,
  data: MikroTikRouterUpdateData,
): Promise<MikroTikRouterUpdateData> {
  if (router.connectionMode !== "VPN") {
    if (data.isolirMode === "ISOLIR_SERVICE") {
      throw new ValidationError(ISOLIR_SERVICE_VPN_ONLY_MESSAGE);
    }
    if (data.ipAddress !== undefined && data.ipAddress !== router.ipAddress) {
      await assertNotVpnOverlayTarget(data.ipAddress);
    }
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
 * Alamat yang boleh dipakai test koneksi dari body: alamat overlay hanya bila
 * milik draft VPN tenant (tanpa ini tenant bisa mencoba login API router
 * tenant lain lewat tunnel); alamat lain diperiksa seperti alamat router
 * publik. Mengembalikan IP yang sudah diperiksa untuk dihubungi langsung.
 */
export async function resolveTestAddress(params: {
  ipAddress: string;
  tenantId: string;
  vpnDraftId?: string;
}): Promise<string> {
  const ip = literalIp(params.ipAddress);
  if (
    ip !== null &&
    isVpnOverlayAddress(ip) &&
    params.vpnDraftId &&
    (await isOwnDraftAddress(params.vpnDraftId, params.tenantId, ip))
  ) {
    return ip;
  }
  return assertNotVpnOverlayTarget(params.ipAddress);
}
