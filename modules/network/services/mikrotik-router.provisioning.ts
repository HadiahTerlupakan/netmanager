import { logger } from "@/lib/logger";
import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type { MikroTikRouterCreateData } from "../domain/entities/MikroTikRouterEntity";
import type { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import { checkSingleMikroTikRouterStatus } from "./mikrotik-ping-check";

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
  networkRepository: Pick<IRouterAccessRepository, "updateGeneratedApiUser">;
  provisioningService: Pick<
    MikroTikProvisioningService,
    "provisionRadius" | "createApiUser"
  >;
};

type DeprovisionRouterParams = {
  provisioningService: Pick<MikroTikProvisioningService, "deprovisionRadius">;
  router: StoredRouterCredentials & {
    isolirUrl: string | null;
  };
};

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

function createRadiusProvisioningArgs(params: {
  connection: ProvisioningConnection;
  radiusConfig: RadiusConfig;
  isolirUrl: string | null;
}): readonly [
  ProvisioningConnection,
  null,
  string,
  string | null,
  number,
  number,
] {
  return [
    params.connection,
    null,
    params.radiusConfig.secretRadius,
    params.isolirUrl,
    params.radiusConfig.authPort,
    params.radiusConfig.accountingPort,
  ];
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
): Promise<void> {
  const provisioningResult = await params.provisioningService.provisionRadius(
    ...createRadiusProvisioningArgs({
      connection,
      radiusConfig: params.radiusConfig,
      isolirUrl: params.createData.isolirUrl,
    }),
  );

  if (!provisioningResult.success) {
    warnProvisioningFailure(provisioningResult.logs);
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

/** Jalankan provisioning awal router dan simpan kredensial API generated bila berhasil. */
export async function autoConfigureCreatedRouter(
  params: AutoConfigureCreatedRouterParams,
): Promise<void> {
  if (!params.enabled) {
    return;
  }

  try {
    const connection = createRouterProvisioningConnection(params.createData);
    await provisionRouterRadius(params, connection);
    await persistGeneratedApiUser(params, connection);
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
      null,
      params.router.isolirUrl,
    );

    if (!result.success) {
      warnDeprovisionFailure(result.logs);
    }
  } catch (error: unknown) {
    logDeprovisionError(error);
  }
}
