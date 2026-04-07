import { prisma } from "@/lib/prisma";
import { logActivitySafe } from "@/lib/logger";
import { RouterOSAPI } from "node-routeros-v2";
import type {
  MikroTikRouterCreateData,
  MikroTikRouterPublic,
  MikroTikRouterUpdateData,
} from "../repositories/IMikroTikRouterRepository";
import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";
import { MikroTikProvisioningService } from "./MikroTikProvisioningService";
import { checkSingleMikroTikRouterStatus } from "./mikrotik-ping-check";

interface RouterInfo {
  identity: string;
  version: string;
  boardName: string;
  uptime: string;
  userOnline: number;
}

interface TestConnectionResult {
  success: boolean;
  message: string;
  routerInfo?: RouterInfo;
}

export class RouterAccessDeniedError extends Error {}
export class RouterNotFoundError extends Error {}

async function testMikroTikAPI(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  timeout: number = 10000,
): Promise<TestConnectionResult> {
  return new Promise((resolve) => {
    const conn = new RouterOSAPI({
      host: ipAddress,
      user: username,
      password,
      port,
      timeout,
    });

    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          conn.close();
        } catch (_error) {
          // Ignore cleanup errors
        }
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        message: `Koneksi API timeout setelah ${timeout}ms - kemungkinan kredensial salah atau router tidak dapat dijangkau`,
      });
    }, timeout + 1000);

    conn
      .connect()
      .then(async () => {
        try {
          let identity: unknown = null;
          let resource: unknown = null;
          let pppActive: unknown = null;

          try {
            identity = await conn.write("/system/identity/print");
          } catch (_error) {
            // Ignore identity read errors
          }

          try {
            resource = await conn.write("/system/resource/print");
          } catch (_error) {
            // Ignore resource read errors
          }

          try {
            pppActive = await conn.write("/ppp/active/print");
          } catch (_error) {
            // Ignore PPP active read errors
          }

          cleanup();
          clearTimeout(timer);

          const identityData = Array.isArray(identity)
            ? (identity[0] as Record<string, unknown>)
            : (identity as Record<string, unknown>);
          const resourceData = Array.isArray(resource)
            ? (resource[0] as Record<string, unknown>)
            : (resource as Record<string, unknown>);
          const userOnline = Array.isArray(pppActive) ? pppActive.length : 0;

          const routerInfo: RouterInfo = {
            identity: "Unknown",
            version: "Unknown",
            boardName: "Unknown",
            uptime: "Unknown",
            userOnline,
          };

          if (identityData) {
            routerInfo.identity = (identityData.name ||
              identityData[".name"] ||
              "Unknown") as string;
          }

          if (resourceData) {
            routerInfo.version = (resourceData.version ||
              resourceData[".version"] ||
              "Unknown") as string;
            routerInfo.boardName = (resourceData["board-name"] ||
              resourceData.boardName ||
              "Unknown") as string;
            routerInfo.uptime = (resourceData.uptime ||
              resourceData[".uptime"] ||
              "Unknown") as string;
          }

          resolve({
            success: true,
            message: `Koneksi API berhasil! Router: ${routerInfo.identity}, Version: ${routerInfo.version}, User Online: ${userOnline}`,
            routerInfo,
          });
        } catch (error: unknown) {
          cleanup();
          clearTimeout(timer);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error("Error getting router info:", error);
          resolve({
            success: true,
            message: `Koneksi API berhasil, tetapi gagal mengambil informasi router: ${errorMessage}`,
          });
        }
      })
      .catch((error: { message?: string; code?: string }) => {
        cleanup();
        clearTimeout(timer);

        let errorMessage = "Koneksi API gagal";

        if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
          errorMessage =
            "Koneksi timeout - kemungkinan IP Address salah atau router tidak dapat dijangkau";
        } else if (
          error.message?.includes("ECONNREFUSED") ||
          error.code === "ECONNREFUSED"
        ) {
          errorMessage = `Port ${port} ditolak - kemungkinan API MikroTik tidak aktif atau firewall memblokir`;
        } else if (
          error.message?.includes("ENOTFOUND") ||
          error.code === "ENOTFOUND"
        ) {
          errorMessage = `Host ${ipAddress} tidak dapat dijangkau`;
        } else if (
          error.message?.includes("invalid user name or password") ||
          error.message?.includes("authentication")
        ) {
          errorMessage = "Autentikasi gagal - Username atau Password salah";
        } else {
          errorMessage = `Koneksi API gagal: ${error.message || error.code || "Terjadi kesalahan"}`;
        }

        resolve({
          success: false,
          message: errorMessage,
        });
      });
  });
}

