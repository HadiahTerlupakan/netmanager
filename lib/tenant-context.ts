import { logger } from "@/lib/logger";
import { isSuperAdminRole } from "@/lib/auth/helpers";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { MAIN_TENANT_ID } from "@/lib/tenant-constants";
import { prisma } from "@/modules/database";
// ESM import of Node built-in `module` — safe, does not pull async_hooks
// into the bundler graph. Used to lazily require async_hooks at runtime
// only on the server, keeping the client bundle clean.
import { createRequire as nodeCreateRequire } from "module";

/** Subdomain portal pelanggan — satu-satunya portal tanpa sesi saat login. */
const CUSTOMER_PORTAL_SUBDOMAIN = "pelanggan";

/** Subdomain portal staf; tenant-nya selalu datang dari sesi. */
const STAFF_PORTAL_SUBDOMAINS = ["admin", "karyawan", "investor"];

/** Label portal pada sebuah host, atau null bila bukan host portal. */
function matchPortalSubdomain(hostname: string): string | null {
  const portalSubdomains = [
    ...STAFF_PORTAL_SUBDOMAINS,
    CUSTOMER_PORTAL_SUBDOMAIN,
  ];

  return (
    portalSubdomains.find(
      (label) =>
        hostname.startsWith(`${label}.`) ||
        hostname.startsWith(`${label}-staging.`),
    ) ?? null
  );
}

async function resolveTenantContextFromHost(
  requestHeaders: Headers | null,
): Promise<TenantContextResult | null> {
  const host =
    requestHeaders?.get("x-forwarded-host") || requestHeaders?.get("host");
  const normalizedHost = host?.split(":")[0]?.trim().toLowerCase();

  if (!normalizedHost) {
    return null;
  }

  // Localhost di production tidak boleh otomatis di-mapping ke tenant utama —
  // pasti misconfiguration ingress/proxy. Default fail-closed kecuali di env
  // selain production.
  if (normalizedHost === "localhost") {
    if (process.env.NODE_ENV === "production") {
      logger.warn(
        "[TENANT_CONTEXT] Localhost host header in production — refusing to map to MAIN_TENANT_ID.",
      );
      return null;
    }
    return resolvePrimaryTenantContext();
  }

  const baseDomain = process.env.DOMAIN || "radpro.id";

  // Bare/apex domain biasanya dipakai untuk landing/marketing page, bukan
  // aplikasi tenant. Auto-map ke MAIN_TENANT_ID di production menyaru
  // misconfiguration ingress (mestinya redirect ke landing). Default
  // fail-closed di production; opt-in via ALLOW_BARE_DOMAIN_AS_MAIN_TENANT.
  if (normalizedHost === baseDomain) {
    const allowBareDomain =
      process.env.ALLOW_BARE_DOMAIN_AS_MAIN_TENANT === "true";
    if (process.env.NODE_ENV === "production" && !allowBareDomain) {
      logger.warn(
        `[TENANT_CONTEXT] Bare domain "${baseDomain}" hit in production without ALLOW_BARE_DOMAIN_AS_MAIN_TENANT=true — refusing to map to MAIN_TENANT_ID.`,
      );
      return null;
    }
    return resolvePrimaryTenantContext();
  }

  const portalSubdomain = matchPortalSubdomain(normalizedHost);

  // Portal pelanggan memproses login sebelum ada sesi: belum ada cookie yang
  // membawa tenantId, jadi tenant hanya bisa diturunkan dari host. Host ini
  // adalah portal pelanggan milik tenant utama, sama seperti apex. Tanpa ini
  // pencarian pelanggan berjalan tanpa tenant context dan ekstensi Prisma
  // melemparkan TenantContextError — login membalas 500.
  if (portalSubdomain === CUSTOMER_PORTAL_SUBDOMAIN) {
    return resolvePrimaryTenantContext();
  }

  // Portal staf memakai sesi NextAuth; tenant-nya datang dari token, bukan
  // dari host. Fail-closed di sini supaya host tidak pernah jadi sumber
  // otoritas untuk mereka.
  if (portalSubdomain) {
    return null;
  }

  // Check if tenant slug subdomain: {slug}.radpro.id
  if (normalizedHost.endsWith(`.${baseDomain}`)) {
    const slug = normalizedHost.replace(`.${baseDomain}`, "");
    if (slug && !slug.includes(".")) {
      const tenantDomain = await prisma.tenantDomain.findUnique({
        where: { slug },
        select: { tenantId: true, status: true },
      });
      if (tenantDomain) {
        return { tenantId: tenantDomain.tenantId, isSuperAdmin: false };
      }
    }
  }

  // Check custom domain in TenantDomain table (status must be active)
  const tenantDomain = await prisma.tenantDomain.findFirst({
    where: { domain: normalizedHost, status: "active" },
    select: { tenantId: true },
  });
  if (tenantDomain) {
    return { tenantId: tenantDomain.tenantId, isSuperAdmin: false };
  }

  // Fallback: check legacy Tenant.domain field
  const tenant = await prisma.tenant.findFirst({
    where: { domain: normalizedHost, isActive: true },
    select: { id: true },
  });
  if (tenant) {
    return { tenantId: tenant.id, isSuperAdmin: false };
  }

  return null;
}

