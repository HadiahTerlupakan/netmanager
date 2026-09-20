import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Seluruh route di `app/api/network` hanya memakai `createHandler({ auth: true })`
 * — tanpa satu pun pemeriksaan permission. Artinya setiap pengguna yang berhasil
 * login, peran apa pun, bisa membaca peringatan jaringan, data performa, dan
 * daftar backup perangkat; `POST /api/network/backups/[id]/restore` bahkan
 * memulihkan backup ke MikroTik — operasi yang mengubah konfigurasi perangkat.
 *
 * Halaman `/admin/network` dijaga `ensureAnyPermission` dengan delapan
 * permission, jadi gerbang UI tidak pernah menjadi pengganti gerbang API:
 * endpoint-nya tetap bisa dipanggil langsung.
 *
 * Ditemukan 2026-09-21 saat menelusuri mengapa `network:site_only` tidak pernah
 * ditegakkan — ternyata `network:read` pun tidak.
 */
const NETWORK_API_DIR = "app/api/network";

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) return collectRouteFiles(entryPath);
    return entry === "route.ts" ? [entryPath] : [];
  });
}

/** Argumen konfigurasi tiap `createHandler(...)`, dengan kurung berimbang. */
function handlerConfigs(source: string): string[] {
  const marker = "createHandler(";
  const configs: string[] = [];

  for (
    let index = source.indexOf(marker);
    index !== -1;
    index = source.indexOf(marker, index + marker.length)
  ) {
    let depth = 1;
    let config = "";
    for (
      let cursor = index + marker.length;
      cursor < source.length;
      cursor += 1
    ) {
      const character = source[cursor]!;
      if (character === "(" || character === "{" || character === "[")
        depth += 1;
      if (character === ")" || character === "}" || character === "]")
        depth -= 1;
      if (depth === 0) break;
      if (character === "," && depth === 1) break;
      config += character;
    }
    configs.push(config);
  }

  return configs;
}

function findUnguardedHandlers(): string[] {
  return collectRouteFiles(join(process.cwd(), NETWORK_API_DIR))
    .map((filePath) => relative(process.cwd(), filePath))
    .flatMap((filePath) => {
      const source = readFileSync(join(process.cwd(), filePath), "utf8");
      return handlerConfigs(source)
        .filter((config) => !config.includes("permissions:"))
        .map((config) => `${filePath}: createHandler(${config.trim()})`);
    });
}

describe("otorisasi route jaringan", () => {
  it("setiap handler menuntut permission, bukan sekadar login", () => {
    expect(findUnguardedHandlers()).toEqual([]);
  });

  it("memang memeriksa route yang ada (penjaga tidak kosong)", () => {
    const routes = collectRouteFiles(join(process.cwd(), NETWORK_API_DIR));
    expect(routes.length).toBeGreaterThan(5);
  });
});
