// ESM import of Node built-in `module` — aman, tidak menarik async_hooks ke
// bundle klien (pola sama dengan lib/tenant-context.ts).
import { createRequire as nodeCreateRequire } from "module";

/**
 * Konteks satu request API untuk Log Aktivitas: IP & user agent pelaku, serta
 * penanda apakah aksi request ini sudah dicatat oleh log domain. Bila sudah,
 * log generik middleware dilewati supaya satu aksi = satu baris log.
 */
export interface ActivityRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  hasDomainActivity: boolean;
}

type ActivityContextStorage = {
  run: <T>(
    store: ActivityRequestContext,
    callback: () => Promise<T>,
  ) => Promise<T>;
  getStore: () => ActivityRequestContext | undefined;
};

let activityContextStorage: ActivityContextStorage | null = null;

function getActivityContextStorage(): ActivityContextStorage {
  if (!activityContextStorage) {
    const nodeRequire = nodeCreateRequire(import.meta.url ?? __filename);
    const { AsyncLocalStorage } = nodeRequire("node:async_hooks") as {
      AsyncLocalStorage: new () => ActivityContextStorage;
    };
    activityContextStorage = new AsyncLocalStorage();
  }
  return activityContextStorage;
}

/** Buat konteks baru untuk satu request. */
export function createActivityRequestContext(input: {
  ipAddress: string | null;
  userAgent: string | null;
}): ActivityRequestContext {
  return { ...input, hasDomainActivity: false };
}

/** Jalankan handler request di dalam konteks Log Aktivitas. */
export function runWithActivityRequestContext<T>(
  context: ActivityRequestContext,
  callback: () => Promise<T>,
): Promise<T> {
  return getActivityContextStorage().run(context, callback);
}

/** Ambil konteks request aktif; `undefined` di luar request (cron, worker). */
export function getActivityRequestContext():
  | ActivityRequestContext
  | undefined {
  return getActivityContextStorage().getStore();
}

/** Ambil IP dan user agent klien dari header request. */
export function readClientInfo(headers: Headers): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress:
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip") ||
      null,
    userAgent: headers.get("user-agent") || null,
  };
}
