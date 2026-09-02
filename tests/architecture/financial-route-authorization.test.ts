import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Setiap route API yang menyentuh uang wajib punya gerbang kapabilitas.
 *
 * Latar: `createHandler` tidak pernah memeriksa role maupun `accessAdminPanel`,
 * dan repo ini tidak punya `middleware.ts`. Artinya `auth: true` saja hanya
 * membuktikan "principal ini terautentikasi" — token mobile karyawan
 * berprivilese rendah (mis. Teknisi, yang hanya punya permission `m_*`)
 * lolos ke setiap route ber-`auth: true`. Tanpa tes ini, route finansial baru
 * bisa lahir tanpa gerbang dan tidak ada yang menyadarinya.
 */

const API_ROOT = join(process.cwd(), "app/api");

const FINANCIAL_PATH =
  /(finance|invoice|payment|billing|tagihan|accounting|withdrawal|treasury|tax)/i;

const ROUTE_HANDLER =
  /export\s+(?:const|async\s+function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

/**
 * `site_only` dan `department_only` membatasi CAKUPAN data, bukan kapabilitas.
 * Route yang hanya punya itu tetap membiarkan pemanggil tanpa kapabilitas
 * finansial masuk — jadi keduanya tidak dihitung sebagai gerbang.
 */
const SCOPE_ONLY_ACTIONS = new Set(["site_only", "department_only"]);

/**
 * Dua pola pengecekan inline yang dipakai repo ini:
 *   hasPermission("finance:read")           -> lewat sesi NextAuth
 *   ctx.permissions.includes("expense:read") -> langsung dari context handler
 */
const INLINE_CAPABILITY_CHECK =
  /(?:hasPermission\s*\(\s*|ctx\.permissions\.includes\s*\(\s*)["'`]([a-z_]+):([a-z_]+)/g;

/** `permissions:` boleh berupa array literal maupun konstanta bersama. */
const OTHER_GUARDS =
  /permissions:\s*(?:\[|[A-Z][A-Z0-9_]*)|ensureAdminAccess|ensureAnyPermission|ensurePermission|canAccess|requireCustomerAuth|CRON_SECRET|requireMitraAuth|getMixRadiusAccessService/;

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    if (statSync(entryPath).isDirectory()) return collectRouteFiles(entryPath);
    return entry === "route.ts" ? [entryPath] : [];
  });
}

function toRepoPath(absolutePath: string): string {
  return absolutePath.slice(process.cwd().length + 1);
}

function hasCapabilityGate(source: string): boolean {
  if (OTHER_GUARDS.test(source)) return true;

  const inlineChecks = [...source.matchAll(INLINE_CAPABILITY_CHECK)];
  return inlineChecks.some(([, , action]) => !SCOPE_ONLY_ACTIONS.has(action));
}

const financialRoutes = collectRouteFiles(API_ROOT)
  .map(toRepoPath)
  .filter((path) => FINANCIAL_PATH.test(path))
  .filter((path) => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    ROUTE_HANDLER.lastIndex = 0;
    return ROUTE_HANDLER.test(source);
  });

describe("otorisasi route finansial", () => {
  it("menemukan route finansial untuk diperiksa", () => {
    expect(financialRoutes.length).toBeGreaterThan(50);
  });

  it("setiap route finansial punya gerbang kapabilitas, bukan sekadar auth", () => {
    const unguarded = financialRoutes.filter(
      (path) =>
        !hasCapabilityGate(readFileSync(join(process.cwd(), path), "utf8")),
    );

    expect(unguarded).toEqual([]);
  });

  it("menerima permissions option berupa konstanta bersama", () => {
    const guarded = `export const GET = createHandler({ auth: true, permissions: INVOICE_READ_PERMISSIONS }, async () => {});`;

    expect(hasCapabilityGate(guarded)).toBe(true);
  });

  it("menerima ctx.permissions.includes sebagai gerbang", () => {
    const guarded = `if (!ctx.permissions.includes("expense:read")) return ApiErrors.forbidden();`;

    expect(hasCapabilityGate(guarded)).toBe(true);
  });

  it("tidak menganggap pembatas site_only sebagai gerbang kapabilitas", () => {
    const scopeOnly = `
      export const GET = createHandler({ auth: true }, async () => {});
      async function restricted() { return hasPermission("invoices:site_only"); }
    `;

    expect(hasCapabilityGate(scopeOnly)).toBe(false);
  });

  it("menerima permissions option sebagai gerbang", () => {
    const guarded = `export const GET = createHandler({ auth: true, permissions: ["finance:read"] }, async () => {});`;

    expect(hasCapabilityGate(guarded)).toBe(true);
  });

  it("menerima hasPermission kapabilitas sebagai gerbang", () => {
    const guarded = `if (!(await hasPermission("finance:read"))) return ApiErrors.forbidden();`;

    expect(hasCapabilityGate(guarded)).toBe(true);
  });
});
