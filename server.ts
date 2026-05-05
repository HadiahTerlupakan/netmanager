import "dotenv/config";
import "next/dist/server/node-environment-baseline";

// Flag to indicate we are running in a custom server context (not Next.js App Router)
// This helps prevent AsyncLocalStorage crashes in tenant detection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_CUSTOM_SERVER = true;

// Safeguard: Set Default Timezone for the entire process if not set
// This ensures Date() functions typically use this timezone in Node.js environment
if (!process.env.TZ) {
  process.env.TZ = "Asia/Jakarta";
}
logger.info(
  `[Server] Timezone set to: ${process.env.TZ} (${new Date().toString()})`,
);

import { createServer } from "http";
import next from "next";
import { getToken } from "next-auth/jwt";
import { cronRegistry } from "./lib/cron-registry";
import { shutdownManager } from "./lib/shutdown-manager";
import { startInternalCronIfEnabled } from "./lib/runtime/should-start-internal-cron";
import { stopRadiusMonitoring } from "./modules/network/services/RadiusMonitor";
import {
  startPushRetryProcessor,
  stopPushRetryProcessor,
} from "./modules/notification/services/PushRetryQueue";
import { UserRepository } from "./modules/users/repositories/UserRepository";
import { initializeEventBus, shutdownEventBus } from "./lib/event-bus";
import { isPublicUploadPath } from "./lib/upload/upload-policy";
import { logger } from "./lib/logger";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "127.0.0.1";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const userRepository = new UserRepository();

