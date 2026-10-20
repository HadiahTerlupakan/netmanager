import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type {
  MikroTikRouterCreateData,
  MikroTikRouterEntity,
  MikroTikRouterUpdateData,
} from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";
import type { IVpnServerRepository } from "../domain/ports/IVpnServerRepository";
import type { IVpnCoreRouterTombstoneRepository } from "../domain/ports/IVpnCoreRouterTombstoneRepository";
import type { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import {
  logGeneratedApiUserActivity,
  logRouterCreateActivity,
  logRouterDeleteActivity,
  logRouterUpdateActivity,
} from "./mikrotik-router.activity";
import { getAuthorizedRouter } from "./mikrotik-router.access";
import {
  autoConfigureCreatedRouter,
  deprovisionRouter,
  runInitialRouterCheck,
} from "./mikrotik-router.provisioning";
import {
  buildCreateRouterData,
  buildGeneratedApiCredentialUpdate,
  buildUpdateRouterData,
  getForcedRadiusConfig,
  resolveCreateSiteId,
  resolveUpdateSiteId,
} from "./mikrotik-router.payloads";
import { deleteCoreRouterOrTombstone } from "./VpnCoreRouterCleanup";
import {
  createVpnRouter,
  type VpnRouterRequest,
} from "./mikrotik-router.vpn-create";

/** Data create router dari pengguna; field VPN hanya dipakai mode VPN. */
export type CreateRouterRequestData = Omit<
  MikroTikRouterCreateData,
  "tenantId" | "secretRadius" | "authPort" | "accountingPort"
> &
  VpnRouterRequest;

type CreateRouterInput = {
  data: CreateRouterRequestData;
  autoConfigure?: unknown;
  userId: string;
  tenantId: string;
  restrictedToOwnSite: boolean;
  routerRepository: Pick<IMikroTikRouterRepository, "create" | "delete">;
  networkRepository: Pick<
    IRouterAccessRepository,
    "findSettingByKey" | "findUserSite" | "updateGeneratedApiUser"
  >;
  provisioningService: Pick<
    MikroTikProvisioningService,
    "provisionRadius" | "createApiUser"
  >;
  vpnServerRepository: Pick<IVpnServerRepository, "tenantServerIds">;
  tombstoneRepository: Pick<IVpnCoreRouterTombstoneRepository, "add" | "has">;
};

type UpdateRouterInput = {
  id: string;
  data: MikroTikRouterUpdateData;
  userId: string;
  tenantId: string;
  restrictedToOwnSite: boolean;
  routerRepository: Pick<IMikroTikRouterRepository, "findById" | "update">;
  networkRepository: Pick<
    IRouterAccessRepository,
    "findSettingByKey" | "findUserSite"
  >;
};

type DeleteRouterInput = {
  id: string;
  userId: string;
  tenantId: string;
  restrictedToOwnSite: boolean;
  routerRepository: Pick<IMikroTikRouterRepository, "findById" | "delete">;
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
  provisioningService: Pick<MikroTikProvisioningService, "deprovisionRadius">;
  tombstoneRepository: Pick<IVpnCoreRouterTombstoneRepository, "add">;
};

type GenerateRouterApiUserInput = {
  id: string;
  userId: string;
  tenantId: string;
  restrictedToOwnSite: boolean;
  routerRepository: Pick<IMikroTikRouterRepository, "findById" | "update">;
  networkRepository: Pick<IRouterAccessRepository, "findUserSite">;
  provisioningService: Pick<MikroTikProvisioningService, "createApiUser">;
};

type RouterApiCredentials = {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
};

function buildCreateSiteParams(params: CreateRouterInput) {
  return {
    userId: params.userId,
    siteId: params.data.siteId,
    restrictedToOwnSite: params.restrictedToOwnSite,
    networkRepository: params.networkRepository,
  };
}

function buildUpdateSiteParams(params: UpdateRouterInput) {
  return {
    userId: params.userId,
    siteId: params.data.siteId,
    restrictedToOwnSite: params.restrictedToOwnSite,
    networkRepository: params.networkRepository,
  };
}

function buildRouterApiConnection(router: RouterApiCredentials) {
  return {
    ip: router.ipAddress,
    port: router.apiPort,
    username: router.apiUsername,
    password: router.apiPassword,
  };
}

async function resolveCreateRouterData(
  params: CreateRouterInput,
): Promise<MikroTikRouterCreateData> {
  const [radiusConfig, siteId] = await Promise.all([
    getForcedRadiusConfig(params.networkRepository),
    resolveCreateSiteId(buildCreateSiteParams(params)),
  ]);

  return buildCreateRouterData({
    data: params.data,
    tenantId: params.tenantId,
    siteId,
    radiusConfig,
  });
}

async function resolveUpdateRouterData(
  params: UpdateRouterInput,
): Promise<MikroTikRouterUpdateData> {
  const [radiusConfig, siteId] = await Promise.all([
    getForcedRadiusConfig(params.networkRepository),
    resolveUpdateSiteId(buildUpdateSiteParams(params)),
  ]);

  return buildUpdateRouterData({
    data: params.data,
    tenantId: params.tenantId,
    siteId,
    radiusConfig,
  });
}

// Router VPN harus tetap RouterOS v7; versinya hanya diubah lewat form saat publik.
function withoutVpnLockedFields(
  router: { connectionMode: string },
  data: MikroTikRouterUpdateData,
): MikroTikRouterUpdateData {
  if (router.connectionMode !== "VPN") return data;
  return { ...data, rosVersion: undefined };
}

async function ensureRouterAccess(
  params: UpdateRouterInput,
): Promise<MikroTikRouterEntity> {
  return getAuthorizedRouter({
    ...params,
    routerRepository: params.routerRepository,
    networkRepository: params.networkRepository,
  });
}

async function resolveRouterForDeletion(params: DeleteRouterInput) {
  if (!params.restrictedToOwnSite) {
    return params.routerRepository.findById(params.id, params.tenantId);
  }

  return getAuthorizedRouter({
    ...params,
    routerRepository: params.routerRepository,
    networkRepository: params.networkRepository,
  });
}

async function deprovisionExistingRouter(
  params: DeleteRouterInput,
  router: Awaited<ReturnType<typeof resolveRouterForDeletion>>,
): Promise<void> {
  if (!router) {
    return;
  }

  await deprovisionRouter({
    provisioningService: params.provisioningService,
    router,
  });
}

async function finalizeCreatedRouter(params: {
  input: CreateRouterInput;
  routerId: string;
  createData: MikroTikRouterCreateData;
}): Promise<void> {
  const radiusConfig = await getForcedRadiusConfig(
    params.input.networkRepository,
  );

  await autoConfigureCreatedRouter({
    enabled: Boolean(params.input.autoConfigure),
    routerId: params.routerId,
    createData: params.createData,
    radiusConfig,
    networkRepository: params.input.networkRepository,
    provisioningService: params.input.provisioningService,
  });
  await runInitialRouterCheck(params.routerId);
  logRouterCreateActivity(
    params.input.userId,
    params.routerId,
    params.createData,
  );
}

async function requestGeneratedApiUser(params: GenerateRouterApiUserInput) {
  const router = await getAuthorizedRouter({
    ...params,
    routerRepository: params.routerRepository,
    networkRepository: params.networkRepository,
  });

  return {
    routerId: router.id,
    result: await params.provisioningService.createApiUser(
      buildRouterApiConnection(router),
    ),
  };
}

async function saveGeneratedApiCredentials(params: {
  input: GenerateRouterApiUserInput;
  routerId: string;
  username?: string;
  password?: string;
}): Promise<void> {
  await params.input.routerRepository.update(
    params.routerId,
    buildGeneratedApiCredentialUpdate(params),
    params.input.tenantId,
  );
}

function saveCreatedRouter(
  params: CreateRouterInput,
  createData: MikroTikRouterCreateData,
  vpnRequest: VpnRouterRequest,
): Promise<{ id: string }> {
  if (createData.connectionMode !== "VPN") {
    return params.routerRepository.create(createData);
  }
  return createVpnRouter({
    createData,
    request: vpnRequest,
    routerRepository: params.routerRepository,
    vpnServerRepository: params.vpnServerRepository,
    tombstoneRepository: params.tombstoneRepository,
  });
}

/** Buat router baru lalu jalankan provisioning serta logging pasca-create. */
export async function createRouterMutation(
  params: CreateRouterInput,
): Promise<{ id: string }> {
  const { vpnDraftId, vpnServerIds, ...data } = params.data;
  const createData = await resolveCreateRouterData({ ...params, data });
  const router = await saveCreatedRouter(params, createData, {
    vpnDraftId,
    vpnServerIds,
  });

  await finalizeCreatedRouter({
    input: params,
    routerId: router.id,
    createData,
  });

  return { id: router.id };
}

/** Perbarui router dan pastikan payload runtime RADIUS ikut tersinkron. */
export async function updateRouterMutation(
  params: UpdateRouterInput,
): Promise<void> {
  const router = await ensureRouterAccess(params);
  const updateData = await resolveUpdateRouterData({
    ...params,
    data: withoutVpnLockedFields(router, params.data),
  });
  await params.routerRepository.update(params.id, updateData, params.tenantId);
  logRouterUpdateActivity(params.userId, params.id, params.data);
}

/**
 * Hapus router setelah deprovisioning bila router masih dapat ditemukan.
 * Router VPN juga dihapus di core setelah penghapusan lokal berhasil.
 */
export async function deleteRouterMutation(
  params: DeleteRouterInput,
): Promise<void> {
  const router = await resolveRouterForDeletion(params);
  await deprovisionExistingRouter(params, router);
  await params.routerRepository.delete(params.id, params.tenantId);
  if (router?.connectionMode === "VPN" && router.vpnCoreRouterId) {
    await deleteCoreRouterOrTombstone(
      router.vpnCoreRouterId,
      params.tombstoneRepository,
    );
  }
  logRouterDeleteActivity(params.userId, params.id);
}

/** Generate API user router dan simpan kredensial generated saat berhasil. */
export async function generateRouterApiUserMutation(
  params: GenerateRouterApiUserInput,
): Promise<{ success: boolean; username?: string; logs: string[] }> {
  const { routerId, result } = await requestGeneratedApiUser(params);

  if (!result.success) {
    return result;
  }

  await saveGeneratedApiCredentials({
    input: params,
    routerId,
    username: result.username,
    password: result.password,
  });
  logGeneratedApiUserActivity(params.userId, params.id, result.username);
  return result;
}
