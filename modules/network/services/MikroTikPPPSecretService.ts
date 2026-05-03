import { logger } from "@/lib/logger";
/**
 * MikroTik PPP Secret Service
 *
 * Mengelola PPP Secret di MikroTik Router untuk pelanggan PPP.
 * Digunakan dalam mode API MikroTik (bukan RADIUS).
 */

import type {
  PelangganWithRouter,
  RouterTenantId,
} from "../repositories/NetworkRepository";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";
import {
  MikroTikConnectionFactory,
  type RouterConfig,
} from "./mikrotik/MikroTikConnectionFactory";
import type {
  PPPActiveSessionRecord,
  SessionUsageData,
} from "./mikrotik/ppp-session-usage";
import { MikroTikSessionService } from "./mikrotik/MikroTikSessionService";
import { MikroTikRouterContextService } from "./mikrotik/MikroTikRouterContextService";
import type { PPPSecretData } from "./mikrotik/ppp-secret.types";

interface MikroTikPPPSecretNetworkRepository {
  findRouterTenantId(routerId: string): Promise<RouterTenantId | null>;
  findPelangganWithRouter(
    pelangganId: string,
  ): Promise<PelangganWithRouter | null>;
}

type MikroTikPPPSecretDependencies = {
  networkRepository: MikroTikPPPSecretNetworkRepository;
  routerRepository: IMikroTikRouterRepository;
  connectionFactory?: MikroTikConnectionFactory;
  sessionService?: MikroTikSessionService;
  routerContextService?: MikroTikRouterContextService;
};

const EXPIRED_PROFILE = "expired users";

export class MikroTikPPPSecretService {
  private readonly networkRepository: MikroTikPPPSecretNetworkRepository;
  private readonly routerRepository: IMikroTikRouterRepository;
  private readonly connectionFactory: MikroTikConnectionFactory;
  private readonly sessionService: MikroTikSessionService;
  private readonly routerContextService: MikroTikRouterContextService;