app.prepare().then(() => {
  let mikroTikMonitorRef: { stop: () => void; start: () => void } | null = null;

  const server = createServer(async (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost";
    const parsedUrl = new URL(req.url || "/", `${protocol}://${host}`);
    const pathname = parsedUrl.pathname;

    if (req.method === "POST" && pathname === "/api/admin/app-version") {
      const formidable = await import("formidable");
      const fs = await import("fs");
      const os = await import("os");
      const tmpDir = os.tmpdir();

      const form = formidable.formidable({
        maxFileSize: 1024 * 1024 * 1024,
        maxTotalFileSize: 1024 * 1024 * 1024,
        uploadDir: tmpDir,
        keepExtensions: true,
        multiples: false,
      });

      try {
        const [fields, files] = await form.parse(req);
        const { NextRequest } = await import("next/server");
        const { verifyAuth } = await import("./lib/auth");
        const { getAppVersionService } = await import("./modules/app-version");

        const cookieHeader = req.headers.cookie || "";
        const reqHeaders = new Headers();
        reqHeaders.set("cookie", cookieHeader);

        const mockReq = new Request(`http://localhost:${port}${req.url}`, {
          method: "GET",
          headers: reqHeaders,
        });
        const nextReq = new NextRequest(mockReq);

        const user = await verifyAuth(nextReq);
        if (!user) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Tidak terautentikasi" }));
          return;
        }

        const dbUser = await userRepository.findUploadPermissionContextById(
          user.id,
        );

        if (!dbUser) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "User tidak ditemukan" }));
          return;
        }

        const userRole = dbUser.role?.name || "";
        const hasAdminPanelAccess = dbUser.role?.accessAdminPanel === true;
        const userPermissions =
          dbUser.role?.permission?.map(
            (p: { resource: string; action: string }) =>
              `${p.resource}:${p.action}`,
          ) || [];

        const hasCreatePermission =
          userRole.toUpperCase() === "SUPER_ADMIN" ||
          userPermissions.includes("app_version:create") ||
          hasAdminPanelAccess;

        if (!hasCreatePermission) {
          logger.info(
            `[Upload] Forbidden access by ${dbUser.email}. Role: ${userRole}, AdminPanelAccess: ${hasAdminPanelAccess}, Permissions count: ${userPermissions.length}`,
          );
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Akses ditolak: Memerlukan izin app_version:create",
            }),
          );
          return;
        }

        logger.info(
          `[Upload] Access granted for ${dbUser.email}. Role: ${userRole}, AdminPanelAccess: ${hasAdminPanelAccess}`,
        );

        const version = fields.version?.[0] || undefined;
        const buildNumberStr = fields.buildNumber?.[0];
        const versionCodeStr = fields.versionCode?.[0];
        const platform = fields.platform?.[0] || "android";
        const releaseNotes = fields.releaseNotes?.[0] || undefined;
        const isForceUpdate = fields.isForceUpdate?.[0] === "true";
        const minVersion = fields.minVersion?.[0] || undefined;

        const buildNumber = buildNumberStr
          ? parseInt(buildNumberStr)
          : undefined;
        const versionCode = versionCodeStr
          ? parseInt(versionCodeStr)
          : undefined;

        let apkPath: string | undefined;
        let apkFilename: string | undefined;
        let apkSize: number | undefined;

        const apkFile = files.apk?.[0];
        if (apkFile) {
          apkPath = apkFile.filepath;
          apkFilename = apkFile.originalFilename || "app.apk";
          apkSize = apkFile.size;
        }

        if (!apkFile && (!version || !buildNumber || !versionCode)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error:
                "Upload APK untuk auto-detect versi, atau isi manual version, buildNumber, dan versionCode",
            }),
          );
          return;
        }

        const service = await getAppVersionService();
        const appVersion = await service.uploadVersion({
          version,
          buildNumber,
          versionCode,
          platform,
          releaseNotes,
          isForceUpdate,
          minVersion,
          apkPath,
          apkFilename,
          apkSize,
          createdBy: user.id,
        });

        if (apkFile) {
          try {
            fs.unlinkSync(apkFile.filepath);
          } catch (_e) {
            // Ignore if file already moved or deleted
          }
        }

        try {
          await logger.logActivity({
            action: "CREATE",
            subject: "AppVersion",
            userId: user.id,
            details: { id: appVersion.id, version: appVersion.version },
          });
        } catch (e) {
          logger.error("Logging failed", e);
        }

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            data: appVersion,
            message: "Versi aplikasi berhasil diupload",
          }),
        );
        return;
      } catch (error) {
        logger.error("[Server] Error uploading app version:", error);

        const err = error as {
          message?: string;
          code?: string;
          name?: string;
          stack?: string;
        };
        const errorMessage = err?.message || "Gagal mengunggah versi aplikasi";
        const errorDetails = {
          error: errorMessage,
          code: err?.code,
          name: err?.name,
          stack:
            process.env.NODE_ENV === "development" ? err?.stack : undefined,
        };

        try {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify(errorDetails));
        } catch (writeError) {
          logger.error("[Server] Failed to write error response:", writeError);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: errorMessage }));
        }
        return;
      }
    }

    const getMimeType = (filePath: string) => {
      const ext = filePath.split(".").pop()?.toLowerCase();
      switch (ext) {
        case "png":
          return "image/png";
        case "jpg":
        case "jpeg":
          return "image/jpeg";
        case "webp":
          return "image/webp";
        case "gif":
          return "image/gif";
        case "pdf":
          return "application/pdf";
        default:
          return "application/octet-stream";
      }
    };

    if (pathname?.startsWith("/uploads/") && req.method === "GET") {
      if (isPublicUploadPath(pathname)) {
        // Public attendance uploads stay readable even when R2 falls back to local storage.
      } else {
        const token = await getToken({
          req: req as unknown as import("next-auth/jwt").GetTokenParams["req"],
          secret: process.env.NEXTAUTH_SECRET,
        });

        if (!token) {
          logger.warn(
            `[Server] Unauthorized access attempt to ${pathname} from ${req.headers["x-forwarded-for"] || req.socket.remoteAddress}`,
          );
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error:
                "Sesi tidak valid atau telah berakhir. Silakan login kembali.",
            }),
          );
          return;
        }
      }

      const fs = await import("fs");
      const path = await import("path");
      const uploadsRootDir = path.resolve(process.cwd(), "public", "uploads");
      const relativePath = (pathname || "").replace(/^\/uploads\//, "");
      const requestedPath = path.resolve(uploadsRootDir, relativePath);

      if (
        !requestedPath.startsWith(uploadsRootDir + path.sep) &&
        requestedPath !== uploadsRootDir
      ) {
        logger.warn(`[Server] Blocked potential path traversal: ${pathname}`);
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Akses ditolak" }));
        return;
      }

      try {
        const stat = await fs.promises.stat(requestedPath);
        if (stat.isFile()) {
          res.writeHead(200, {
            "Content-Type": getMimeType(requestedPath),
            "Content-Length": stat.size,
          });
          const readStream = fs.createReadStream(requestedPath);
          readStream.pipe(res);
          return;
        }
      } catch {
        // File not found - fall through to Next.js handler
      }
    }

    handle(req, res);
  });

  startPushRetryProcessor();
  if (process.env.ENABLE_EVENT_BUS_WORKERS !== "false") {
    initializeEventBus().catch((err) =>
      logger.error("[Server] Failed to initialize Event Bus:", err),
    );
  }
  startInternalCronIfEnabled({ startAll: () => cronRegistry.startAll() });

  import("./modules/network/services/RadiusMonitor")
    .then(({ startRadiusMonitoring }) => {
      startRadiusMonitoring();
    })
    .catch((err) =>
      logger.error("[Server] Failed to start Radius monitoring:", err),
    );

  import("./modules/network/services/MikroTikMonitor")
    .then(({ mikroTikMonitor }) => {
      mikroTikMonitorRef = mikroTikMonitor;
      mikroTikMonitor.start();
    })
    .catch((err) =>
      logger.error("[Server] Failed to start MikroTik monitoring:", err),
    );

  server.listen(port, hostname, () => {
    logger.info("");
    logger.info(`  ▲ Next.js ${dev ? "dev" : "production"} server`);
    logger.info(`  - Local:        http://${hostname}:${port}`);
    logger.info("");
  });

  // Register graceful shutdown handler
  shutdownManager.register(async () => {
    logger.info("[Server] Shutting down gracefully");

    try {
      await shutdownEventBus();
      logger.info("[Server] Event Bus stopped");
    } catch (e) {
      logger.error("[Server] Error stopping Event Bus:", e);
    }

    cronRegistry.stopAll();

    try {
      stopRadiusMonitoring();
      stopPushRetryProcessor();
      mikroTikMonitorRef?.stop();
      logger.info("[Server] Monitoring services stopped");
    } catch (e) {
      logger.error("[Server] Error stopping services:", e);
    }

    // Flush pending Firestore batches
    try {
      const { firebaseRealtimeService } =
        await import("@/lib/realtime/firebase-realtime-service");
      await firebaseRealtimeService.cleanup();
      logger.info("[Server] Firestore batches flushed");
    } catch (e) {
      logger.error("[Server] Error flushing Firestore batches:", e);
    }

    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info("[Server] HTTP server closed");
        resolve();
      });

      // Force close after timeout
      setTimeout(() => {
        logger.error("[Server] Forced close after timeout");
        resolve();
      }, 5000);
    });
  });
});
