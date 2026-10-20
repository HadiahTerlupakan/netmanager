import { logger } from "@/lib/logger";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { RouterOSAPI } from "node-routeros-v2";
import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { RadiusConnectionError } from "../utils/errors";
import {
  createCoreLookupBreaker,
  resolveFailedRouterStatus,
  type CoreLookupBreaker,
} from "./mikrotik-ping-check.vpn";

const DEFAULT_MIKROTIK_TIMEOUT_MS = 5000;

interface MikroTikPingResult {
  success: boolean;
  userOnline?: number;
}

type CheckedRouter = {
  id: string;
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
  connectionMode: string;
  vpnCoreRouterId: string | null;
};

async function testMikroTikAPI(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  timeout: number = DEFAULT_MIKROTIK_TIMEOUT_MS,
): Promise<MikroTikPingResult> {
  return new Promise((resolve) => {
    const conn = new RouterOSAPI({
      host: ipAddress,
      user: username,
      password: password,
      port: port,
      timeout: timeout,
    });

    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          conn.close();
        } catch (_e) {
          // Ignore cleanup errors
        }
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve({ success: false });
    }, timeout + 1000);

    conn
      .connect()
      .then(async () => {
        try {
          const pppActive = await conn.write("/ppp/active/print");
          const userOnline = Array.isArray(pppActive) ? pppActive.length : 0;

          cleanup();
          clearTimeout(timer);
          resolve({ success: true, userOnline });
        } catch (_error: unknown) {
          cleanup();
          clearTimeout(timer);
          resolve({ success: true, userOnline: 0 });
        }
      })
      .catch(() => {
        cleanup();
        clearTimeout(timer);
        resolve({ success: false });
      });
  });
}

export async function checkAllMikroTikRouterStatus(): Promise<number> {
  const routerRepository = new MikroTikRouterRepository();
  const networkRepository = new NetworkRepository();
  const tenants = await runAsSystemContext(
    "checkAllMikroTikRouterStatus: discover active tenants",
    () => networkRepository.findActiveTenants(),
  );

  let totalUpdatedCount = 0;
  const breaker = createCoreLookupBreaker();

  for (const tenant of tenants) {
    totalUpdatedCount += await runWithRequestTenantContext(
      { tenantId: tenant.id, isSuperAdmin: false },
      () => checkTenantRouters(routerRepository, tenant.id, breaker),
    );
  }

  return totalUpdatedCount;
}

async function checkTenantRouters(
  routerRepository: MikroTikRouterRepository,
  tenantId: string,
  breaker: CoreLookupBreaker,
): Promise<number> {
  try {
    const routers = await routerRepository.findAll(tenantId);
    const results = await Promise.all(
      routers.map((router) =>
        checkAndPersistRouter(routerRepository, router, tenantId, breaker),
      ),
    );

    return results.length;
  } catch (error) {
    logger.error(`Error checking routers for tenant ${tenantId}:`, error);
    return 0;
  }
}

async function checkAndPersistRouter(
  routerRepository: MikroTikRouterRepository,
  router: CheckedRouter,
  tenantId: string,
  breaker: CoreLookupBreaker,
) {
  try {
    const apiResult = await testMikroTikAPI(
      router.ipAddress,
      router.apiPort,
      router.apiUsernameGenerated || router.apiUsername,
      router.apiPasswordGenerated || router.apiPassword,
    );

    await updateRouterHealth(
      routerRepository,
      router.id,
      tenantId,
      apiResult,
      await resolvePingStatus(router, apiResult, breaker),
    );
    return {
      id: router.id,
      success: apiResult.success,
      userOnline: apiResult.userOnline ?? 0,
    };
  } catch (error) {
    logger.error(`Error checking router ${router.id}:`, error);
    await markRouterOffline(routerRepository, router.id, tenantId);
    return { id: router.id, success: false, userOnline: 0 };
  }
}

async function resolvePingStatus(
  router: CheckedRouter,
  apiResult: MikroTikPingResult,
  breaker: CoreLookupBreaker,
): Promise<string> {
  if (apiResult.success) return "online";
  return resolveFailedRouterStatus(router, breaker);
}

async function updateRouterHealth(
  routerRepository: MikroTikRouterRepository,
  routerId: string,
  tenantId: string,
  apiResult: MikroTikPingResult,
  pingStatus: string,
) {
  await routerRepository.update(
    routerId,
    {
      pingStatus,
      userOnline: apiResult.userOnline ?? 0,
      lastStatusCheck: new Date(),
    },
    tenantId,
  );
}

async function markRouterOffline(
  routerRepository: MikroTikRouterRepository,
  routerId: string,
  tenantId: string,
) {
  try {
    await updateRouterHealth(
      routerRepository,
      routerId,
      tenantId,
      { success: false, userOnline: 0 },
      "offline",
    );
  } catch (error) {
    logger.error(`Error updating router ${routerId}:`, error);
  }
}

async function getRouterForStatusCheck(id: string) {
  const routerRepository = new MikroTikRouterRepository();
  const networkRepository = new NetworkRepository();
  const routerTenant = await networkRepository.findRouterTenantId(id);

  if (!routerTenant?.tenantId) {
    return null;
  }

  const router = await routerRepository.findById(id, routerTenant.tenantId);
  if (!router) {
    return null;
  }

  return { routerRepository, tenantId: routerTenant.tenantId, router };
}

function createRadiusConnectionError(id: string, error: unknown) {
  logger.error(`Error checking single router ${id}:`, error);
  return new RadiusConnectionError(
    "Gagal terhubung ke router: " +
      (error instanceof Error ? error.message : String(error)),
  );
}

function getRouterApiCredentials(router: {
  apiUsername: string;
  apiPassword: string;
  apiUsernameGenerated: string | null;
  apiPasswordGenerated: string | null;
}) {
  return {
    username: router.apiUsernameGenerated || router.apiUsername,
    password: router.apiPasswordGenerated || router.apiPassword,
  };
}

async function getRouterStatusCheckResult(
  router: Awaited<ReturnType<typeof getRouterForStatusCheck>> extends {
    router: infer T;
  }
    ? T
    : never,
) {
  const credentials = getRouterApiCredentials(router);
  return testMikroTikAPI(
    router.ipAddress,
    router.apiPort,
    credentials.username,
    credentials.password,
  );
}

async function runRouterStatusCheck(
  statusCheck: Awaited<ReturnType<typeof getRouterForStatusCheck>>,
) {
  if (!statusCheck) {
    return false;
  }

  const apiResult = await getRouterStatusCheckResult(statusCheck.router);
  await updateRouterHealth(
    statusCheck.routerRepository,
    statusCheck.router.id,
    statusCheck.tenantId,
    apiResult,
    await resolvePingStatus(
      statusCheck.router,
      apiResult,
      createCoreLookupBreaker(),
    ),
  );
  return apiResult.success;
}

async function runSingleRouterStatusCheck(id: string): Promise<boolean> {
  return runRouterStatusCheck(await getRouterForStatusCheck(id));
}

/** Perbarui status koneksi satu router MikroTik. */
export async function checkSingleMikroTikRouterStatus(
  id: string,
): Promise<boolean> {
  try {
    return await runSingleRouterStatusCheck(id);
  } catch (error: unknown) {
    throw createRadiusConnectionError(id, error);
  }
}
