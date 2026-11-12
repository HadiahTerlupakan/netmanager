import type { RedisOptions } from "ioredis";

export const DEFAULT_LOCAL_REDIS_URL = "redis://localhost:6379";

/**
 * Ubah `REDIS_URL` menjadi opsi koneksi ioredis dengan WHATWG `URL`.
 *
 * ioredis 5 mem-parse URL string memakai `url.parse()` lama, yang di Node 24
 * memicu DEP0169 dan dianggap rawan (perilaku tidak standar). Dengan memberi
 * ioredis objek opsi, `url.parse()` tidak pernah dipanggil.
 *
 * - `redis://[:password@]host[:port][/db]` dan `rediss://` (TLS)
 * - username/password di-decode (`%40` → `@`)
 * - `?db=N` dan `?family=4|6` dihormati; nilai lain (mis. `family=undefined`
 *   dari env Next.js) diabaikan
 * - auth kosong tidak dikirim, supaya tidak memicu NOAUTH
 *
 * Melempar error bila URL tidak valid atau protokolnya bukan redis/rediss.
 */
export function redisOptionsFromUrl(rawUrl: string): RedisOptions {
  const url = new URL(rawUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error(`Protokol REDIS_URL tidak didukung: ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[(.*)\]$/, "$1") || "localhost";
  const options: RedisOptions = {
    host,
    port: url.port ? Number(url.port) : 6379,
  };

  const username = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  if (username) options.username = username;
  if (password) options.password = password;

  const dbFromPath = url.pathname.replace(/^\//, "");
  const dbRaw = url.searchParams.get("db") ?? dbFromPath;
  if (dbRaw !== "" && /^\d+$/.test(dbRaw)) options.db = Number(dbRaw);

  const family = url.searchParams.get("family");
  if (family === "4" || family === "6") options.family = Number(family);

  if (url.protocol === "rediss:") options.tls = {};

  return options;
}
