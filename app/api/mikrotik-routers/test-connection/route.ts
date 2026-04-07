import { MikroTikRouterRepository } from "@/modules/network";
import { RouterOSAPI } from "node-routeros-v2";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

// Interface for Router Information
interface RouterInfo {
  identity: string;
  version: string;
  boardName: string;
  uptime: string;
  userOnline: number;
}

// Test MikroTik API connection menggunakan node-routeros-v2
async function testMikroTikAPI(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  timeout: number = 10000,
): Promise<{ success: boolean; message: string; routerInfo?: RouterInfo }> {
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
          } catch (_e) {
            // console.log('Failed to get identity:', e)
          }

          try {
            resource = await conn.write("/system/resource/print");
          } catch (_e) {
            // console.log('Failed to get resource:', e)
          }

          try {
            pppActive = await conn.write("/ppp/active/print");
          } catch (_e) {
            // console.log('Failed to get ppp active:', e)
          }

          cleanup();
          clearTimeout(timer);

          // Handle response format - could be array or object
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
            userOnline: userOnline,
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
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.error("Error getting router info:", error);
          resolve({
            success: true,
            message: `Koneksi API berhasil, tetapi gagal mengambil informasi router: ${errorMsg}`,
          });
        }
      })
      .catch((error: { message?: string; code?: string }) => {
        cleanup();
        clearTimeout(timer);

        let errorMessage = "Koneksi API gagal";

        if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
          errorMessage = `Koneksi timeout - kemungkinan IP Address salah atau router tidak dapat dijangkau`;
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
          errorMessage = `Autentikasi gagal - Username atau Password salah`;
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

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("mikrotik:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const tenantId = ctx.session!.user.tenantId;
  const body = await req.json();
  const {
    ipAddress: initialIpAddress,
    apiPort: initialApiPort = 8728,
    apiUsername: initialApiUsername,
    apiPassword: initialApiPassword,
    routerId,
  } = body;

  let ipAddress = initialIpAddress;
  let apiPort = initialApiPort;
  let apiUsername = initialApiUsername;
  let apiPassword = initialApiPassword;

  if (routerId) {
    try {
      const routerRepository = new MikroTikRouterRepository();
      const router = await routerRepository.findById(routerId, tenantId);
      if (router) {
        ipAddress = router.ipAddress;
        apiPort = router.apiPort;
        apiUsername = router.apiUsernameGenerated || router.apiUsername;
        apiPassword = router.apiPasswordGenerated || router.apiPassword;
        // console.log(`[Test Connection] Using ${router.apiUsernameGenerated ? 'generated' : 'master'} user for router ${router.name}`)
      }
    } catch (_e) {
      console.error("Error fetching router:", _e);
    }
  }

  if (!ipAddress) {
    return apiError("IP Address is required", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  const finalApiPort =
    apiPort &&
    !isNaN(Number(apiPort)) &&
    Number(apiPort) > 0 &&
    Number(apiPort) <= 65535
      ? Number(apiPort)
      : 8728;

  let apiResult: {
    success: boolean;
    message: string;
    routerInfo?: RouterInfo;
  } | null = null;
  if (apiUsername && apiPassword) {
    apiResult = await testMikroTikAPI(
      ipAddress,
      finalApiPort,
      apiUsername,
      apiPassword,
      10000,
    );
  } else {
    apiResult = {
      success: false,
      message: "Username/Password tidak disediakan untuk test koneksi API",
    };
  }

  const overallSuccess = apiResult.success;

  if (routerId && overallSuccess && apiResult.routerInfo) {
    try {
      const routerRepository = new MikroTikRouterRepository();
      await routerRepository.update(
        routerId,
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
  } else if (routerId) {
    try {
      const routerRepository = new MikroTikRouterRepository();
      await routerRepository.update(
        routerId,
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

  return apiSuccess({
    success: overallSuccess,
    api: apiResult,
    routerInfo: apiResult?.routerInfo || null,
    message: overallSuccess
      ? "Koneksi berhasil! API dapat diakses dengan autentikasi yang benar."
      : "Koneksi gagal. Periksa IP Address, port, username, password, and pastikan router dapat dijangkau dari server ini.",
  });
});
