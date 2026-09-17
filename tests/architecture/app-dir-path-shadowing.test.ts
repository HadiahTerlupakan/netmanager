import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/**
 * Berkas di dalam `app/` tidak boleh memakai path relatif yang sama dengan
 * berkas di root proyek.
 *
 * Image produksi dibangun di `/app`, sehingga folder App Router berada di
 * `/app/app`. Alias `@/components/x` diterjemahkan plugin tsconfig Next.js
 * menjadi path absolut `/app/components/x`, lalu webpack — yang memakai
 * `resolve.roots: [context]` bawaan — lebih dulu mencobanya sebagai path
 * relatif-root: `/app` + `/app/components/x` = `/app/app/components/x`.
 * Bila berkas kembar itu ada, webpack diam-diam memakainya.
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
const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) return collectSourceFiles(entryPath);
    return SOURCE_EXTENSIONS.test(entry) ? [entryPath] : [];
  });
}

describe("path di dalam app/ tidak membayangi path root", () => {
  it("tidak ada berkas app/<path> yang kembar dengan <path> di root proyek", () => {
    const shadowing = collectSourceFiles(APP_ROOT)
      .map((filePath) => relative(APP_ROOT, filePath))
      .filter((appRelativePath) => existsSync(join(REPO_ROOT, appRelativePath)))
      .map(
        (appRelativePath) =>
          `app/${appRelativePath} membayangi ${appRelativePath} pada build webpack di /app`,
      );

    expect(shadowing).toEqual([]);
  });
});
