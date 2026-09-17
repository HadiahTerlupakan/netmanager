import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "fs";
import { basename, dirname, extname, join, relative, sep } from "path";

/**
 * Berkas di dalam `app/` tidak boleh bisa menjawab request yang sama dengan
 * modul di root proyek.
 *
 * Image produksi dibangun di `/app`, sehingga folder App Router berada di
 * `/app/app`. Alias `@/components/x` diterjemahkan plugin tsconfig Next.js
 * menjadi path absolut `/app/components/x`, lalu webpack — yang memakai
 * `resolve.roots: [context]` bawaan — lebih dulu mencobanya sebagai path
 * relatif-root: `/app` + `/app/components/x` = `/app/app/components/x`.
 * Bila request itu teresolusi di sana (berkas persis, + ekstensi, atau
 * `index`), webpack diam-diam memakainya — termasuk saat ekstensinya berbeda
 * (`app/lib/x.ts` vs `lib/x.tsx`) atau bentuknya berbeda
 * (`app/modules/x.ts` vs `modules/x/index.ts`).
 *
 * Kejadian nyata: `app/components/inventory/PhotoUpload.tsx` (versi lama tanpa
 * `forwardRef`) membayangi `components/inventory/PhotoUpload.tsx`. Ref modal
 * Verifikasi Barang Sampai jadi `null`, foto bukti tidak pernah diunggah, dan
 * server menolak dengan "Foto bukti penerimaan barang wajib diunggah" meski
 * foto sudah dipilih. Bug ini tidak terlihat di dev, tes, maupun build lokal
 * karena root proyek di sana bukan `/app`.
 */
const REPO_ROOT = process.cwd();
const APP_ROOT = join(REPO_ROOT, "app");
/** `resolve.extensions` konfigurasi webpack utama Next.js 16. */
const WEBPACK_RESOLVE_EXTENSIONS = [
  ".js",
  ".mjs",
  ".tsx",
  ".ts",
  ".jsx",
  ".json",
  ".wasm",
];

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    return statSync(entryPath).isDirectory()
      ? collectFiles(entryPath)
      : [entryPath];
  });
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/** Request `@/<id>` yang teresolusi ke berkas `app/<appRelativePath>`. */
function getRequestIdsResolvingTo(appRelativePath: string): string[] {
  const extension = extname(appRelativePath);
  if (!WEBPACK_RESOLVE_EXTENSIONS.includes(extension)) return [appRelativePath];

  const withoutExtension = appRelativePath.slice(0, -extension.length);
  const requestIds = [appRelativePath, withoutExtension];
  const directory = dirname(withoutExtension);
  if (basename(withoutExtension) === "index" && directory !== ".") {
    requestIds.push(directory);
  }
  return requestIds;
}

/** Berkas di luar `app/` yang semestinya menjawab request `@/<id>`, bila ada. */
function resolveOutsideApp(requestId: string): string | undefined {
  const requestPath = join(REPO_ROOT, requestId);
  const candidates = [
    requestPath,
    ...WEBPACK_RESOLVE_EXTENSIONS.map((extension) => requestPath + extension),
    ...WEBPACK_RESOLVE_EXTENSIONS.map((extension) =>
      join(requestPath, `index${extension}`),
    ),
  ];
  return candidates.find(
    (candidate) => isFile(candidate) && !candidate.startsWith(APP_ROOT + sep),
  );
}

describe("path di dalam app/ tidak membayangi modul root", () => {
  it("tidak ada request @/<path> yang teresolusi ke app/<path> pada build webpack di /app", () => {
    const shadowing = collectFiles(APP_ROOT).flatMap((filePath) => {
      const appRelativePath = relative(APP_ROOT, filePath);
      return getRequestIdsResolvingTo(appRelativePath).flatMap((requestId) => {
        const shadowedFile = resolveOutsideApp(requestId);
        return shadowedFile
          ? [
              `app/${appRelativePath} membayangi ${relative(REPO_ROOT, shadowedFile)} pada build webpack di /app`,
            ]
          : [];
      });
    });

    expect([...new Set(shadowing)]).toEqual([]);
  });
});
