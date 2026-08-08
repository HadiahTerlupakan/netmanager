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
import { initializeEventBus, shutdownEventBus } from "./lib/event-bus";
import { isPublicUploadPath } from "./lib/upload/upload-policy";
import { logger } from "./lib/logger";
import { redis } from "./lib/redis";
import { validateCriticalEnvVars } from "./lib/utils/env";

// Validate critical environment variables sebelum server start
try {
  validateCriticalEnvVars();
  console.log("✅ All critical environment variables validated");
} catch (error) {
  console.error("❌ Environment validation failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "127.0.0.1";
const port = parseInt(process.env.PORT || "3000", 10);

// Turbopack di custom server tidak aktif otomatis seperti `next dev` standar.
// Wajib opt-in eksplisit. Bisa di-disable via NEXT_DISABLE_TURBOPACK=1 jika perlu fallback ke webpack.
const useTurbopack = dev && process.env.NEXT_DISABLE_TURBOPACK !== "1";

const app = next({ dev, hostname, port, turbopack: useTurbopack });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  let mikroTikMonitorRef: { stop: () => void; start: () => void } | null = null;

  const server = createServer(async (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost";
    const parsedUrl = new URL(req.url || "/", `${protocol}://${host}`);
    const pathname = parsedUrl.pathname;

    // Intercept Expo Updates publish endpoint sebelum Next.js handler.
    // Bundle bisa mencapai 12MB+ dan Next.js Route Handler punya hidden 10MB
    // body limit yang tidak bisa dinaikkan via config. Custom server intercept
    // dengan formidable streaming langsung ke disk.
    if (req.method === "POST" && pathname === "/api/admin/app-update/publish") {
      try {
        const { handleAppUpdatePublish } =
          await import("./modules/app-update/services/handleAppUpdatePublishHttp");
        await handleAppUpdatePublish(req, res);
      } catch (error) {
        logger.error("[Server] App update publish handler error:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Publish handler error",
              code: "INTERNAL_ERROR",
            }),
          );
        }
      }
      return;
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
  // Eager-connect shared Redis client supaya cron tick pertama tidak race
  // dengan koneksi yang masih lazy. Tanpa ini, cron yang fire di menit pertama
  // setelah bootstrap bisa kena `Stream isn't writeable` karena
  // enableOfflineQueue: false dan koneksi belum ready.
  redis.connect().catch((err) => {
    if (err.message?.includes("already connecting")) return;
    logger.warn(`[Server] Shared Redis eager connect failed: ${err.message}`);
  });
  startInternalCronIfEnabled({ startAll: () => cronRegistry.startAll() });

  void import("./modules/network/services/monitorBootstrap")
    .then(async ({ waitForDatabaseReady }) => {
      await waitForDatabaseReady();
      const [
        { startRadiusMonitoring },
        { mikroTikMonitor },
        { restoreAllBaileySessions },
      ] = await Promise.all([
        import("./modules/network/services/RadiusMonitor"),
        import("./modules/network/services/MikroTikMonitor"),
        import("./modules/notification/api"),
      ]);

      startRadiusMonitoring();
      mikroTikMonitorRef = mikroTikMonitor;
      mikroTikMonitor.start();
      await restoreAllBaileySessions();
    })
    .catch((err) =>
      logger.error(
        "[Server] Failed to start monitoring/Baileys services:",
        err,
      ),
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