export interface TenantContextResult {
  tenantId: string | null;
  isSuperAdmin: boolean;
}

// Lazy-init AsyncLocalStorage — avoid static `node:async_hooks` import at
// top-level so this module is safe to include in client bundles (Next.js
// build fails when a node built-in leaks into the client chunk).
// ponytail: if async context is needed on the edge runtime, replace with
// `AsyncLocalStorage` from `next/dist/server/` or equivalent.
let requestTenantContextStorage: {
  run: <T>(
    store: TenantContextResult,
    callback: () => Promise<T>,
  ) => Promise<T>;
  getStore: () => TenantContextResult | undefined;
} | null = null;

function getRequestTenantContextStorage() {
  if (!requestTenantContextStorage) {
    // Lazily require async_hooks at runtime via createRequire — keeps
    // `node:async_hooks` out of the bundler's static analysis graph so
    // it never leaks into the client chunk.
    const nodeRequire = nodeCreateRequire(import.meta.url ?? __filename);
    const { AsyncLocalStorage } = nodeRequire("node:async_hooks") as {
      AsyncLocalStorage: new <T>() => {
        run: <R>(store: T, callback: () => Promise<R>) => Promise<R>;
        getStore: () => T | undefined;
      };
    };
    requestTenantContextStorage = new AsyncLocalStorage<TenantContextResult>();
  }
  return requestTenantContextStorage;
}

const requestHeadersTenantContextCache = new WeakMap<
  object,
  TenantContextResult
>();

export function runWithRequestTenantContext<T>(
  tenantContext: TenantContextResult,
  callback: () => Promise<T>,
): Promise<T> {
  return getRequestTenantContextStorage().run(tenantContext, callback);
}

/**
 * Eksplisit elevasi konteks untuk pekerjaan sistem (cron, monitor, bootstrap)
 * yang BUKAN berasal dari request user. Memberi `isSuperAdmin: true` sehingga
 * Prisma extension melewatkan tenant filter.
 *
 * Why: bypass otomatis berbasis flag global IS_CUSTOM_SERVER membuat setiap
 * Socket.IO handler atau handler request non-Next berjalan sebagai super admin —
 * potensi data leak antar tenant. Pemanggil yang sah HARUS memilih bypass
 * secara eksplisit dan disertai alasan untuk audit trail.
 *
 * How to apply: wrap kode bootstrap/loop yang perlu lihat semua tenant.
 * Untuk per-tenant operasi, prefer runWithRequestTenantContext({ tenantId, isSuperAdmin: false }).
 */
export function runAsSystemContext<T>(
  reason: string,
  callback: () => Promise<T>,
  options?: { silent?: boolean },
): Promise<T> {
  if (!options?.silent) {
    logger.info(`[TENANT_CONTEXT] System context elevated: ${reason}`);
  }
  return getRequestTenantContextStorage().run(
    { tenantId: null, isSuperAdmin: true },
    callback,
  );
}

function getCachedTenantContextForRequest(
  requestHeaders: unknown,
): TenantContextResult | null {
  if (!requestHeaders || typeof requestHeaders !== "object") {
    return null;
  }

  return requestHeadersTenantContextCache.get(requestHeaders) ?? null;
}

