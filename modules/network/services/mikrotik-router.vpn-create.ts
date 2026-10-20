import { logger } from "@/lib/logger";
import type { MikroTikRouterCreateData } from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import {
  VpnDraftInvalidError,
  VpnRouterActivationError,
  VpnServerNotAvailableError,
} from "../vpn/errors";
import { getVpnCoreClient, VpnCoreError } from "../vpn/VpnCoreClient";
import type { CoreRouter } from "../vpn/types";
import {
  assertDraftOwned,
  hasSameHubOrder,
  isUnclaimedDraft,
} from "./VpnDraftService";

const HTTP_NOT_FOUND = 404;

/** Field permintaan create yang hanya dipakai router mode VPN. */
export type VpnRouterRequest = {
  vpnDraftId?: string;
  vpnServerIds?: string[];
};

type CreateVpnRouterParams = {
  createData: MikroTikRouterCreateData;
  request: VpnRouterRequest;
  routerRepository: Pick<IMikroTikRouterRepository, "create" | "delete">;
  vpnServerRepository: Pick<IVpnServerRepository, "tenantServerIds">;
};

type ValidVpnRequest = { vpnDraftId: string; vpnServerIds: string[] };

function requireVpnRequest(request: VpnRouterRequest): ValidVpnRequest {
  if (!request.vpnDraftId || !request.vpnServerIds?.length) {
    throw new VpnDraftInvalidError("Draft VPN wajib diisi");
  }
  return { vpnDraftId: request.vpnDraftId, vpnServerIds: request.vpnServerIds };
}

async function fetchDraft(draftId: string): Promise<CoreRouter> {
  try {
    return await getVpnCoreClient().getRouter(draftId);
  } catch (error) {
    if (error instanceof VpnCoreError && error.status === HTTP_NOT_FOUND) {
      throw new VpnDraftInvalidError("Draft VPN tidak ditemukan");
    }
    throw error;
  }
}

async function assertServersAssigned(
  params: CreateVpnRouterParams,
  serverIds: string[],
): Promise<void> {
  const assigned = new Set(
    await params.vpnServerRepository.tenantServerIds(
      params.createData.tenantId,
    ),
  );
  if (!serverIds.every((id) => assigned.has(id))) {
    throw new VpnServerNotAvailableError();
  }
}

async function assertDraftUsable(
  params: CreateVpnRouterParams,
  request: ValidVpnRequest,
): Promise<void> {
  const draft = await fetchDraft(request.vpnDraftId);
  assertDraftOwned(draft, params.createData.tenantId);
  if (!isUnclaimedDraft(draft)) {
    throw new VpnDraftInvalidError("Draft VPN sudah dipakai");
  }
  if (draft.address !== params.createData.ipAddress) {
    throw new VpnDraftInvalidError("IP Router tidak cocok dengan draft VPN");
  }
  if (!hasSameHubOrder(draft, request.vpnServerIds)) {
    throw new VpnDraftInvalidError("Server VPN tidak cocok dengan draft VPN");
  }
  await assertServersAssigned(params, request.vpnServerIds);
}

// Belum ada provisioning yang berjalan, jadi cukup hapus baris router (dan NAS
// lewat repository) tanpa deprovisioning ke router.
async function removeUnclaimedRouter(
  params: CreateVpnRouterParams,
  routerId: string,
): Promise<void> {
  try {
    await params.routerRepository.delete(routerId, params.createData.tenantId);
  } catch (error) {
    logger.error(
      `[VPN] Gagal menghapus router ${routerId} setelah claim gagal:`,
      error,
    );
  }
}

async function claimDraft(
  params: CreateVpnRouterParams,
  request: ValidVpnRequest,
  routerId: string,
): Promise<void> {
  try {
    await getVpnCoreClient().claimRouter(request.vpnDraftId, routerId);
  } catch (error) {
    logger.error(`[VPN] Claim draft ${request.vpnDraftId} gagal:`, error);
    await removeUnclaimedRouter(params, routerId);
    throw new VpnRouterActivationError();
  }
}

/**
 * Buat router mode VPN: validasi draft core (milik tenant, belum dipakai,
 * alamat dan urutan server cocok, server masih di-assign) sebelum menulis apa
 * pun, simpan router beserta urutan servernya, lalu claim draft. Claim gagal
 * menghapus router yang baru dibuat dan melempar `VpnRouterActivationError`.
 */
export async function createVpnRouter(
  params: CreateVpnRouterParams,
): Promise<{ id: string }> {
  const request = requireVpnRequest(params.request);
  await assertDraftUsable(params, request);
  const router = await params.routerRepository.create(
    {
      ...params.createData,
      vpnAddress: params.createData.ipAddress,
      vpnCoreRouterId: request.vpnDraftId,
    },
    request.vpnServerIds,
  );
  await claimDraft(params, request, router.id);
  return router;
}
