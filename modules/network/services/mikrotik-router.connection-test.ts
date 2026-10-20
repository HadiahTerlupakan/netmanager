import { logger } from "@/lib/logger";
import type { MikroTikRouterUpdateData } from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";
import {
  testMikroTikAPI,
  type RouterInfo,
  type TestConnectionResult,
} from "./mikrotik/router-api-test";
import { assertTestAddressAllowed } from "./mikrotik-router.vpn-guards";

const DEFAULT_API_PORT = 8728;
const MIN_PORT = 1;
const MAX_PORT = 65535;

type ConnectionParams = {
  ipAddress?: string;
  apiPort?: number | string;
  apiUsername?: string;
  apiPassword?: string;
};

type TestRouterConnectionInput = {
  tenantId: string;
  routerId?: string;
  /** Draft VPN milik form tambah router; syarat test ke alamat overlay. */
  vpnDraftId?: string;
  ipAddress?: string;
  apiPort?: number | string;
  apiUsername?: string;
  apiPassword?: string;
  routerRepository: Pick<IMikroTikRouterRepository, "findById" | "update">;
};

type ConnectionStatusPayload = {
  pingStatus: string;
  userOnline: number;
};

function buildStoredConnectionParams(router: {
  ipAddress: string;
  apiPort: number;
  apiUsernameGenerated: string | null;
  apiUsername: string;
  apiPasswordGenerated: string | null;
  apiPassword: string;
}): ConnectionParams {
  return {
    ipAddress: router.ipAddress,
    apiPort: router.apiPort,
    apiUsername: router.apiUsernameGenerated || router.apiUsername,
    apiPassword: router.apiPasswordGenerated || router.apiPassword,
  };
}

function createConnectionTestResult(
  ipAddress: string,
  apiPort: number,
  apiUsername: string,
  apiPassword: string,
) {
  return testMikroTikAPI({
    ipAddress,
    port: apiPort,
    username: apiUsername,
    password: apiPassword,
  });
}

function createStatusLogError(error: unknown) {
  logger.error("Error updating connection status:", error);
}

function createFetchRouterLogError(error: unknown) {
  logger.error("Error fetching router:", error);
}

function getNumericPort(port?: number | string): number {
  const parsed = Number(port);
  if (!Number.isFinite(parsed) || parsed < MIN_PORT || parsed > MAX_PORT) {
    return DEFAULT_API_PORT;
  }

  return parsed;
}

function createMissingIpResult(): TestConnectionResult {
  return { success: false, message: "IP Address is required" };
}

function createMissingCredentialResult(): TestConnectionResult {
  return {
    success: false,
    message: "Username/Password tidak disediakan untuk test koneksi API",
  };
}

function createConnectionStatusUpdate(
  params: ConnectionStatusPayload,
): MikroTikRouterUpdateData {
  return {
    pingStatus: params.pingStatus,
    userOnline: params.userOnline,
    lastStatusCheck: new Date(),
  };
}

async function updateRouterConnectionStatus(params: {
  routerRepository: Pick<IMikroTikRouterRepository, "update">;
  routerId: string;
  tenantId: string;
  pingStatus: string;
  userOnline: number;
}): Promise<void> {
  try {
    await params.routerRepository.update(
      params.routerId,
      createConnectionStatusUpdate(params),
      params.tenantId,
    );
  } catch (error: unknown) {
    createStatusLogError(error);
  }
}

async function syncStoredRouterStatus(params: {
  routerRepository: Pick<IMikroTikRouterRepository, "update">;
  routerId: string | null;
  tenantId: string;
  apiResult: TestConnectionResult;
}): Promise<void> {
  if (!params.routerId) {
    return;
  }

  await syncConnectionStatus({
    routerRepository: params.routerRepository,
    routerId: params.routerId,
    tenantId: params.tenantId,
    apiResult: params.apiResult,
  });
}

/**
 * Test koneksi API router dan sinkronkan status online/offline bila router
 * tersimpan. Alamat dari body (bukan router tersimpan) di overlay VPN hanya
 * boleh alamat draft VPN tenant; selain itu `VpnRouterInvalidError`.
 */
export async function testRouterConnection(
  params: TestRouterConnectionInput,
): Promise<{
  apiResult: TestConnectionResult;
  routerInfo: RouterInfo | null;
  resolvedRouterId: string | null;
}> {
  const resolvedRouterId = params.routerId ?? null;
  const { connectionParams, isStoredRouter } =
    await resolveConnectionParams(params);
  if (!isStoredRouter) {
    await assertTestAddressAllowed({
      ipAddress: connectionParams.ipAddress,
      tenantId: params.tenantId,
      vpnDraftId: params.vpnDraftId,
    });
  }
  const apiResult = await buildConnectionResult(connectionParams);

  await syncStoredRouterStatus({
    routerRepository: params.routerRepository,
    routerId: resolvedRouterId,
    tenantId: params.tenantId,
    apiResult,
  });

  return createConnectionResponse(apiResult, resolvedRouterId);
}

async function resolveConnectionParams(
  params: TestRouterConnectionInput,
): Promise<{ connectionParams: ConnectionParams; isStoredRouter: boolean }> {
  const connectionParams: ConnectionParams = {
    ipAddress: params.ipAddress,
    apiPort: params.apiPort,
    apiUsername: params.apiUsername,
    apiPassword: params.apiPassword,
  };

  const fromBody = { connectionParams, isStoredRouter: false };
  if (!params.routerId) {
    return fromBody;
  }

  try {
    const router = await params.routerRepository.findById(
      params.routerId!,
      params.tenantId,
    );

    if (!router) {
      return fromBody;
    }

    return {
      connectionParams: buildStoredConnectionParams(router),
      isStoredRouter: true,
    };
  } catch (error: unknown) {
    createFetchRouterLogError(error);
    return fromBody;
  }
}

function createConnectionResponse(
  apiResult: TestConnectionResult,
  resolvedRouterId: string | null,
): {
  apiResult: TestConnectionResult;
  routerInfo: RouterInfo | null;
  resolvedRouterId: string | null;
} {
  return {
    apiResult,
    routerInfo: apiResult.routerInfo || null,
    resolvedRouterId,
  };
}

async function buildConnectionResult(
  params: ConnectionParams,
): Promise<TestConnectionResult> {
  if (!params.ipAddress) {
    return createMissingIpResult();
  }

  if (!params.apiUsername || !params.apiPassword) {
    return createMissingCredentialResult();
  }

  return createConnectionTestResult(
    params.ipAddress,
    getNumericPort(params.apiPort),
    params.apiUsername,
    params.apiPassword,
  );
}

function buildConnectionStatusPayload(
  apiResult: TestConnectionResult,
): ConnectionStatusPayload {
  if (apiResult.success && apiResult.routerInfo) {
    return {
      pingStatus: "online",
      userOnline: apiResult.routerInfo.userOnline || 0,
    };
  }

  return { pingStatus: "offline", userOnline: 0 };
}

async function syncConnectionStatus(params: {
  routerRepository: Pick<IMikroTikRouterRepository, "update">;
  routerId: string;
  tenantId: string;
  apiResult: TestConnectionResult;
}): Promise<void> {
  await updateRouterConnectionStatus({
    routerRepository: params.routerRepository,
    routerId: params.routerId,
    tenantId: params.tenantId,
    ...buildConnectionStatusPayload(params.apiResult),
  });
}
