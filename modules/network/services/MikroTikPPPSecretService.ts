import { logger } from "@/lib/logger";
/**
 * MikroTik PPP Secret Service
 *
 * Mengelola PPP Secret di MikroTik Router untuk pelanggan PPP.
 * Digunakan dalam mode API MikroTik (bukan RADIUS).
 */

import { RouterOSAPI } from "node-routeros-v2";
import {
  NetworkRepository,
  type PelangganWithRouter,
  type RouterTenantId,
} from "../repositories/NetworkRepository";
import { MikroTikRouterRepository } from "@/modules/network/repositories/MikroTikRouterRepository";
import type { MikroTikRouterEntity } from "../domain/entities/MikroTikRouterEntity";
import type { IMikroTikRouterRepository } from "../domain/ports/IMikroTikRouterRepository";

interface PPPSecretData {
  name: string;
  password: string;
  profile: string;
  service?: string;
  comment?: string;
  disabled?: boolean;
}

interface SessionUsageData {
  downloadBytes: number;
  uploadBytes: number;
}

interface PPPActiveSessionRecord extends Record<string, string> {
  ".id"?: string;
  name?: string;
  interface?: string;
  "bytes-in"?: string;
  "bytes-out"?: string;
  "rx-byte"?: string;
  "tx-byte"?: string;
  rx?: string;
  tx?: string;
}
function pickCounter(
  session: PPPActiveSessionRecord,
  primary: keyof PPPActiveSessionRecord,
  fallback: keyof PPPActiveSessionRecord,
): number {
  const primaryValue = parseCounter(session[primary]);
  if (primaryValue > 0) return primaryValue;
  return parseCounter(session[fallback]);
}

