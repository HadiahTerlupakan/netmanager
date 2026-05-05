/**
 * MikroTik PPP Secret Service
 *
 * Mengelola PPP Secret di MikroTik Router untuk pelanggan PPP.
 * Digunakan dalam mode API MikroTik (bukan RADIUS).
 */

import { MikroTikConnectionFactory } from "./mikrotik/MikroTikConnectionFactory";
import { MikroTikSessionService } from "./mikrotik/MikroTikSessionService";
import { MikroTikRouterContextService } from "./mikrotik/MikroTikRouterContextService";
import { buildErrorMessage } from "./mikrotik-ppp-secret.helpers";
import {
  dismantleCustomerOnRouter,
  isolateCustomerOnRouter,
  syncCustomerSecretOnRouter,
  unIsolateCustomerOnRouter,
} from "./mikrotik-ppp-secret.lifecycle";
import { runRouterOperation } from "./mikrotik-ppp-secret.connection";
import {
  removeSecretAndSessions,
  updateSecretProfile,
  upsertSecret,
} from "./mikrotik-ppp-secret.operations";
import type { PPPSecretData } from "./mikrotik/ppp-secret.types";
import {
  createDeleteLogger,
  createDisconnectLogger,
  createDisconnectParams,
  createLifecycleResult,
  createMutationParams,
  createProfileLogger,
  createSecretLogger,
  createSessionError,
  createSessionUsageParams,
  createUsageLogger,
  toUsageResult,
  type MikroTikPPPSecretDependencies,
  type PPPSecretDisconnectResult,
  type PPPSecretMutationResult,
  type PPPSecretUsageDebugResult,
  type PPPSecretUsageResult,
} from "./mikrotik-ppp-secret.service-helpers";

export type {
  MikroTikPPPSecretDependencies,
  PPPSecretDisconnectResult,
  PPPSecretMutationResult,
  PPPSecretUsageDebugResult,
  PPPSecretUsageResult,
} from "./mikrotik-ppp-secret.service-helpers";

export class MikroTikPPPSecretService {
  private readonly connectionFactory: MikroTikConnectionFactory;
  private readonly sessionService: MikroTikSessionService;
  private readonly routerContextService: MikroTikRouterContextService;

  constructor(deps?: MikroTikPPPSecretDependencies) {
    if (!deps) {
      throw new Error("MikroTik PPP Secret dependencies wajib disediakan");
    }

    this.connectionFactory =
      deps.connectionFactory ?? new MikroTikConnectionFactory();
    this.sessionService = deps.sessionService ?? new MikroTikSessionService();
    this.routerContextService =
      deps.routerContextService ??
      new MikroTikRouterContextService({
        networkRepository: deps.networkRepository,
        routerRepository: deps.routerRepository,
      });
  }

  getConnectionFactory() {
    return this.connectionFactory;
  }

  getRouterContextService() {
    return this.routerContextService;
  }

  /**
   * Buat PPP Secret di MikroTik
   */
  async createSecret(
    routerId: string,
    data: PPPSecretData,
  ): Promise<PPPSecretMutationResult> {
    try {
      return await runRouterOperation({
        ...createMutationParams(this, routerId),
        operation: async ({ connection }) => upsertSecret(connection, data),
      });
    } catch (error: unknown) {
      createSecretLogger(error);
      return { success: false, error: buildErrorMessage(error) };
    }
  }

  /**
   * Update PPP Secret profile
   */
  async setSecretProfile(
    routerId: string,
    username: string,
    profileName: string,
  ): Promise<PPPSecretMutationResult> {
    try {
      return await runRouterOperation({
        ...createMutationParams(this, routerId),
        operation: async ({ connection }) =>
          updateSecretProfile(connection, username, profileName),
      });
    } catch (error: unknown) {
      createProfileLogger(error);
      return { success: false, error: buildErrorMessage(error) };
    }
  }

  /**
   * Disconnect active PPPoE session
   */
  async disconnectSession(
    routerId: string,
    username: string,
  ): Promise<PPPSecretDisconnectResult> {
    try {
      return await runRouterOperation<PPPSecretDisconnectResult>({
        ...createDisconnectParams(this, routerId),
        operation: async ({ connection }) => {
          const disconnected = await this.sessionService.disconnectSession(
            connection,
            username,
          );
          return { success: true, disconnected };
        },
      });
    } catch (error: unknown) {
      createDisconnectLogger(error);
      return {
        success: false,
        disconnected: 0,
        error: createSessionError(error),
      };
    }
  }

  /**
   * Get active PPPoE session usage by username
   */
  async getActiveSessionUsage(
    routerId: string,
    username: string,
  ): Promise<PPPSecretUsageResult> {
    return toUsageResult(
      await this.debugActiveSessionUsage(routerId, username),
    );
  }

  /**
   * Ambil data debug penggunaan sesi aktif pelanggan.
   */
  async debugActiveSessionUsage(
    routerId: string,
    username: string,
  ): Promise<PPPSecretUsageDebugResult> {
    try {
      return await runRouterOperation<PPPSecretUsageDebugResult>({
        ...createSessionUsageParams(this, routerId),
        operation: async ({ router, connection }) =>
          this.sessionService.debugActiveSessionUsage(
            connection,
            username,
            router.ipAddress,
          ),
      });
    } catch (error: unknown) {
      createUsageLogger(error);
      return { success: false, error: buildErrorMessage(error) };
    }
  }

  /**
   * Hapus PPP Secret dari MikroTik
   */
  async deleteSecret(
    routerId: string,
    username: string,
  ): Promise<PPPSecretMutationResult> {
    try {
      return await runRouterOperation({
        ...createMutationParams(this, routerId),
        operation: async ({ connection }) =>
          removeSecretAndSessions(connection, username),
      });
    } catch (error: unknown) {
      createDeleteLogger(error);
      return { success: false, error: buildErrorMessage(error) };
    }
  }

  /**
   * Isolasi pelanggan: Ubah profile ke "expired users" + disconnect
   */
  async isolateCustomer(
    pelangganId: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    return createLifecycleResult(isolateCustomerOnRouter, this, pelangganId);
  }

  /**
   * Un-isolasi pelanggan: Kembalikan profile normal + disconnect
   */
  async unIsolateCustomer(
    pelangganId: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    return createLifecycleResult(unIsolateCustomerOnRouter, this, pelangganId);
  }

  /**
   * Dismantle pelanggan: Hapus secret sepenuhnya
   */
  async dismantleCustomer(
    pelangganId: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    return createLifecycleResult(dismantleCustomerOnRouter, this, pelangganId);
  }

  /**
   * Sync PPP Secret saat pelanggan didaftarkan
   */
  async syncNewCustomer(
    pelangganId: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    return createLifecycleResult(syncCustomerSecretOnRouter, this, pelangganId);
  }
}

export default MikroTikPPPSecretService;
