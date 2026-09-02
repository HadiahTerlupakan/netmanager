import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Next.js 16 menjadikan `params` sebuah Promise dan menegakkannya.
 *
 * Halaman yang masih memakai tanda tangan sinkron (`params: { id: string }`)
 * membaca `params.id` sebagai `undefined`. Gejalanya tidak terlihat saat
 * typecheck maupun tes unit — hanya muncul sebagai request aneh di produksi,
 * seperti `GET /api/planning/undefined 404` yang tercatat di log.
 */
const APP_ROOT = join(process.cwd(), "app");

/**
 * Tanda tangan route yang menerima params sebagai objek biasa.
 * Didahului `}: ` agar hanya cocok pada posisi parameter fungsi yang
 * di-destructure — bukan deklarasi variabel lokal bernama `params`, yang
 * sempat membuat `app/api/mobile/mixradius/customers/route.ts` tertuduh keliru.
 */
const SYNC_PARAMS_SIGNATURE = /\}:\s*\{[^}]*params:\s*\{\s*\w+\s*:\s*string/;

/** Bentuk yang benar untuk Next 16. */
const ASYNC_PARAMS_SIGNATURE = /params:\s*Promise</;

const ROUTE_FILES = new Set(["page.tsx", "layout.tsx", "route.ts"]);

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) return collectRouteFiles(entryPath);
    return ROUTE_FILES.has(entry) ? [entryPath] : [];
  });
}

const toRepoPath = (absolute: string) =>
  absolute.slice(process.cwd().length + 1);

describe("tanda tangan params Next.js", () => {
  it("tidak ada halaman yang menerima params secara sinkron", () => {
    const offenders = collectRouteFiles(APP_ROOT)
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        // Hanya berkas yang memang menerima params dari Next, bukan yang
        // kebetulan punya variabel lokal bernama params.
        if (!SYNC_PARAMS_SIGNATURE.test(source)) return false;
        return !ASYNC_PARAMS_SIGNATURE.test(source);
      })
      .map(toRepoPath);

    expect(offenders).toEqual([]);
  });

  it("mengenali tanda tangan sinkron sebagai pelanggaran", () => {
    const source =
      "export default function Page({ params }: { params: { id: string } })";
    expect(SYNC_PARAMS_SIGNATURE.test(source)).toBe(true);
  });

  it("tidak menuduh variabel lokal bernama params", () => {
    const source = "const params: { siteIds?: string } = {};";
    expect(SYNC_PARAMS_SIGNATURE.test(source)).toBe(false);
  });

  it("menerima tanda tangan Promise sebagai benar", () => {
    const source = "params: Promise<{ id: string }>";
    expect(ASYNC_PARAMS_SIGNATURE.test(source)).toBe(true);
  });
});