function parseCounter(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeInterfaceName(name?: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function extractSessionUsage(
  session?: PPPActiveSessionRecord,
): SessionUsageData {
  if (!session) {
    return { downloadBytes: 0, uploadBytes: 0 };
  }

  const downloadFromPrimary = pickCounter(session, "bytes-out", "tx-byte");
  const uploadFromPrimary = pickCounter(session, "bytes-in", "rx-byte");

  return {
    // Prefer cumulative counters from active session or interface stats
    downloadBytes:
      downloadFromPrimary > 0 ? downloadFromPrimary : parseCounter(session.tx),
    uploadBytes:
      uploadFromPrimary > 0 ? uploadFromPrimary : parseCounter(session.rx),
  };
}

interface RouterConfig {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
}

interface MikroTikPPPSecretNetworkRepository {
  findRouterTenantId(routerId: string): Promise<RouterTenantId | null>;
  findPelangganWithRouter(
    pelangganId: string,
  ): Promise<PelangganWithRouter | null>;
}

type MikroTikPPPSecretDependencies = {
  networkRepository: MikroTikPPPSecretNetworkRepository;
  routerRepository: IMikroTikRouterRepository;
};

const EXPIRED_PROFILE = "expired users";
const CONNECTION_TIMEOUT = 10000;

export class MikroTikPPPSecretService {
  private readonly networkRepository: MikroTikPPPSecretNetworkRepository;
  private readonly routerRepository: IMikroTikRouterRepository;

  constructor(deps?: MikroTikPPPSecretDependencies) {
    if (!deps) {
      throw new Error("MikroTik PPP Secret dependencies wajib disediakan");
    }

    this.networkRepository = deps.networkRepository;
    this.routerRepository = deps.routerRepository;
  }

  /**
   * Helper: Connect ke MikroTik Router
   */
  private async connectToRouter(config: RouterConfig): Promise<RouterOSAPI> {
    const conn = new RouterOSAPI({
      host: config.ipAddress,
      port: config.apiPort,
      user: config.apiUsername,
      password: config.apiPassword,
      timeout: CONNECTION_TIMEOUT,
    });
    await conn.connect();
    return conn;
  }

  private async findRouter(
    routerId: string,
  ): Promise<MikroTikRouterEntity | null> {
    const routerTenant =
      await this.networkRepository.findRouterTenantId(routerId);
    if (!routerTenant?.tenantId) {
      return null;
    }

    return this.routerRepository.findById(routerId, routerTenant.tenantId);
  }

  /**
   * Helper: Get router config dari pelanggan
   * Menggunakan generated API user jika tersedia, fallback ke master user
   */
  private async getRouterFromPelanggan(pelangganId: string): Promise<{
    router: RouterConfig;
    routerId: string;
    pelanggan: {
      username: string;
      password: string;
      nama: string;
    };
    profileName: string;
  } | null> {
    const pelanggan =
      await this.networkRepository.findPelangganWithRouter(pelangganId);

    if (!pelanggan?.hargaPaket?.profilePPP?.mikroTikRouter) {
      return null;
    }

    const router = pelanggan.hargaPaket.profilePPP.mikroTikRouter;

    const apiUsername = router.apiUsernameGenerated || router.apiUsername;
    const apiPassword = router.apiPasswordGenerated || router.apiPassword;

    return {
      router: {
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: apiUsername,
        apiPassword: apiPassword,
      },
      routerId: router.id,
      pelanggan,
      profileName: pelanggan.hargaPaket.profilePPP.name,
    };
  }

  /**
   * Buat PPP Secret di MikroTik
   */
  async createSecret(
    routerId: string,
    data: PPPSecretData,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const router = await this.findRouter(routerId);

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
      const router = await this.findRouter(routerId);

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
      const router = await this.findRouter(routerId);

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
        const sessions = (await conn.write("/ppp/active/print", [
          `?name=${username}`,
        ])) as Array<Record<string, string>>;

        let disconnected = 0;
        for (const session of sessions || []) {
          if (session[".id"]) {
            await conn.write("/ppp/active/remove", [`=.id=${session[".id"]}`]);
            disconnected++;
          }
        }

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
      const router = await this.findRouter(routerId);

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
        const sessions = (await conn.write("/ppp/active/print", [
          `?name=${username}`,
        ])) as PPPActiveSessionRecord[];

        const activeSession = sessions?.[0] || null;
        const parsedFromActive = extractSessionUsage(
          activeSession || undefined,
        );

        const candidateInterfaceNames = [
          normalizeInterfaceName(activeSession?.interface),
          normalizeInterfaceName(activeSession?.name),
        ].filter(Boolean);

        const interfaceName = candidateInterfaceNames[0] || null;
        let interfacePrint: PPPActiveSessionRecord | null = null;
        let parsedFromInterface: SessionUsageData | undefined;

        for (const candidate of candidateInterfaceNames) {
          try {
            const interfaceStats = (await conn.write("/interface/print", [
              `?name=${candidate}`,
            ])) as PPPActiveSessionRecord[];
            if (interfaceStats?.[0]) {
              interfacePrint = interfaceStats[0];
              parsedFromInterface = extractSessionUsage(interfacePrint);
              break;
            }
          } catch {
            // ignore and try next candidate
          }
        }

        let monitorTraffic: PPPActiveSessionRecord | null = null;
        let parsedFromMonitor: SessionUsageData | undefined;

        for (const candidate of candidateInterfaceNames) {
          try {
            const traffic = (await conn.write("/interface/monitor-traffic", [
              `=interface=${candidate}`,
              "=once=",
            ])) as PPPActiveSessionRecord[];
            if (traffic?.[0]) {
              monitorTraffic = traffic[0];
              parsedFromMonitor = extractSessionUsage(monitorTraffic);
              break;
            }
          } catch {
            // ignore and try next candidate
          }
        }

        const monitorError =
          !monitorTraffic && candidateInterfaceNames.length > 0
            ? "monitor-traffic lookup failed for all interface candidates"
            : undefined;

        const interfaceDebug = {
          rawInterfaceField: activeSession?.interface || null,
          rawNameField: activeSession?.name || null,
          candidatesTried: candidateInterfaceNames,
        };

        let finalUsage = parsedFromActive;
        if (
          finalUsage.downloadBytes <= 0 &&
          finalUsage.uploadBytes <= 0 &&
          parsedFromInterface
        ) {
          finalUsage = parsedFromInterface;
        }
        if (
          finalUsage.downloadBytes <= 0 &&
          finalUsage.uploadBytes <= 0 &&
          parsedFromMonitor
        ) {
          finalUsage = parsedFromMonitor;
        }

        conn.close();
        return {
          success: true,
          routerIpAddress: router.ipAddress,
          activeSession,
          interfaceName,
          interfacePrint,
          monitorTraffic,
          parsedFromActive,
          parsedFromInterface,
          parsedFromMonitor,
          finalUsage,
          interfaceDebug,
          ...(monitorError ? { monitorError } : {}),
        };
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
      const router = await this.findRouter(routerId);

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
      const data = await this.getRouterFromPelanggan(pelangganId);
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
      const data = await this.getRouterFromPelanggan(pelangganId);
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
      const data = await this.getRouterFromPelanggan(pelangganId);
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
      const data = await this.getRouterFromPelanggan(pelangganId);
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

export function createMikroTikPPPSecretService() {
  return new MikroTikPPPSecretService({
    networkRepository: new NetworkRepository(),
    routerRepository: new MikroTikRouterRepository(),
  });
}

export default MikroTikPPPSecretService;
