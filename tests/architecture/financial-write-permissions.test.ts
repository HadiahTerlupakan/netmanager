import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Handler tulis finansial tidak boleh menerima permission `:read`.
 *
 * `createHandler` menilai daftar permission sebagai OR (`expandedPerms.some(...)`
 * di `lib/api/handler.ts`), jadi satu entri baca membuat hak baca setara hak
 * tulis. Kejadian nyata 2026-09-19: `POST /api/finance/transfer` menerima
 * `finance:read`, sehingga peran yang hanya boleh melihat data keuangan bisa
 * memindahkan uang antar rekening; `POST /api/finance/pay-po` bahkan hanya
 * menuntut `finance:read` untuk membayar purchase order dari saldo bank.
 *
 * Tes ini menegakkan aturannya, bukan satu route tertentu, supaya route baru
 * ikut terjaga. Handler yang daftar permission-nya tidak bisa dibaca statis
 * dilewati di sini — keberadaan gerbangnya sendiri sudah dijaga
 * `tests/architecture/financial-route-authorization.test.ts`.
 */
const API_ROOT = join(process.cwd(), "app/api");
const FINANCIAL_PATH =
  /(finance|invoice|payment|billing|tagihan|accounting|withdrawal|treasury|tax)/i;
const MUTATING_HANDLER =
  /export const (POST|PUT|PATCH|DELETE)\s*=\s*createHandler\(/g;
const SHARED_PERMISSION_FILES = [
  "lib/financial-write-permissions.ts",
  "lib/api/financial-permissions.ts",
];

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) return collectRouteFiles(entryPath);
    return entryPath.endsWith("route.ts") ? [entryPath] : [];
  });
}

/** Konstanta daftar permission yang dipakai bersama beberapa route. */
function loadSharedPermissionLists(): Map<string, string[]> {
  const lists = new Map<string, string[]>();
  for (const file of SHARED_PERMISSION_FILES) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    for (const match of source.matchAll(
      /export const (\w+):\s*string\[\]\s*=\s*\[([^\]]*)\]/g,
    )) {
      lists.set(match[1]!, parsePermissionList(match[2]!));
    }
  }
  return lists;
}

function parsePermissionList(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim().replace(/["']/g, ""))
    .filter(Boolean);
}

/** Argumen opsi `createHandler({ ... })`, dibaca dengan kurung berimbang. */
function readHandlerOptions(source: string, fromIndex: number): string {
  const start = source.indexOf("{", fromIndex);
  if (start < 0) return "";

  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

function resolvePermissions(
  options: string,
  sharedLists: Map<string, string[]>,
): string[] | null {
  const literal = options.match(/permissions:\s*\[([^\]]*)\]/);
  if (literal) return parsePermissionList(literal[1]!);

  const named = options.match(/permissions:\s*([A-Z_][A-Z0-9_]*)/);
  if (named) return sharedLists.get(named[1]!) ?? null;

  return null;
}

function findReadPermissionsOnWriteHandlers(): string[] {
  const sharedLists = loadSharedPermissionLists();

  return collectRouteFiles(API_ROOT)
    .map((filePath) => relative(process.cwd(), filePath))
    .filter((routePath) => FINANCIAL_PATH.test(routePath))
    .flatMap((routePath) => {
      const source = readFileSync(join(process.cwd(), routePath), "utf8");
      return [...source.matchAll(MUTATING_HANDLER)].flatMap((handler) => {
        const options = readHandlerOptions(
          source,
          handler.index + handler[0].length - 1,
        );
        const permissions = resolvePermissions(options, sharedLists);
        if (!permissions) return [];

        const readPermissions = permissions.filter((permission) =>
          permission.endsWith(":read"),
        );
        return readPermissions.length
          ? [`${handler[1]} ${routePath}: ${readPermissions.join(", ")}`]
          : [];
      });
    });
}

describe("permission tulis route finansial", () => {
  it("tidak ada handler tulis yang bisa dilewati dengan permission baca", () => {
    expect(findReadPermissionsOnWriteHandlers()).toEqual([]);
  });

  it("benar-benar memeriksa route finansial yang ada", () => {
    // Penjaga terhadap regex yang berhenti cocok: bila daftar route finansial
    // menjadi kosong, tes di atas ikut hijau tanpa memeriksa apa pun.
    const financialRoutes = collectRouteFiles(API_ROOT)
      .map((filePath) => relative(process.cwd(), filePath))
      .filter((routePath) => FINANCIAL_PATH.test(routePath));

    expect(financialRoutes.length).toBeGreaterThan(20);
  });
});
