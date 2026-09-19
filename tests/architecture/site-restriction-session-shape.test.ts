import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `checkSiteRestriction` membaca `session.user.permissions`, sementara sesi yang
 * dibangun `createHandler` (lib/api/handler.ts) sengaja tidak memuat permissions
 * — permissions disimpan terpisah di `ctx.permissions`. Mengoper `ctx.session`
 * apa adanya membuat `permissions` selalu kosong, sehingga `isRestricted` selalu
 * false dan pembatasan `<resource>:site_only` tidak pernah menggigit.
 *
 * Jembatannya sudah ada (`lib/api/build-session-with-permissions.ts`), tetapi
 * cast seperti `ctx.session as never` atau `{ user } as never` menyembunyikan
 * ketidakcocokan bentuk sesi itu dari tsc, jadi kompilator tidak bisa
 * menangkapnya. Tes ini yang menangkap.
 *
 * Ditemukan 2026-09-19 pada 12 route (pelanggan-ppp, hargapakets, admin/sites,
 * admin/options, pembayaran, pembatalan invoice, dan lima route mitra).
 */
const SEARCH_ROOTS = ["app", "modules", "lib"];
const BENTUK_SESI_MENTAH = /ctx\.session|as never|\{\s*user\s*[,}]/;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) return collectSourceFiles(entryPath);
    return /\.tsx?$/.test(entry) ? [entryPath] : [];
  });
}

/** Argumen pertama tiap pemanggilan `checkSiteRestriction`, dengan kurung berimbang. */
function firstArguments(source: string): string[] {
  const calls: string[] = [];
  const marker = "checkSiteRestriction(";

  for (
    let index = source.indexOf(marker);
    index !== -1;
    index = source.indexOf(marker, index + marker.length)
  ) {
    let depth = 1;
    let argument = "";
    for (
      let cursor = index + marker.length;
      cursor < source.length;
      cursor += 1
    ) {
      const character = source[cursor]!;
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (depth === 0) break;
      if (character === "," && depth === 1) break;
      argument += character;
    }
    calls.push(argument.replace(/\s+/g, " ").trim());
  }

  return calls;
}

function findRawSessionCalls(): string[] {
  return SEARCH_ROOTS.flatMap(collectSourceFiles)
    .map((filePath) => relative(process.cwd(), filePath))
    .filter((filePath) => !filePath.startsWith("lib/authorization/"))
    .flatMap((filePath) => {
      const source = readFileSync(join(process.cwd(), filePath), "utf8");
      if (!source.includes("checkSiteRestriction(")) return [];

      return firstArguments(source)
        .filter(
          (argument) =>
            !argument.includes("buildSessionWithPermissions") &&
            BENTUK_SESI_MENTAH.test(argument),
        )
        .map((argument) => `${filePath}: checkSiteRestriction(${argument})`);
    });
}

describe("bentuk sesi pada checkSiteRestriction", () => {
  it("tidak ada pemanggil yang mengoper sesi createHandler apa adanya", () => {
    expect(findRawSessionCalls()).toEqual([]);
  });

  it("route yang memakai createHandler menyiapkan sesi lewat jembatan permissions", () => {
    const pelanggar = SEARCH_ROOTS.flatMap(collectSourceFiles)
      .map((filePath) => relative(process.cwd(), filePath))
      .filter((filePath) => {
        const source = readFileSync(join(process.cwd(), filePath), "utf8");
        return (
          source.includes("checkSiteRestriction(") &&
          source.includes("createHandler(") &&
          !source.includes("buildSessionWithPermissions")
        );
      });

    expect(pelanggar).toEqual([]);
  });
});