export class MikroTikRouterService {
  private routerRepository = new MikroTikRouterRepository();

  private async resolveRestrictedSiteId(
    userId: string,
  ): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { siteId: true },
    });

    return user?.siteId ?? null;
  }

  private async getAuthorizedRouter(params: {
    id: string;
    tenantId: string;
    userId: string;
    restrictedToOwnSite: boolean;
  }): Promise<MikroTikRouterPublic> {
    const router = await this.routerRepository.findById(
      params.id,
      params.tenantId,
    );

    if (!router) {
      throw new RouterNotFoundError("Router tidak ditemukan");
    }

    if (!params.restrictedToOwnSite) {
      return router;
    }

    const userSiteId = await this.resolveRestrictedSiteId(params.userId);

    if (!userSiteId || router.siteId !== userSiteId) {
      throw new RouterAccessDeniedError("Akses ditolak");
    }

    return router;
  }

  async listRouters(params: {
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
    search?: string;
    page: number;
    limit: number;
  }) {
    let siteId: string | undefined;

    if (params.restrictedToOwnSite) {
      const userSiteId = await this.resolveRestrictedSiteId(params.userId);

      if (!userSiteId) {
        return {
          routers: [],
          total: 0,
          page: params.page,
          limit: params.limit,
          totalPages: 0,
        };
      }

      siteId = userSiteId;
    }

    const filters: Record<string, string | undefined> = {};
    if (params.search) filters.search = params.search;
    if (siteId) filters.siteId = siteId;

    return this.routerRepository.findWithFilters(
      filters,
      { page: params.page, limit: params.limit },
      params.tenantId,
    );
  }

  async getRouterById(params: {
    id: string;
    tenantId: string;
    userId: string;
    restrictedToOwnSite: boolean;
  }) {
    return this.getAuthorizedRouter(params);
  }

  async createRouter(params: {
    data: Omit<
      MikroTikRouterCreateData,
      "tenantId" | "secretRadius" | "authPort" | "accountingPort"
    >;
    autoConfigure?: unknown;
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
  }): Promise<{ id: string }> {
    const forcedSecretRadius = process.env.RADIUS_SECRET || "testing123";
    const forcedAuthPort = Number(process.env.RADIUS_AUTH_PORT) || 1812;
    const forcedAccountingPort = Number(process.env.RADIUS_ACCT_PORT) || 1813;

    let finalSiteId = params.data.siteId ?? null;
    if (params.restrictedToOwnSite) {
      const userSiteId = await this.resolveRestrictedSiteId(params.userId);
      if (!userSiteId) {
        throw new RouterAccessDeniedError(
          "User tidak memiliki akses site untuk membuat router",
        );
      }
      finalSiteId = userSiteId;
    }

    const createData: MikroTikRouterCreateData = {
      name: params.data.name,
      ipAddress: params.data.ipAddress,
      timezone: params.data.timezone,
      apiPort: Number(params.data.apiPort),
      apiUsername: params.data.apiUsername,
      apiPassword: params.data.apiPassword,
      authPort: forcedAuthPort,
      accountingPort: forcedAccountingPort,
      secretRadius: forcedSecretRadius,
      isolirUrl: params.data.isolirUrl,
      description: params.data.description,
      siteId: finalSiteId,
      tenantId: params.tenantId,
    };

    const router = await this.routerRepository.create(createData);

    if (params.autoConfigure) {
      try {
        const provisioningService = new MikroTikProvisioningService();

        const provisioningResult = await provisioningService.provisionRadius(
          {
            ip: createData.ipAddress,
            port: createData.apiPort ?? 8728,
            username: createData.apiUsername,
            password: createData.apiPassword,
          },
          null,
          forcedSecretRadius,
          createData.isolirUrl,
          forcedAuthPort,
          forcedAccountingPort,
        );

        if (!provisioningResult.success) {
          console.warn(
            `Router created but provisioning failed: ${provisioningResult.logs.join(", ")}`,
          );
        }

        const apiUserResult = await provisioningService.createApiUser({
          ip: createData.ipAddress,
          port: createData.apiPort ?? 8728,
          username: createData.apiUsername,
          password: createData.apiPassword,
        });

        if (
          apiUserResult.success &&
          apiUserResult.username &&
          apiUserResult.password
        ) {
          await prisma.mikroTikRouter.update({
            where: { id: router.id },
            data: {
              apiUsernameGenerated: apiUserResult.username,
              apiPasswordGenerated: apiUserResult.password,
            },
          });
        } else {
          console.warn(
            `API User creation failed: ${apiUserResult.logs.join(", ")}`,
          );
        }
      } catch (error: unknown) {
        console.error("Provisioning CRITICAL error:", error);
      }
    }

    try {
      await checkSingleMikroTikRouterStatus(router.id);
    } catch (error: unknown) {
      console.error("Failed to perform initial router check:", error);
    }

    logActivitySafe({
      action: "CREATE",
      subject: "MikroTik Router",
      userId: params.userId,
      details: {
        id: router.id,
        name: createData.name,
        ip: createData.ipAddress,
      },
    });

    return router;
  }

  async updateRouter(params: {
    id: string;
    data: MikroTikRouterUpdateData;
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
  }): Promise<void> {
    await this.getAuthorizedRouter({
      id: params.id,
      tenantId: params.tenantId,
      userId: params.userId,
      restrictedToOwnSite: params.restrictedToOwnSite,
    });

    const forcedSecretRadius = process.env.RADIUS_SECRET || "testing123";
    const forcedAuthPort = Number(process.env.RADIUS_AUTH_PORT) || 1812;
    const forcedAccountingPort = Number(process.env.RADIUS_ACCT_PORT) || 1813;

    const updateData: MikroTikRouterUpdateData = {
      ...(params.data.name !== undefined && { name: params.data.name }),
      ...(params.data.ipAddress !== undefined && {
        ipAddress: params.data.ipAddress,
      }),
      ...(params.data.timezone !== undefined && {
        timezone: params.data.timezone,
      }),
      ...(params.data.apiPort !== undefined && {
        apiPort: params.data.apiPort,
      }),
      ...(params.data.apiUsername !== undefined && {
        apiUsername: params.data.apiUsername,
      }),
      ...(params.data.apiPassword !== undefined && {
        apiPassword: params.data.apiPassword,
      }),
      ...(params.data.isolirUrl !== undefined && {
        isolirUrl: params.data.isolirUrl,
      }),
      ...(params.data.description !== undefined && {
        description: params.data.description,
      }),
      authPort: forcedAuthPort,
      accountingPort: forcedAccountingPort,
      secretRadius: forcedSecretRadius,
      tenantId: params.tenantId,
    };

    if (params.restrictedToOwnSite) {
      updateData.siteId = await this.resolveRestrictedSiteId(params.userId);
    } else if (params.data.siteId !== undefined) {
      updateData.siteId = params.data.siteId;
    }

    await this.routerRepository.update(params.id, updateData, params.tenantId);

    logActivitySafe({
      action: "UPDATE",
      subject: "MikroTik Router",
      userId: params.userId,
      details: { id: params.id, changes: params.data },
    });
  }

  async deleteRouter(params: {
    id: string;
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
  }): Promise<void> {
    const router = await this.routerRepository.findById(
      params.id,
      params.tenantId,
    );

    if (router && params.restrictedToOwnSite) {
      const userSiteId = await this.resolveRestrictedSiteId(params.userId);
      if (!userSiteId || router.siteId !== userSiteId) {
        throw new RouterAccessDeniedError("Akses ditolak");
      }
    }

    if (router) {
      try {
        const provisioningService = new MikroTikProvisioningService();

        const result = await provisioningService.deprovisionRadius(
          {
            ip: router.ipAddress,
            port: router.apiPort,
            username: router.apiUsername,
            password: router.apiPassword,
          },
          null,
          router.isolirUrl,
        );

        if (!result.success) {
          console.warn(`Deprovisioning failed: ${result.logs.join(", ")}`);
        }
      } catch (error: unknown) {
        console.error("Failed to auto-deprovision:", error);
      }
    }

    await this.routerRepository.delete(params.id, params.tenantId);

    logActivitySafe({
      action: "DELETE",
      subject: "MikroTik Router",
      userId: params.userId,
      details: { id: params.id },
    });
  }

  async generateApiUser(params: {
    id: string;
    userId: string;
    tenantId: string;
    restrictedToOwnSite: boolean;
  }): Promise<{ success: boolean; username?: string; logs: string[] }> {
    const router = await this.getAuthorizedRouter({
      id: params.id,
      tenantId: params.tenantId,
      userId: params.userId,
      restrictedToOwnSite: params.restrictedToOwnSite,
    });

    const provisioningService = new MikroTikProvisioningService();
    const result = await provisioningService.createApiUser({
      ip: router.ipAddress,
      port: router.apiPort,
      username: router.apiUsername,
      password: router.apiPassword,
    });

    if (!result.success) {
      return result;
    }

    await prisma.mikroTikRouter.update({
      where: { id: router.id },
      data: {
        ...(result.username && { apiUsernameGenerated: result.username }),
        ...(result.password && { apiPasswordGenerated: result.password }),
      },
    });

    try {
      await logActivitySafe({
        action: "CREATE",
        subject: "MikroTik API User",
        userId: params.userId,
        details: { routerId: params.id, username: result.username },
      });
    } catch (error: unknown) {
      console.error("Logging failed", error);
    }

    return result;
  }

  async testConnection(params: {
    tenantId: string;
    routerId?: string;
    ipAddress?: string;
    apiPort?: number | string;
    apiUsername?: string;
    apiPassword?: string;
  }): Promise<{
    apiResult: TestConnectionResult;
    routerInfo: RouterInfo | null;
    resolvedRouterId: string | null;
  }> {
    const { tenantId, routerId, apiPort, apiUsername, apiPassword } = params;
    let { ipAddress } = params;
    let finalApiPort = apiPort;
    let finalApiUsername = apiUsername;
    let finalApiPassword = apiPassword;
    const resolvedRouterId = routerId || null;

    if (routerId) {
      try {
        const router = await this.routerRepository.findById(routerId, tenantId);
        if (router) {
          ipAddress = router.ipAddress;
          finalApiPort = router.apiPort;
          finalApiUsername = router.apiUsernameGenerated || router.apiUsername;
          finalApiPassword = router.apiPasswordGenerated || router.apiPassword;
        }
      } catch (error) {
        console.error("Error fetching router:", error);
      }
    }

    const numericPort =
      finalApiPort &&
      !isNaN(Number(finalApiPort)) &&
      Number(finalApiPort) > 0 &&
      Number(finalApiPort) <= 65535
        ? Number(finalApiPort)
        : 8728;

    let apiResult: TestConnectionResult;
    if (ipAddress && finalApiUsername && finalApiPassword) {
      apiResult = await testMikroTikAPI(
        ipAddress,
        numericPort,
        finalApiUsername,
        finalApiPassword,
        10000,
      );
    } else if (!ipAddress) {
      apiResult = {
        success: false,
        message: "IP Address is required",
      };
    } else {
      apiResult = {
        success: false,
        message: "Username/Password tidak disediakan untuk test koneksi API",
      };
    }

    if (resolvedRouterId && apiResult.success && apiResult.routerInfo) {
      try {
        await this.routerRepository.update(
          resolvedRouterId,
          {
            pingStatus: "online",
            userOnline: apiResult.routerInfo.userOnline || 0,
            lastStatusCheck: new Date(),
          },
          tenantId,
        );
      } catch (error: unknown) {
        console.error("Error updating connection status:", error);
      }
    } else if (resolvedRouterId) {
      try {
        await this.routerRepository.update(
          resolvedRouterId,
          {
            pingStatus: "offline",
            userOnline: 0,
            lastStatusCheck: new Date(),
          },
          tenantId,
        );
      } catch (error: unknown) {
        console.error("Error updating connection status:", error);
      }
    }

    return {
      apiResult,
      routerInfo: apiResult.routerInfo || null,
      resolvedRouterId,
    };
  }
}
