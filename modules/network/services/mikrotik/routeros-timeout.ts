import { RouterOSAPI } from "node-routeros-v2";
import { logger } from "@/lib/logger";

/**
 * node-routeros-v2 reads its `timeout` option in seconds (it calls
 * `socket.setTimeout(timeout * 1000)`), while every caller here thinks in
 * milliseconds; passing 10000 straight through meant about 2.8 hours. 0 is
 * avoided because the library treats it as unset and falls back to 10 s.
 */
export function toRouterOsTimeoutSeconds(timeoutMs: number): number {
  return Math.max(1, Math.ceil(timeoutMs / 1000));
}

/**
 * RouterOS API client with the timeout converted and an `error` listener
 * attached. After login the library re-emits a socket timeout as `error` on
 * the client; an EventEmitter with no listener throws it and takes the whole
 * process down. With the old 2.8-hour timeout that never happened, with a
 * real 10 s one any connection left open a little too long would.
 */
export function createRouterOsApi(options: {
  host: string;
  port: number;
  user: string;
  password: string;
  timeoutMs: number;
}): RouterOSAPI {
  const { timeoutMs, ...connection } = options;
  const client = new RouterOSAPI({
    ...connection,
    timeout: toRouterOsTimeoutSeconds(timeoutMs),
  });
  client.on("error", (error: unknown) => {
    logger.warn(
      `[RouterOS] Koneksi ${options.host}:${options.port} terputus:`,
      error,
    );
  });
  return client;
}
