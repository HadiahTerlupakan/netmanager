import snmp from "net-snmp";
import {
  DEFAULT_SNMP_TIMEOUT,
  LARGE_SNMP_TIMEOUT,
  SNMP_ERROR_HANDLER_FLAG,
} from "./constants";
import { resolveSnmpVersion } from "./version";

type SnmpSessionParams = {
  ipAddress: string;
  port: number;
  community: string;
  version: string;
  timeout?: number;
  retries?: number;
};

type SnmpGlobalState = typeof globalThis & {
  [SNMP_ERROR_HANDLER_FLAG]?: boolean;
};

function shouldIgnoreSnmpDoneCallbackError(errorText: string) {
  return errorText.includes("req.doneCb is not a function");
}

function installSnmpConsoleErrorGuard(
  originalConsoleError: typeof console.error,
) {
  console.error = (...args: unknown[]) => {
    const errorText = args.join(" ");
    if (shouldIgnoreSnmpDoneCallbackError(errorText)) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

function installSnmpUncaughtExceptionGuard(
  originalConsoleError: typeof console.error,
) {
  process.on("uncaughtException", (error: Error) => {
    if (shouldIgnoreSnmpDoneCallbackError(error.message || "")) {
      return;
    }
    originalConsoleError("[Uncaught Exception]", error);
  });
}

function getSnmpGlobalState() {
  return global as SnmpGlobalState;
}

/** Install the global net-snmp bug guard once. */
export function setupSnmpErrorHandler(): void {
  if (typeof process === "undefined") return;

  const globalState = getSnmpGlobalState();
  if (globalState[SNMP_ERROR_HANDLER_FLAG]) return;

  try {
    const originalConsoleError = console.error;
    installSnmpConsoleErrorGuard(originalConsoleError);
    installSnmpUncaughtExceptionGuard(originalConsoleError);
    globalState[SNMP_ERROR_HANDLER_FLAG] = true;
  } catch (error) {
    console.warn("[SNMP] Failed to setup error handler:", error);
  }
}

function buildSnmpSessionOptions(params: SnmpSessionParams) {
  return {
    port: params.port,
    version: resolveSnmpVersion(params.version),
    retries: params.retries ?? 2,
    timeout: params.timeout ?? DEFAULT_SNMP_TIMEOUT,
  };
}

/** Create a standard SNMP session. */
export function createSnmpSession(params: SnmpSessionParams): snmp.Session {
  setupSnmpErrorHandler();
  return snmp.createSession(
    params.ipAddress,
    params.community,
    buildSnmpSessionOptions(params),
  );
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
