// ESM import of Node built-in `module` — aman, tidak menarik async_hooks ke
// bundle klien (pola sama dengan lib/tenant-context.ts).
import { createRequire as nodeCreateRequire } from "module";

/**
 * Konteks satu request API untuk Log Aktivitas: IP & user agent pelaku, serta
 * penulisan log domain selama request. Log generik middleware hanya dilewati
 * bila minimal satu log domain benar-benar tersimpan (fail-closed: log domain
 * yang dilewati/gagal tidak menghilangkan jejak aksi).
 */
export interface ActivityRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  pendingDomainLogs: Promise<boolean>[];
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
  return { ...input, pendingDomainLogs: [] };
}

/** Daftarkan penulisan log domain; nilai `true` berarti log tersimpan. */
export function trackDomainActivity(
  context: ActivityRequestContext,
  write: Promise<boolean>,
): void {
  context.pendingDomainLogs.push(write);
}

/** Tunggu semua log domain request selesai; `true` bila ada yang tersimpan. */
export async function hasRecordedDomainActivity(
  context: ActivityRequestContext,
): Promise<boolean> {
  const results = await Promise.allSettled(context.pendingDomainLogs);
  return results.some(
    (result) => result.status === "fulfilled" && result.value === true,
  );
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

/**
 * Ambil IP dan user agent klien dari header request. `X-Real-Ip` diset proxy
 * (Traefik) dari alamat koneksi, sedangkan entri awal `X-Forwarded-For` bisa
 * dikirim sendiri oleh klien — jadi dipakai entri terakhir yang ditambahkan
 * proxy tepercaya.
 */
export function readClientInfo(headers: Headers): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",") ?? [];
  const proxyAppendedIp = forwardedFor.at(-1)?.trim();
  return {
    ipAddress: headers.get("x-real-ip")?.trim() || proxyAppendedIp || null,
    userAgent: headers.get("user-agent") || null,
  };
}