function cacheTenantContextForRequest(
  requestHeaders: unknown,
  tenantContext: TenantContextResult,
): TenantContextResult {
  if (requestHeaders && typeof requestHeaders === "object") {
    requestHeadersTenantContextCache.set(requestHeaders, tenantContext);
  }

  return tenantContext;
}

function resolvePrimaryTenantContext(): TenantContextResult {
  return {
    tenantId: MAIN_TENANT_ID,
    isSuperAdmin: false,
  };
}

/**
 * Pastikan tenant dari sesi user cocok dengan tenant dari host (subdomain /
 * custom domain). Jika user tenant A mengakses domain tenant B, kita tolak
 * akses dengan mengembalikan empty context — fail-closed di Prisma extension.
 *
 * Why: tanpa cross-check ini, request bisa berjalan dengan otoritas tenant
 * dari sesi user di domain tenant lain (confused deputy). Super admin
 * dikecualikan karena memang berhak lintas tenant.
 *
 * How to apply: dipanggil sebelum mengembalikan tenant context yang berasal
 * dari token/cookie (NextAuth, mobile JWT, investor, customer).
 */
async function enforceSessionHostMatch(
  sessionContext: TenantContextResult,
  requestHeaders: Headers | null,
): Promise<TenantContextResult> {
  if (sessionContext.isSuperAdmin) {
    return sessionContext;
  }

  if (!sessionContext.tenantId) {
    return sessionContext;
  }

  const hostContext = await resolveTenantContextFromHost(requestHeaders);
  if (!hostContext || !hostContext.tenantId) {
    return sessionContext;
  }

  if (hostContext.tenantId === sessionContext.tenantId) {
    return sessionContext;
  }

  logger.warn(
    `[TENANT_CONTEXT] Session/host mismatch: session tenant=${sessionContext.tenantId} host tenant=${hostContext.tenantId}. Rejecting request (fail-closed).`,
  );
  return { tenantId: null, isSuperAdmin: false };
}

function getAuthSecret(): Uint8Array {
  const rawSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!rawSecret) {
    throw new Error("NEXTAUTH_SECRET environment variable is required");
  }

  return new TextEncoder().encode(rawSecret);
}

/**
 * Safely get tenant context from request headers/cookies.
 * Handles both Web (NextAuth) and Mobile (JWT) authentication.
 * Gracefully fails when called outside of a request context (e.g. cron, startup).
 */
