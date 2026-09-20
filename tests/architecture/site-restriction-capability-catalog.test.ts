import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  getResourceCapabilities,
  type ResourceAction,
} from "@/lib/resource-capabilities";

/**
 * Halaman Hak Akses hanya menggambar toggle yang ada di katalog kapabilitas
 * (`lib/resource-capabilities.ts`). Kalau sebuah resource menegakkan
 * `<resource>:site_only` di API tapi katalognya tidak memuat `site_only`,
 * pembatasan itu jadi tak terlihat: pemilik role tidak bisa mematikannya, dan
 * setiap penyimpanan role mengirim ulang permission itu apa adanya.
 *
 * Kejadian nyata (2026-09-20): role `admin` memegang `site:site_only`, sehingga
 * dropdown SITE/AREA di form Work Order menyusut ke satu site. Kartu "Site" di
 * halaman Hak Akses hanya menampilkan baris BASIC ACCESS — tidak ada toggle
 * "Batasi ke Site Sendiri" sama sekali, karena entri `site` di katalog cuma
 * berisi read/create/update/delete.
 *
 * Resource tanpa entri katalog aman: `getResourceCapabilities` jatuh ke default
 * yang sudah memuat kedua aksi pembatasan.
 */
const SEARCH_ROOTS = ["app", "modules", "lib"];

/** Berkas yang hanya MENDEKLARASIKAN nama permission, bukan menegakkannya. */
const BERKAS_DEKLARASI = [
  "lib/role-templates.ts",
  "lib/permission-aliases.ts",
  "lib/permission-config.ts",
  "lib/resource-capabilities.ts",
];

/** Implementasi pembatasan itu sendiri; nama resource di sana cuma contoh. */
const DIREKTORI_IMPLEMENTASI = "lib/authorization/";

const SCOPE_ACTIONS: ResourceAction[] = ["site_only", "department_only"];

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) return collectSourceFiles(entryPath);
    return /\.tsx?$/.test(entry) ? [entryPath] : [];
  });
}

function sourceFilesToScan(): string[] {
  return SEARCH_ROOTS.flatMap(collectSourceFiles)
    .map((filePath) => relative(process.cwd(), filePath))
    .filter(
      (filePath) =>
        !BERKAS_DEKLARASI.includes(filePath) &&
        !filePath.startsWith(DIREKTORI_IMPLEMENTASI),
    );
}

/**
 * Argumen kedua tiap `checkSiteRestriction(...)`, dengan kurung berimbang.
 * Argumen pertama sering berisi koma sendiri
 * (`buildSessionWithPermissions(ctx.session!, ctx.permissions)`), jadi pemisahan
 * koma harus sadar kedalaman kurung.
 */
function resourceArguments(source: string): string[] {
  const marker = "checkSiteRestriction(";
  const resources: string[] = [];

  for (
    let index = source.indexOf(marker);
    index !== -1;
    index = source.indexOf(marker, index + marker.length)
  ) {
    let depth = 1;
    let argumentIndex = 0;
    let current = "";

    for (
      let cursor = index + marker.length;
      cursor < source.length;
      cursor += 1
    ) {
      const character = source[cursor]!;
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (depth === 0) break;
      if (character === "," && depth === 1) {
        argumentIndex += 1;
        if (argumentIndex > 1) break;
        current = "";
        continue;
      }
      if (argumentIndex === 1) current += character;
    }

    const literal = current.trim().match(/^"([a-z_0-9]+)"$/);
    if (literal) resources.push(literal[1]!);
  }

  return resources;
}

/**
 * Resource yang pembatasannya benar-benar ditegakkan, dikumpulkan dari dua pola:
 * argumen kedua `checkSiteRestriction(...)` dan literal `"<resource>:site_only"`.
 */
function findEnforcedScopes(): Map<ResourceAction, Set<string>> {
  const enforced = new Map<ResourceAction, Set<string>>(
    SCOPE_ACTIONS.map((action) => [action, new Set<string>()]),
  );

  for (const filePath of sourceFilesToScan()) {
    const source = readFileSync(join(process.cwd(), filePath), "utf8");

    for (const action of SCOPE_ACTIONS) {
      const literals = source.matchAll(
        new RegExp(`"([a-z_0-9]+):${action}"`, "g"),
      );
      for (const match of literals) {
        enforced.get(action)!.add(match[1]!);
      }
    }

    for (const resource of resourceArguments(source)) {
      enforced.get("site_only")!.add(resource);
    }
  }

  return enforced;
}

describe("katalog kapabilitas menampilkan setiap pembatasan yang ditegakkan", () => {
  const enforced = findEnforcedScopes();

  it.each(SCOPE_ACTIONS)(
    "setiap resource yang menegakkan %s bisa mematikannya dari halaman Hak Akses",
    (action) => {
      const tersembunyi = [...enforced.get(action)!]
        .filter(
          (resource) => !getResourceCapabilities(resource).includes(action),
        )
        .sort();

      expect(tersembunyi).toEqual([]);
    },
  );

  it("memang menemukan resource yang ditegakkan (penjaga tidak kosong)", () => {
    expect(enforced.get("site_only")!.size).toBeGreaterThan(10);
    expect(enforced.get("department_only")!.size).toBeGreaterThan(0);
  });
});
