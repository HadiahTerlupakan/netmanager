import type { MikroTikRouterEntity } from "../domain/entities/MikroTikRouterEntity";
import type { PPPSecretData } from "./mikrotik/ppp-secret.types";

export type MikroTikOperationResult = {
  success: boolean;
  error?: string;
};

export type MikroTikDisconnectResult = MikroTikOperationResult & {
  disconnected: number;
};

export type MikroTikLifecycleResult = MikroTikOperationResult & {
  logs: string[];
};

export function getRouterConnectionInput(router: MikroTikRouterEntity) {
  return {
    ipAddress: router.ipAddress,
    apiPort: router.apiPort,
    apiUsername: router.apiUsernameGenerated || router.apiUsername,
    apiPassword: router.apiPasswordGenerated || router.apiPassword,
  };
}

export function buildSecretCreatePayload(
  username: string,
  password: string,
  profile: string,
  nama: string,
): PPPSecretData {
  return {
    name: username,
    password,
    profile,
    service: "pppoe",
    comment: `customer: ${nama}`,
  };
}

export function buildErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createFailureResult(error: string): MikroTikOperationResult {
  return { success: false, error };
}