export async function getTenantIdFromContext(): Promise<TenantContextResult> {
  const cachedTenantContext = getRequestTenantContextStorage().getStore();
  if (cachedTenantContext) {
    return cachedTenantContext;
  }

  // Determine if we are running within a standard Next.js request lifecycle.
  // This helps distinguish between regular API calls and background/system tasks.
  let isNextRequest = false;
  let requestHeaders: Headers | null = null;
  try {
    const { headers } = await import("next/headers");
    if (headers) {
      requestHeaders = await headers();
      isNextRequest = true;
    }
  } catch (_e) {
    // Not in a Next.js App Router context.
  }

  const cachedRequestTenantContext =
    getCachedTenantContextForRequest(requestHeaders);
  if (cachedRequestTenantContext) {
    return cachedRequestTenantContext;
  }

  // If we are NOT in a standard Next.js request context (custom server entry
  // such as Socket.IO, internal cron, bootstrap), do NOT auto-elevate to
  // super admin. Caller harus eksplisit pakai runAsSystemContext() atau
  // runWithRequestTenantContext({ tenantId, ... }). Default = fail-closed
  // sehingga Prisma extension menolak akses tanpa konteks valid.
  const globalObj = globalThis as Record<string, unknown>;
  if (!isNextRequest && globalObj.IS_CUSTOM_SERVER) {
    logger.warn(
      "[TENANT_CONTEXT] Custom server call without explicit tenant context. Returning empty context (fail-closed). Wrap caller with runAsSystemContext() or runWithRequestTenantContext().",
    );
    return cacheTenantContextForRequest(requestHeaders, {
      tenantId: null,
      isSuperAdmin: false,
    });
  }

  try {
    // 1. Check for Mobile App Bearer Token first
    let authHeader: string | null = null;
    let cookieStore: unknown = null;

    if (isNextRequest) {
      try {
        const { headers } = await import("next/headers");
        const h = await headers();
        authHeader = h.get("authorization");
        cookieStore = h;
      } catch {
        // Failed to get headers despite being in Next request (shouldn't happen)
      }
    }

    // 1a. Cron internal bearer secret should bypass mobile JWT verification.
    //
    // `CRON_SECRET` opsional di `lib/env.ts`. Tanpa guard keberadaannya,
    // `Bearer ${undefined}` menjadi literal "Bearer undefined" sehingga siapa
    // pun yang mengirim header itu memperoleh konteks super admin lintas-tenant
    // di lapisan Prisma. Route cron sudah memakai pola `!cronSecret ||`; hanya
    // tempat ini yang tertinggal.
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return cacheTenantContextForRequest(requestHeaders, {
        tenantId: null,
        isSuperAdmin: true,
      });
    }

    // 1b. Mobile App Bearer Token logic
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token && token !== "null") {
        // Break circular dependency with relative import
        const { verifyMobileToken } = await import("./mobile-auth");
        const mobilePayload = await verifyMobileToken(token);
        if (mobilePayload) {
          const mp = mobilePayload as Record<string, unknown>;
          const sessionContext: TenantContextResult = {
            tenantId: (mp.tenantId as string) || null,
            isSuperAdmin: !!mp.isSuperAdmin,
          };
          return cacheTenantContextForRequest(
            requestHeaders,
            await enforceSessionHostMatch(sessionContext, requestHeaders),
          );
        }
      }
    }

    // 2. Web App NextAuth Session Token
    if (cookieStore) {
      try {
        // 2a. Check for regular NextAuth session
        const { NextRequest } = await import("next/server");
        const mockReq = new NextRequest("http://localhost", {
          headers: new Headers(cookieStore as HeadersInit),
        });

        const token = await getToken({
          req: mockReq,
          secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "",
        });

        if (token) {
          const isSuperAdmin =
            !!token.isSuperAdmin || isSuperAdminRole(token.role);
          const sessionContext: TenantContextResult = {
            tenantId: (token.tenantId as string) || null,
            isSuperAdmin,
          };
          return cacheTenantContextForRequest(
            requestHeaders,
            await enforceSessionHostMatch(sessionContext, requestHeaders),
          );
        }

        // 2b. Check for Investor Auth Cookie
        const { cookies } = await import("next/headers");
        const cs = await cookies();
        const secret = getAuthSecret();
        const investorToken = cs.get("investor_auth_token")?.value;
        if (investorToken) {
          try {
            const { payload } = await jwtVerify(investorToken, secret);
            if (payload && payload.tenantId) {
              const sessionContext: TenantContextResult = {
                tenantId: payload.tenantId as string,
                isSuperAdmin: false,
              };
              return cacheTenantContextForRequest(
                requestHeaders,
                await enforceSessionHostMatch(sessionContext, requestHeaders),
              );
            }
          } catch (err) {
            logger.error(
              "[TENANT_CONTEXT] Investor token verification failed:",
              err instanceof Error ? err.message : err,
            );
          }
        }

        // 2c. Check for Customer Auth Cookie
        const customerToken = cs.get("customer-token")?.value;
        if (customerToken) {
          try {
            const { payload } = await jwtVerify(customerToken, secret);
            const tenantId = (payload as { tenantId?: string }).tenantId;
            if (payload && tenantId) {
              const sessionContext: TenantContextResult = {
                tenantId,
                isSuperAdmin: false,
              };
              return cacheTenantContextForRequest(
                requestHeaders,
                await enforceSessionHostMatch(sessionContext, requestHeaders),
              );
            }
          } catch {
            // Silently ignore invalid customer tokens
          }
        }
      } catch {
        // NextRequest or getToken failed (probably non-next context)
      }
    }
  } catch (_e) {
    // Usually means it was called outside of a context
  }

  const hostTenantContext = await resolveTenantContextFromHost(requestHeaders);
  if (hostTenantContext) {
    return cacheTenantContextForRequest(requestHeaders, hostTenantContext);
  }

  return cacheTenantContextForRequest(requestHeaders, {
    tenantId: null,
    isSuperAdmin: false,
  });
}
