import { logger } from "@/lib/logger";

import type { MikroTikRouterContextService } from "./mikrotik/MikroTikRouterContextService";
import {
  buildErrorMessage,
  buildSecretCreatePayload,
  type MikroTikLifecycleResult,
} from "./mikrotik-ppp-secret.helpers";

type MikroTikLifecycleDependencies = {
  routerContextService: MikroTikRouterContextService;
  createSecret(
    routerId: string,
    data: ReturnType<typeof buildSecretCreatePayload>,
  ): Promise<{ success: boolean; error?: string }>;
  setSecretProfile(
    routerId: string,
    username: string,
    profileName: string,
  ): Promise<{ success: boolean; error?: string }>;
  disconnectSession(
    routerId: string,
    username: string,
  ): Promise<{ success: boolean; disconnected: number; error?: string }>;
  deleteSecret(
    routerId: string,
    username: string,
  ): Promise<{ success: boolean; error?: string }>;
  expiredProfile: string;
};

function createMissingRouterResult(): MikroTikLifecycleResult {
  return {
    success: false,
    logs: [],
    error: "Pelanggan atau router tidak ditemukan",
  };
}

function buildProfileFailureResult(
  logs: string[],
  error?: string,
): MikroTikLifecycleResult {
  return {
    success: false,
    logs,
    ...(error ? { error } : {}),
  };
}

async function resolveRouterData(
  routerContextService: MikroTikRouterContextService,
  pelangganId: string,
) {
  return routerContextService.getRouterFromPelanggan(pelangganId);
}

export async function isolateCustomerOnRouter(
  pelangganId: string,
  deps: MikroTikLifecycleDependencies,
): Promise<MikroTikLifecycleResult> {
  const logs: string[] = [];

  try {
    const data = await resolveRouterData(
      deps.routerContextService,
      pelangganId,
    );
    if (!data) {
      return createMissingRouterResult();
    }

    const { router, routerId, pelanggan } = data;
    logs.push(`Connecting to router ${router.ipAddress}`);

    const profileResult = await deps.setSecretProfile(
      routerId,
      pelanggan.username,
      deps.expiredProfile,
    );
    // Jika PPP Secret tidak ditemukan, kembalikan failure agar BullMQ retry
    // dan masuk dead letter queue untuk intervensi manual admin
    if (!profileResult.success) {
      return buildProfileFailureResult(logs, profileResult.error);
    }
    logs.push(`Profile diubah ke "${deps.expiredProfile}"`);

    const disconnectResult = await deps.disconnectSession(
      routerId,
      pelanggan.username,
    );
    logs.push(`Disconnected ${disconnectResult.disconnected} session(s)`);
    return { success: true, logs };
  } catch (error: unknown) {
    logger.error("[PPPSecretService] isolateCustomer error:", error);
    return { success: false, logs, error: buildErrorMessage(error) };
  }
}

export async function unIsolateCustomerOnRouter(
  pelangganId: string,
  deps: MikroTikLifecycleDependencies,
): Promise<MikroTikLifecycleResult> {
  const logs: string[] = [];

  try {
    const data = await resolveRouterData(
      deps.routerContextService,
      pelangganId,
    );
    if (!data) {
      return createMissingRouterResult();
    }

    const { router, routerId, pelanggan, profileName } = data;
    logs.push(`Connecting to router ${router.ipAddress}`);

    const profileResult = await deps.setSecretProfile(
      routerId,
      pelanggan.username,
      profileName,
    );
    // Jika PPP Secret tidak ditemukan, kembalikan failure agar BullMQ retry
    // dan masuk dead letter queue untuk intervensi manual admin
    if (!profileResult.success) {
      return buildProfileFailureResult(logs, profileResult.error);
    }
    logs.push(`Profile dikembalikan ke "${profileName}"`);

    const disconnectResult = await deps.disconnectSession(
      routerId,
      pelanggan.username,
    );
    logs.push(`Disconnected ${disconnectResult.disconnected} session(s)`);
    return { success: true, logs };
  } catch (error: unknown) {
    logger.error("[PPPSecretService] unIsolateCustomer error:", error);
    return { success: false, logs, error: buildErrorMessage(error) };
  }
}

export async function dismantleCustomerOnRouter(
  pelangganId: string,
  deps: MikroTikLifecycleDependencies,
): Promise<MikroTikLifecycleResult> {
  const logs: string[] = [];

  try {
    const data = await resolveRouterData(
      deps.routerContextService,
      pelangganId,
    );
    if (!data) {
      return createMissingRouterResult();
    }

    const { routerId, pelanggan } = data;
    logs.push(`Menghapus secret untuk ${pelanggan.username}`);

    const result = await deps.deleteSecret(routerId, pelanggan.username);
    if (!result.success) {
      return { success: false, logs, error: result.error };
    }

    logs.push("PPP Secret berhasil dihapus");
    return { success: true, logs };
  } catch (error: unknown) {
    logger.error("[PPPSecretService] dismantleCustomer error:", error);
    return { success: false, logs, error: buildErrorMessage(error) };
  }
}

export async function syncCustomerSecretOnRouter(
  pelangganId: string,
  deps: MikroTikLifecycleDependencies,
): Promise<MikroTikLifecycleResult> {
  const logs: string[] = [];

  try {
    const data = await resolveRouterData(
      deps.routerContextService,
      pelangganId,
    );
    if (!data) {
      return createMissingRouterResult();
    }

    const { routerId, pelanggan, profileName } = data;
    logs.push(`Creating PPP Secret untuk ${pelanggan.username}`);

    const result = await deps.createSecret(
      routerId,
      buildSecretCreatePayload(
        pelanggan.username,
        pelanggan.password,
        profileName,
        pelanggan.nama,
      ),
    );
    if (!result.success) {
      return { success: false, logs, error: result.error };
    }

    logs.push("PPP Secret berhasil dibuat");
    return { success: true, logs };
  } catch (error: unknown) {
    logger.error("[PPPSecretService] syncNewCustomer error:", error);
    return { success: false, logs, error: buildErrorMessage(error) };
  }
}
