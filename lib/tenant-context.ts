import { AsyncLocalStorage } from "node:async_hooks";
import { getToken } from "next-auth/jwt";
import { jwtVerify } from "jose";
import { prisma } from "@/modules/database";
import { MAIN_TENANT_ID } from "@/modules/mitra/services/tenant-constants";

export interface TenantContextResult {
  tenantId: string | null;
  isSuperAdmin: boolean;
}

const requestTenantContextStorage =
  new AsyncLocalStorage<TenantContextResult>();
const requestHeadersTenantContextCache = new WeakMap<
  object,
  TenantContextResult
>();

export function runWithRequestTenantContext<T>(
  tenantContext: TenantContextResult,
  callback: () => Promise<T>,
): Promise<T> {
  return requestTenantContextStorage.run(tenantContext, callback);
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

async function resolveTenantContextFromHost(
  requestHeaders: Headers | null,
): Promise<TenantContextResult | null> {
  const host =
    requestHeaders?.get("x-forwarded-host") || requestHeaders?.get("host");
  const normalizedHost = host?.split(":")[0]?.trim().toLowerCase();

  if (!normalizedHost) {
    return null;
  }

  if (normalizedHost === "localhost") {
    return resolvePrimaryTenantContext();
  }

  const tenant = await prisma.tenant.findFirst({
    where: {
      domain: normalizedHost,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!tenant) {
    return null;
  }

  return {
    tenantId: tenant.id,
    isSuperAdmin: false,
  };
}

/**
 * Safely get tenant context from request headers/cookies.
 * Handles both Web (NextAuth) and Mobile (JWT) authentication.
 * Gracefully fails when called outside of a request context (e.g. cron, startup).
 */
export async function getTenantIdFromContext(): Promise<TenantContextResult> {
  const cachedTenantContext = requestTenantContextStorage.getStore();
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

  // If we are NOT in a standard Next.js request context BUT we are running via the
  // custom server (e.g. WebSocket handshake, cron jobs, etc.), we return isSuperAdmin: true.
  // This allows these internal/system operations to bypass automatic isolation filters.
  const globalObj = globalThis as Record<string, unknown>;
  if (!isNextRequest && globalObj.IS_CUSTOM_SERVER) {
    return cacheTenantContextForRequest(requestHeaders, {
      tenantId: null,
      isSuperAdmin: true,
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
    if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
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
          return cacheTenantContextForRequest(requestHeaders, {
            tenantId: (mp.tenantId as string) || null,
            isSuperAdmin: !!mp.isSuperAdmin,
          });
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
            !!token.isSuperAdmin ||
            token.role === "SUPER_ADMIN" ||
            token.role === "Super Admin";
          return cacheTenantContextForRequest(requestHeaders, {
            tenantId: (token.tenantId as string) || null,
            isSuperAdmin,
          });
        }

        // 2b. Check for Investor Auth Cookie
        const { cookies } = await import("next/headers");
        const cs = await cookies();
        const investorToken = cs.get("investor_auth_token")?.value;
        if (investorToken) {
          const rawSecret =
            process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
          if (!rawSecret)
            throw new Error("NEXTAUTH_SECRET environment variable is required");
          const secret = new TextEncoder().encode(rawSecret);
          try {
            const { payload } = await jwtVerify(investorToken, secret);
            if (payload && payload.tenantId) {
              return cacheTenantContextForRequest(requestHeaders, {
                tenantId: payload.tenantId as string,
                isSuperAdmin: false,
              });
            }
          } catch (err) {
            console.error(
              "[TENANT_CONTEXT] Investor token verification failed:",
              err instanceof Error ? err.message : err,
            );
          }
        }

        // 2c. Check for Customer Auth Cookie
        const customerToken = cs.get("customer-token")?.value;
        if (customerToken) {
          const rawSecret =
            process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
          if (!rawSecret)
            throw new Error("NEXTAUTH_SECRET environment variable is required");
          const secret = new TextEncoder().encode(rawSecret);
          try {
            const { payload } = await jwtVerify(customerToken, secret);
            const tenantId = (payload as { tenantId?: string }).tenantId;
            if (payload && tenantId) {
              return cacheTenantContextForRequest(requestHeaders, {
                tenantId,
                isSuperAdmin: false,
              });
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
