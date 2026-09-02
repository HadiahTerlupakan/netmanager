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

/**
 * Route yang menyentuh data uang tanpa memuat kata finansial di path-nya.
 * Deteksi berbasis nama saja pernah melewatkan 15 route seperti ini —
 * `company-bank-accounts`, `prorate-log`, `webhooks/[provider]` — sehingga
 * keberadaan gerbangnya tidak pernah diperiksa sama sekali.
 */
const FINANCIAL_BEHAVIOUR =
  /@\/modules\/finance|prisma-billing|prismaBilling|client-billing|InvoiceRepository|PaymentRepository|BillingRepository/;

/**
 * Route yang otorisasinya ditegakkan di service, bukan di berkas route.
 *
 * Pemeriksaan ini hanya membaca berkas route, jadi penegakan yang lebih dalam
 * tidak terlihat. Menelusuri impor sempat dicoba lalu ditolak: `@/lib/tenant-context`
 * menyebut `CRON_SECRET`, sehingga setiap route yang mengimpornya tampak berpagar
 * padahal belum tentu — false positive ke arah "aman" justru menyembunyikan celah.
 *
 * Tiap entri menyebut simbol penegaknya supaya bisa diverifikasi ulang.
 * Menambah entri di sini keputusan sadar, bukan jalan pintas.
 */
const SERVICE_ENFORCED_AUTHORIZATION: Record<string, string> = {
  "app/api/webhooks/[provider]/route.ts":
    "WebhookProcessingService.verifySignature — webhook diautentikasi tanda tangan provider, bukan sesi",
  "app/api/integrations/mixradius/expenses/rab/[id]/approve/route.ts":
    "rabApprovalService.canUserApproveRab — flag Role.canApproveRab",
  "app/api/integrations/mixradius/expenses/rab/[id]/reminder/route.ts":
    "RabApprovalReminderRouteService — cek canApproveRab/isSuperAdmin lalu balas 403",
  "app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/approve/route.ts":
    "approveRabRevision -> assertUserCanApproveRab",
  "app/api/integrations/mixradius/expenses/rab/[id]/revisions/[revisionId]/reject/route.ts":
    "rejectRabRevision -> assertUserCanApproveRab",
};

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
  .filter((path) => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    ROUTE_HANDLER.lastIndex = 0;
    if (!ROUTE_HANDLER.test(source)) return false;
    return FINANCIAL_PATH.test(path) || FINANCIAL_BEHAVIOUR.test(source);
  });

describe("otorisasi route finansial", () => {
  it("menemukan route finansial untuk diperiksa", () => {
    expect(financialRoutes.length).toBeGreaterThan(50);
  });

  // Regresi: deteksi versi pertama hanya melihat NAMA path, sehingga route yang
  // menyentuh uang tapi tidak memuat kata finansial di path-nya tidak pernah
  // dipindai sama sekali.
  it.each([
    "app/api/admin/company-bank-accounts/route.ts",
    "app/api/admin/pelanggan/[id]/prorate-log/route.ts",
    "app/api/integrations/mixradius/dismantle/route.ts",
    "app/api/webhooks/[provider]/route.ts",
  ])("memindai %s meski nama path-nya tidak finansial", (routePath) => {
    expect(financialRoutes).toContain(routePath);
  });

  it("setiap route finansial punya gerbang kapabilitas, bukan sekadar auth", () => {
    const unguarded = financialRoutes.filter(
      (path) =>
        !SERVICE_ENFORCED_AUTHORIZATION[path] &&
        !hasCapabilityGate(readFileSync(join(process.cwd(), path), "utf8")),
    );

    expect(unguarded).toEqual([]);
  });

  it("setiap pengecualian menyebut simbol penegak otorisasinya", () => {
    const tanpaAlasan = Object.entries(SERVICE_ENFORCED_AUTHORIZATION)
      .filter(([, reason]) => reason.trim().length < 20)
      .map(([path]) => path);

    expect(tanpaAlasan).toEqual([]);
  });

  it("pengecualian hanya untuk route yang benar-benar ada", () => {
    const hilang = Object.keys(SERVICE_ENFORCED_AUTHORIZATION).filter(
      (path) => !financialRoutes.includes(path),
    );

    expect(hilang).toEqual([]);
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
