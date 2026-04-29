import snmp from "net-snmp";
import {
  DEFAULT_SNMP_TIMEOUT,
  LARGE_SNMP_TIMEOUT,
  SNMP_ERROR_HANDLER_FLAG,
} from "./constants";
import { resolveSnmpVersion } from "./version";

/** Install the global net-snmp bug guard once. */
export function setupSnmpErrorHandler(): void {
  if (typeof process === "undefined") {
    return;
  }

  const globalState = global as typeof globalThis & {
    [SNMP_ERROR_HANDLER_FLAG]?: boolean;
  };

  if (globalState[SNMP_ERROR_HANDLER_FLAG]) {
    return;
  }

  try {
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const errorText = args.join(" ");
      if (errorText.includes("req.doneCb is not a function")) {
        return;
      }
      originalConsoleError.apply(console, args);
    };

    const snmpErrorHandler = (error: Error) => {
      if (error.message?.includes("req.doneCb is not a function")) {
        return;
      }
      originalConsoleError("[Uncaught Exception]", error);
    };

    process.on("uncaughtException", snmpErrorHandler);
    globalState[SNMP_ERROR_HANDLER_FLAG] = true;
  } catch (error) {
    console.warn("[SNMP] Failed to setup error handler:", error);
  }
}

/** Create a standard SNMP session. */
export function createSnmpSession(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  timeout?: number;
  retries?: number;
}): snmp.Session {
  const {
    ipAddress,
    port,
    community,
    version,
    timeout = DEFAULT_SNMP_TIMEOUT,
    retries = 2,
  } = params;

  setupSnmpErrorHandler();

  return snmp.createSession(ipAddress, community, {
    port,
    version: resolveSnmpVersion(version),
    retries,
    timeout,
  });
}

/** Create a long-running SNMP session for large walks. */
export function createLongRunningSnmpSession(params: {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
}): snmp.Session {
  return createSnmpSession({
    ...params,
    timeout: LARGE_SNMP_TIMEOUT,
  });
}

/** Close an SNMP session safely. */
export function closeSnmpSession(session: snmp.Session | null): void {
  if (!session) {
    return;
  }

  setTimeout(() => {
    try {
      session.close();
    } catch {
      // Ignore close errors from net-snmp.
    }
  }, 100);
}
