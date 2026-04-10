import "dotenv/config";

// Flag to indicate we are running in a custom server context (not Next.js App Router)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_CUSTOM_SERVER = true;

// Safeguard: Set Default Timezone for the entire process if not set
if (!process.env.TZ) {
  process.env.TZ = "Asia/Jakarta";
}
console.log(
  `[API Server] Timezone set to: ${process.env.TZ} (${new Date().toString()})`,
);

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "./lib/errors";
import { startInternalCronIfEnabled } from "./lib/runtime/should-start-internal-cron";
import { stopRadiusMonitoring } from "./modules/network/services/RadiusMonitor";
import {
  startPushRetryProcessor,
  stopPushRetryProcessor,
} from "./modules/notification/services/PushRetryQueue";

// Standalone Hono app for custom server (separate from Next.js App Router route)
const honoApp = new Hono().basePath("/api");

honoApp.onError((err, c) => {
  console.error(err);
  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
        code: err.code,
        ...((err.details as Record<string, unknown>) ?? {}),
      },
      err.statusCode as ContentfulStatusCode,
    );
  }
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.API_PORT || process.env.PORT || "3001", 10);

let mikroTikMonitorRef: { stop: () => void; start: () => void } | null = null;

const server = serve(
  {
    fetch: (req: Request, env?: unknown, executionCtx?: unknown) =>
      honoApp.fetch(
        req,
        env as Parameters<typeof honoApp.fetch>[1],
        executionCtx as Parameters<typeof honoApp.fetch>[2],
      ),
    port,
    hostname,
  },
  (info) => {
    console.log(`\n  ▲ Hono API Server (${dev ? "dev" : "production"})`);
    console.log(`  - Local:        http://${hostname}:${info.port}\n`);
  },
) as unknown as import("http").Server;

startPushRetryProcessor();

import("./modules/network/services/RadiusMonitor")
  .then(({ startRadiusMonitoring }) => {
    startRadiusMonitoring();
  })
  .catch((err) =>
    console.error("[Server] Failed to start Radius monitoring:", err),
  );

import("./modules/network/services/MikroTikMonitor")
  .then(({ mikroTikMonitor }) => {
    mikroTikMonitorRef = mikroTikMonitor;
    mikroTikMonitor.start();
  })
  .catch((err) =>
    console.error("[Server] Failed to start MikroTik monitoring:", err),
  );

if (startInternalCronIfEnabled({ startAll: () => {} })) {
  import("./lib/cron-registry")
    .then(({ cronRegistry }) => {
      cronRegistry.startAll();
    })
    .catch((err) =>
      console.error("[Server] Failed to load Cron Registry:", err),
    );
}

const gracefulShutdown = (signal: string) => {
  console.log(`[Server] ${signal} received, shutting down gracefully`);

  import("./lib/cron-registry")
    .then(({ cronRegistry }) => {
      cronRegistry.stopAll();
    })
    .catch((err) =>
      console.error("[Server] Failed to stop Cron Registry:", err),
    );

  try {
    stopRadiusMonitoring();
    stopPushRetryProcessor();
    mikroTikMonitorRef?.stop();
    console.log("[Server] Monitoring services stopped");
  } catch (e) {
    console.error("[Server] Error stopping services:", e);
  }

  server.close(() => {
    console.log("[Server] HTTP server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[Server] Forced exit after timeout");
    process.exit(1);
  }, 5000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
