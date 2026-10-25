import { logger } from "@/lib/logger";
import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type { MikroTikRouterCreateData } from "../domain/entities/MikroTikRouterEntity";
import type { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import { checkSingleMikroTikRouterStatus } from "./mikrotik-ping-check";
import { getVpnCoreAddress } from "../vpn/VpnCoreClient";
import { vpnMigrationRouterOs } from "./mikrotik-vpn-migration.routeros";
import {
  buildIsolirPageSync,
  recordIsolirPageSync,
  tryResolveIsolirProvisioning,
  type IsolirProvisioning,
} from "../isolir/isolir-provisioning";

type ProvisioningConnection = {
  ip: string;
  port: number;
  username: string;
  password: string;
};

type StoredRouterCredentials = {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
};

type RadiusConfig = {
  secretRadius: string;
  authPort: number;
  accountingPort: number;
};

type AutoConfigureCreatedRouterParams = {
  enabled: boolean;
  routerId: string;
  createData: MikroTikRouterCreateData;
  radiusConfig: RadiusConfig;
  networkRepository: Pick<
    IRouterAccessRepository,
    "updateGeneratedApiUser" | "updateIsolirPageSync"
  >;
  provisioningService: Pick<
    MikroTikProvisioningService,
    "provisionRadius" | "createApiUser"
  >;
};

type DeprovisionRouterParams = {
  provisioningService: Pick<MikroTikProvisioningService, "deprovisionRadius">;
  router: StoredRouterCredentials & { connectionMode?: string | null };
};

// Data create belum membawa mode isolir, jadi router baru tersimpan dengan
// default kolom isolirMode dan provisioning harus mengikutinya.
const NEW_ROUTER_ISOLIR_MODE = "ROUTER_PAGE";

type GeneratedApiUserResult = {
  success: boolean;
  username?: string;
  password?: string;
  logs: string[];
};

function createProvisioningConnection(params: {
  ipAddress: string;
  apiPort?: number;
  apiUsername: string;
  apiPassword: string;
}): ProvisioningConnection {
  return {
    ip: params.ipAddress,
    port: params.apiPort ?? 8728,
    username: params.apiUsername,
    password: params.apiPassword,
  };
}

function createRouterProvisioningConnection(
  createData: MikroTikRouterCreateData,
): ProvisioningConnection {
  return createProvisioningConnection({
    ipAddress: createData.ipAddress,
    apiPort: createData.apiPort,
    apiUsername: createData.apiUsername,
    apiPassword: createData.apiPassword,
  });
}

function createStoredRouterProvisioningConnection(
  router: StoredRouterCredentials,
): ProvisioningConnection {
  return createProvisioningConnection({
    ipAddress: router.ipAddress,
    apiPort: router.apiPort,
    apiUsername: router.apiUsername,
    apiPassword: router.apiPassword,
  });
}

function hasGeneratedApiCredentials(
  result: GeneratedApiUserResult,
): result is GeneratedApiUserResult & {
  success: true;
  username: string;
  password: string;
} {
  return Boolean(result.success && result.username && result.password);
}

function warnProvisioningFailure(logs: string[]): void {
  logger.warn(`Router created but provisioning failed: ${logs.join(", ")}`);
}

function warnApiUserCreationFailure(logs: string[]): void {
  logger.warn(`API User creation failed: ${logs.join(", ")}`);
}

function logProvisioningError(error: unknown): void {
  logger.error("Provisioning CRITICAL error:", error);
}

function logInitialRouterCheckError(error: unknown): void {
  logger.error("Failed to perform initial router check:", error);
}

function logDeprovisionError(error: unknown): void {
  logger.error("Failed to auto-deprovision:", error);
}

type RadiusRouting = {
  radiusServerIp: string | null;
  srcAddress: string | null;
};

type ProvisionRadiusArgs = Parameters<
  MikroTikProvisioningService["provisionRadius"]
>;

function isVpnRouter(router: { connectionMode?: string | null }): boolean {
  return router.connectionMode === "VPN";
}

/**
 * Alamat server RADIUS dan src-address untuk sebuah router. Router VPN
 * menjangkau RADIUS lewat core di overlay, dari IP tunnel-nya; router publik
 * memakai `null` sehingga provisioning mendeteksi IP publik server.
 */
export function resolveRadiusRouting(router: {
  connectionMode?: string | null;
  ipAddress: string;
}): RadiusRouting {
  if (!isVpnRouter(router)) {
    return { radiusServerIp: null, srcAddress: null };
  }
  return { radiusServerIp: getVpnCoreAddress(), srcAddress: router.ipAddress };
}

function createRadiusProvisioningArgs(params: {
  connection: ProvisioningConnection;
  radiusConfig: RadiusConfig;
  createData: MikroTikRouterCreateData;
  isolir: IsolirProvisioning | null;
}): ProvisionRadiusArgs {
  const { radiusServerIp, srcAddress } = resolveRadiusRouting(
    params.createData,
  );
  const args = [
    params.connection,
    radiusServerIp,
    params.radiusConfig.secretRadius,
    params.isolir,
    params.radiusConfig.authPort,
    params.radiusConfig.accountingPort,
  ] as const;
  return srcAddress ? [...args, srcAddress] : [...args];
}

function saveGeneratedApiCredentials(
  params: AutoConfigureCreatedRouterParams,
  username: string,
  password: string,
): Promise<void> {
  return params.networkRepository.updateGeneratedApiUser(params.routerId, {
    apiUsernameGenerated: username,
    apiPasswordGenerated: password,
  });
}

async function provisionRouterRadius(
  params: AutoConfigureCreatedRouterParams,
  connection: ProvisioningConnection,
): Promise<boolean> {
  const resolution = await tryResolveIsolirProvisioning({
    isolirMode: NEW_ROUTER_ISOLIR_MODE,
    isolirUrl: params.createData.isolirUrl ?? null,
    tenantId: params.createData.tenantId,
  });
  const provisioningResult = await params.provisioningService.provisionRadius(
    ...createRadiusProvisioningArgs({
      connection,
      radiusConfig: params.radiusConfig,
      createData: params.createData,
      isolir: resolution.isolir,
    }),
  );
  await recordIsolirPageSync(
    params.networkRepository,
    params.routerId,
    buildIsolirPageSync(resolution, provisioningResult),
  );

  if (!provisioningResult.success) {
    warnProvisioningFailure(provisioningResult.logs);
  }
  return provisioningResult.success;
}

// Router yang dulu dipakai netmanager publik masih menyimpan entri /radius ke
// alamat publik. RouterOS tidak mencoba server berikutnya setelah
// Access-Reject, jadi entri lama itu harus hilang setelah entri tunnel ada.
async function removeStaleRadiusEntries(
  connection: ProvisioningConnection,
): Promise<void> {
  try {
    await vpnMigrationRouterOs.removeOtherRadiusEntries(
      connection,
      getVpnCoreAddress(),
    );
  } catch (error: unknown) {
    logger.warn("Gagal menghapus entri RADIUS lama router VPN:", error);
  }
}

async function persistGeneratedApiUser(
  params: AutoConfigureCreatedRouterParams,
  connection: ProvisioningConnection,
): Promise<void> {
  const apiUserResult =
    await params.provisioningService.createApiUser(connection);

  if (!hasGeneratedApiCredentials(apiUserResult)) {
    warnApiUserCreationFailure(apiUserResult.logs);
    return;
  }

  await saveGeneratedApiCredentials(
    params,
    apiUserResult.username,
    apiUserResult.password,
  );
}

/**
 * Jalankan provisioning awal router dan simpan kredensial API generated bila
 * berhasil. Router VPN tidak dibuatkan user API: kredensialnya sudah dibuat
 * oleh script VPN yang ditempel pengguna; setelah entri /radius tunnel
 * terpasang, entri netmanager lain (sisa mode publik) dihapus.
 */
export async function autoConfigureCreatedRouter(
  params: AutoConfigureCreatedRouterParams,
): Promise<void> {
  if (!params.enabled) {
    return;
  }

  try {
    const connection = createRouterProvisioningConnection(params.createData);
    const isProvisioned = await provisionRouterRadius(params, connection);
    if (!isVpnRouter(params.createData)) {
      await persistGeneratedApiUser(params, connection);
    } else if (isProvisioned) {
      await removeStaleRadiusEntries(connection);
    }
  } catch (error: unknown) {
    logProvisioningError(error);
  }
}

/** Jalankan pengecekan online/offline awal setelah router berhasil dibuat. */
export async function runInitialRouterCheck(routerId: string): Promise<void> {
  try {
    await checkSingleMikroTikRouterStatus(routerId);
  } catch (error: unknown) {
    logInitialRouterCheckError(error);
  }
}

function warnDeprovisionFailure(logs: string[]): void {
  logger.warn(`Deprovisioning failed: ${logs.join(", ")}`);
}

/** Hapus konfigurasi provisioning NetManager dari router bila masih bisa diakses. */
export async function deprovisionRouter(
  params: DeprovisionRouterParams,
): Promise<void> {
  try {
    const result = await params.provisioningService.deprovisionRadius(
      createStoredRouterProvisioningConnection(params.router),
      resolveRadiusRouting(params.router).radiusServerIp,
    );

    if (!result.success) {
      warnDeprovisionFailure(result.logs);
    }
  } catch (error: unknown) {
    logDeprovisionError(error);
  }
}