  constructor(deps?: MikroTikPPPSecretDependencies) {
    if (!deps) {
      throw new Error("MikroTik PPP Secret dependencies wajib disediakan");
    }

    this.networkRepository = deps.networkRepository;
    this.routerRepository = deps.routerRepository;
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

  private async connectToRouter(config: RouterConfig) {
    return this.connectionFactory.connect(config);
  }

  /**
   * Buat PPP Secret di MikroTik
   */
  async createSecret(
    routerId: string,
    data: PPPSecretData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const router = await this.routerContextService.findRouter(routerId);

      if (!router) {
        return { success: false, error: "Router tidak ditemukan" };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        const existing = (await conn.write("/ppp/secret/print", [
          `?name=${data.name}`,
        ])) as Array<Record<string, string>>;

        if (existing && existing.length > 0) {
          const secret = existing[0];
          if (secret) {
            await conn.write("/ppp/secret/set", [
              `=.id=${secret[".id"]}`,
              `=password=${data.password}`,
              `=profile=${data.profile}`,
              `=comment=${data.comment || "added by netmanager"}`,
            ]);
          }
        } else {
          await conn.write("/ppp/secret/add", [
            `=name=${data.name}`,
            `=password=${data.password}`,
            `=profile=${data.profile}`,
            `=service=${data.service || "pppoe"}`,
            `=comment=${data.comment || "added by netmanager"}`,
          ]);
        }

        conn.close();
        return { success: true };
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      logger.error("[PPPSecretService] createSecret error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update PPP Secret profile
   */
  async setSecretProfile(
    routerId: string,
    username: string,
    profileName: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const router = await this.routerContextService.findRouter(routerId);

      if (!router) {
        return { success: false, error: "Router tidak ditemukan" };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        const secrets = (await conn.write("/ppp/secret/print", [
          `?name=${username}`,
        ])) as Array<Record<string, string>>;

        if (!secrets || secrets.length === 0 || !secrets[0]) {
          conn.close();
          return { success: false, error: "PPP Secret tidak ditemukan" };
        }

        await conn.write("/ppp/secret/set", [
          `=.id=${secrets[0][".id"]}`,
          `=profile=${profileName}`,
        ]);

        conn.close();
        return { success: true };
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      logger.error("[PPPSecretService] setSecretProfile error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Disconnect active PPPoE session
   */
  async disconnectSession(
    routerId: string,
    username: string,
  ): Promise<{ success: boolean; disconnected: number; error?: string }> {
    try {
      const router = await this.routerContextService.findRouter(routerId);

      if (!router) {
        return {
          success: false,
          disconnected: 0,
          error: "Router tidak ditemukan",
        };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        const disconnected = await this.sessionService.disconnectSession(
          conn,
          username,
        );
        conn.close();
        return { success: true, disconnected };
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      logger.error("[PPPSecretService] disconnectSession error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, disconnected: 0, error: errorMessage };
    }
  }

  /**
   * Get active PPPoE session usage by username
   */
  async getActiveSessionUsage(
    routerId: string,
    username: string,
  ): Promise<{ success: boolean; usage?: SessionUsageData; error?: string }> {
    const debug = await this.debugActiveSessionUsage(routerId, username);
    if (!debug.success || !debug.finalUsage) {
      return { success: false, ...(debug.error ? { error: debug.error } : {}) };
    }

    return { success: true, usage: debug.finalUsage };
  }

  async debugActiveSessionUsage(
    routerId: string,
    username: string,
  ): Promise<{
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
  }> {
    try {
      const router = await this.routerContextService.findRouter(routerId);

      if (!router) {
        return { success: false, error: "Router tidak ditemukan" };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        const result = await this.sessionService.debugActiveSessionUsage(
          conn,
          username,
          router.ipAddress,
        );
        conn.close();
        return result;
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      logger.error("[PPPSecretService] debugActiveSessionUsage error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Hapus PPP Secret dari MikroTik
   */
  async deleteSecret(
    routerId: string,
    username: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const router = await this.routerContextService.findRouter(routerId);

      if (!router) {
        return { success: false, error: "Router tidak ditemukan" };
      }

      const conn = await this.connectToRouter({
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsernameGenerated || router.apiUsername,
        apiPassword: router.apiPasswordGenerated || router.apiPassword,
      });

      try {
        const secrets = (await conn.write("/ppp/secret/print", [
          `?name=${username}`,
        ])) as Array<Record<string, string>>;

        for (const secret of secrets || []) {
          if (secret[".id"]) {
            await conn.write("/ppp/secret/remove", [`=.id=${secret[".id"]}`]);
          }
        }

        const activeSessions = (await conn.write("/ppp/active/print", [
          `?name=${username}`,
        ])) as Array<Record<string, string>>;

        for (const session of activeSessions || []) {
          if (session[".id"]) {
            await conn.write("/ppp/active/remove", [`=.id=${session[".id"]}`]);
          }
        }

        conn.close();
        return { success: true };
      } catch (error: unknown) {
        conn.close();
        throw error;
      }
    } catch (error: unknown) {
      logger.error("[PPPSecretService] deleteSecret error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Isolasi pelanggan: Ubah profile ke "expired users" + disconnect
   */
  async isolateCustomer(
    pelangganId: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    try {
      const data =
        await this.routerContextService.getRouterFromPelanggan(pelangganId);
      if (!data) {
        return {
          success: false,
          logs,
          error: "Pelanggan atau router tidak ditemukan",
        };
      }

      const { router, routerId, pelanggan } = data;
      logs.push(`Connecting to router ${router.ipAddress}`);

      const profileResult = await this.setSecretProfile(
        routerId,
        pelanggan.username,
        EXPIRED_PROFILE,
      );

      if (!profileResult.success) {
        if (profileResult.error === "PPP Secret tidak ditemukan") {
          logs.push(
            "Warning: PPP Secret tidak ditemukan, melanjutkan disconnect session...",
          );
        } else {
          return {
            success: false,
            logs,
            ...(profileResult.error ? { error: profileResult.error } : {}),
          };
        }
      } else {
        logs.push(`Profile diubah ke "${EXPIRED_PROFILE}"`);
      }

      const disconnectResult = await this.disconnectSession(
        routerId,
        pelanggan.username,
      );
      logs.push(`Disconnected ${disconnectResult.disconnected} session(s)`);

      return { success: true, logs };
    } catch (error: unknown) {
      logger.error("[PPPSecretService] isolateCustomer error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, logs, error: errorMessage };
    }
  }

  /**
   * Un-isolasi pelanggan: Kembalikan profile normal + disconnect
   */
  async unIsolateCustomer(
    pelangganId: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    try {
      const data =
        await this.routerContextService.getRouterFromPelanggan(pelangganId);
      if (!data) {
        return {
          success: false,
          logs,
          error: "Pelanggan atau router tidak ditemukan",
        };
      }

      const { router, routerId, pelanggan, profileName } = data;
      logs.push(`Connecting to router ${router.ipAddress}`);

      const profileResult = await this.setSecretProfile(
        routerId,
        pelanggan.username,
        profileName,
      );

      if (!profileResult.success) {
        if (profileResult.error === "PPP Secret tidak ditemukan") {
          logs.push(
            "Warning: PPP Secret tidak ditemukan, melanjutkan disconnect session...",
          );
        } else {
          return {
            success: false,
            logs,
            ...(profileResult.error ? { error: profileResult.error } : {}),
          };
        }
      } else {
        logs.push(`Profile dikembalikan ke "${profileName}"`);
      }

      const disconnectResult = await this.disconnectSession(
        routerId,
        pelanggan.username,
      );
      logs.push(`Disconnected ${disconnectResult.disconnected} session(s)`);

      return { success: true, logs };
    } catch (error: unknown) {
      logger.error("[PPPSecretService] unIsolateCustomer error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, logs, error: errorMessage };
    }
  }

  /**
   * Dismantle pelanggan: Hapus secret sepenuhnya
   */
  async dismantleCustomer(
    pelangganId: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    try {
      const data =
        await this.routerContextService.getRouterFromPelanggan(pelangganId);
      if (!data) {
        return {
          success: false,
          logs,
          error: "Pelanggan atau router tidak ditemukan",
        };
      }

      const { routerId, pelanggan } = data;
      logs.push(`Menghapus secret untuk ${pelanggan.username}`);

      const result = await this.deleteSecret(routerId, pelanggan.username);

      if (!result.success) {
        return { success: false, logs, error: result.error };
      }
      logs.push("PPP Secret berhasil dihapus");

      return { success: true, logs };
    } catch (error: unknown) {
      logger.error("[PPPSecretService] dismantleCustomer error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, logs, error: errorMessage };
    }
  }

  /**
   * Sync PPP Secret saat pelanggan didaftarkan
   */
  async syncNewCustomer(
    pelangganId: string,
  ): Promise<{ success: boolean; logs: string[]; error?: string }> {
    const logs: string[] = [];

    try {
      const data =
        await this.routerContextService.getRouterFromPelanggan(pelangganId);
      if (!data) {
        return {
          success: false,
          logs,
          error: "Pelanggan atau router tidak ditemukan",
        };
      }

      const { routerId, pelanggan, profileName } = data;
      logs.push(`Creating PPP Secret untuk ${pelanggan.username}`);

      const result = await this.createSecret(routerId, {
        name: pelanggan.username,
        password: pelanggan.password,
        profile: profileName,
        service: "pppoe",
        comment: `customer: ${pelanggan.nama}`,
      });

      if (!result.success) {
        return { success: false, logs, error: result.error };
      }
      logs.push("PPP Secret berhasil dibuat");

      return { success: true, logs };
    } catch (error: unknown) {
      logger.error("[PPPSecretService] syncNewCustomer error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return { success: false, logs, error: errorMessage };
    }
  }
}

export default MikroTikPPPSecretService;
