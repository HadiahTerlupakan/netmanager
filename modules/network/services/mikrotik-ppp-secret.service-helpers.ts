import { logger } from "@/lib/logger";
import type {
  PelangganWithRouter,
  RouterTenantId,
} from "../repositories/NetworkRepository";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";
import type { MikroTikConnectionFactory } from "./mikrotik/MikroTikConnectionFactory";
import type {
  PPPActiveSessionRecord,
  SessionUsageData,
} from "./mikrotik/ppp-session-usage";
import type { PPPSecretData } from "./mikrotik/ppp-secret.types";
import type { MikroTikSessionService } from "./mikrotik/MikroTikSessionService";
import type { MikroTikRouterContextService } from "./mikrotik/MikroTikRouterContextService";

export const EXPIRED_PROFILE = "expired users";
export const ROUTER_NOT_FOUND_ERROR = "Router tidak ditemukan";

export type PPPSecretMutationResult = {
  success: boolean;
  error?: string;
};

export type PPPSecretDisconnectResult = {
  success: boolean;
  disconnected: number;
  error?: string;
};

export type PPPSecretUsageResult = {
  success: boolean;
  usage?: SessionUsageData;
  error?: string;
};

export type PPPSecretUsageDebugResult = {
  success: boolean;
  routerIpAddress?: string;
  activeSession?: PPPActiveSessionRecord | null;
  interfaceName?: string | null;
  interfacePrint?: PPPActiveSessionRecord | null;
  monitorTraffic?: PPPActiveSessionRecord | null;
  parsedFromActive?: SessionUsageData;
  parsedFromInterface?: SessionUsageData;
  parsedFromMonitor?: SessionUsageData;
  finalUsage?: SessionUsageData;
  interfaceDebug?: {
    rawInterfaceField: string | null;
    rawNameField: string | null;
    candidatesTried: string[];
  };
  monitorError?: string;
  error?: string;
};

export interface MikroTikPPPSecretNetworkRepository {
  findRouterTenantId(routerId: string): Promise<RouterTenantId | null>;
  findPelangganWithRouter(
    pelangganId: string,
  ): Promise<PelangganWithRouter | null>;
}

export type MikroTikPPPSecretDependencies = {
  networkRepository: MikroTikPPPSecretNetworkRepository;
  routerRepository: IMikroTikRouterRepository;
  connectionFactory?: MikroTikConnectionFactory;
  sessionService?: MikroTikSessionService;
  routerContextService?: MikroTikRouterContextService;
};

export type MikroTikPPPSecretServiceBindings = {
  getConnectionFactory(): MikroTikConnectionFactory;
  getRouterContextService(): MikroTikRouterContextService;
  createSecret(
    routerId: string,
    data: PPPSecretData,
  ): Promise<PPPSecretMutationResult>;
  setSecretProfile(
    routerId: string,
    username: string,
    profileName: string,
  ): Promise<PPPSecretMutationResult>;
  disconnectSession(
    routerId: string,
    username: string,
  ): Promise<PPPSecretDisconnectResult>;
  deleteSecret(
    routerId: string,
    username: string,
  ): Promise<PPPSecretMutationResult>;
};

type RouterOperationDependencies = {
  routerContextService: MikroTikRouterContextService;
  connectionFactory: MikroTikConnectionFactory;
};

function withBoundOperations(service: MikroTikPPPSecretServiceBindings) {
  return {
    createSecret: service.createSecret.bind(service),
    setSecretProfile: service.setSecretProfile.bind(service),
    disconnectSession: service.disconnectSession.bind(service),
    deleteSecret: service.deleteSecret.bind(service),
  };
}

function createRouterOperationDependencies(
  service: MikroTikPPPSecretServiceBindings,
): RouterOperationDependencies {
  return {
    routerContextService: service.getRouterContextService(),
    connectionFactory: service.getConnectionFactory(),
  };
}

function hasNoUsage(debug: PPPSecretUsageDebugResult) {
  return !debug.success || !debug.finalUsage;
}

export function createMutationParams(
  service: MikroTikPPPSecretServiceBindings,
  routerId: string,
) {
  return {
    routerId,
    ...createRouterOperationDependencies(service),
    onMissingRouter: createRouterNotFoundResult,
  };
}

export function createDisconnectParams(
  service: MikroTikPPPSecretServiceBindings,
  routerId: string,
) {
  return {
    routerId,
    ...createRouterOperationDependencies(service),
    onMissingRouter: createDisconnectRouterNotFoundResult,
  };
}

export function createSessionUsageParams(
  service: MikroTikPPPSecretServiceBindings,
  routerId: string,
) {
  return {
    routerId,
    ...createRouterOperationDependencies(service),
    onMissingRouter: createUsageRouterNotFoundResult,
  };
}

export function createLifecycleDependencies(
  service: MikroTikPPPSecretServiceBindings,
) {
  return {
    routerContextService: service.getRouterContextService(),
    ...withBoundOperations(service),
    expiredProfile: EXPIRED_PROFILE,
  };
}

export function createLifecycleResult(
  action: (
    pelangganId: string,
    deps: ReturnType<typeof createLifecycleDependencies>,
  ) => Promise<{ success: boolean; logs: string[]; error?: string }>,
  service: MikroTikPPPSecretServiceBindings,
  pelangganId: string,
) {
  return action(pelangganId, createLifecycleDependencies(service));
}

export function toUsageResult(debug: PPPSecretUsageDebugResult) {
  if (hasNoUsage(debug)) {
    return createMissingUsageResult(debug.error);
  }

  return { success: true, usage: debug.finalUsage };
}

export function createRouterNotFoundResult(): PPPSecretMutationResult {
  return { success: false, error: ROUTER_NOT_FOUND_ERROR };
}

export function createDisconnectRouterNotFoundResult(): PPPSecretDisconnectResult {
  return {
    success: false,
    disconnected: 0,
    error: ROUTER_NOT_FOUND_ERROR,
  };
}

export function createUsageRouterNotFoundResult(): PPPSecretUsageDebugResult {
  return { success: false, error: ROUTER_NOT_FOUND_ERROR };
}

export function createMissingUsageResult(error?: string): PPPSecretUsageResult {
  return { success: false, ...(error ? { error } : {}) };
}

export function createSessionError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createSecretLogger(error: unknown) {
  logger.error("[PPPSecretService] createSecret error:", error);
}

export function createProfileLogger(error: unknown) {
  logger.error("[PPPSecretService] setSecretProfile error:", error);
}

export function createDisconnectLogger(error: unknown) {
  logger.error("[PPPSecretService] disconnectSession error:", error);
}

export function createUsageLogger(error: unknown) {
  logger.error("[PPPSecretService] debugActiveSessionUsage error:", error);
}

export function createDeleteLogger(error: unknown) {
  logger.error("[PPPSecretService] deleteSecret error:", error);
}
