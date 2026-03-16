import { getToken } from 'next-auth/jwt'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { jwtVerify } from 'jose'

/**
 * Safely get tenant context from request headers/cookies.
 * Handles both Web (NextAuth) and Mobile (JWT) authentication.
 * Gracefully fails when called outside of a request context (e.g. cron, startup).
 */
export async function getTenantIdFromContext(): Promise<{ tenantId: string | null, isSuperAdmin: boolean }> {
  // Determine if we are running within a standard Next.js request lifecycle.
  // This helps distinguish between regular API calls and background/system tasks.
  let isNextRequest = false;
  try {
    const { headers } = await import('next/headers');
    await headers();
    isNextRequest = true;
  } catch (_e) {
    // Not in a Next.js App Router context.
  }

  // If we are NOT in a standard Next.js request context BUT we are running via the
  // custom server (e.g. WebSocket handshake, cron jobs, etc.), we return isSuperAdmin: true.
  // This allows these internal/system operations to bypass automatic isolation filters.
  if (!isNextRequest && (globalThis as Record<string, unknown>).IS_CUSTOM_SERVER) {
    return { tenantId: null, isSuperAdmin: true };
  }

  try {
    // 1. Check for Mobile App Bearer Token first
    let authHeader: string | null = null;
    let cookieStore: unknown = null;

    try {
      const { headers } = await import('next/headers');
      const h = await headers();
      authHeader = h.get('authorization');
      cookieStore = h; 
    } catch {
      // Not in a Next.js App Router context - skip headers-based detection
    }
    
    // 1a. Mobile App Bearer Token logic
    if (authHeader?.startsWith('Bearer ')) {
       const token = authHeader.split(' ')[1]
       if (token && token !== 'null') {
         const mobilePayload = await verifyMobileToken(token)
         if (mobilePayload) {
            const mp = mobilePayload as Record<string, unknown>
            return { 
              tenantId: (mp.tenantId as string) || null, 
              isSuperAdmin: !!mp.isSuperAdmin 
            }
         }
       }
    }

    // 2. Web App NextAuth Session Token
    if (cookieStore) {
      try {
        // 2a. Check for regular NextAuth session
        const { NextRequest } = await import('next/server');
        const mockReq = new NextRequest('http://localhost', { headers: new Headers(cookieStore as HeadersInit) });
        
        const token = await getToken({
          req: mockReq,
          secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ''
        });

        if (token) {
          const isSuperAdmin = !!token.isSuperAdmin || token.role === 'SUPER_ADMIN' || token.role === 'Super Admin'
          return { 
            tenantId: (token.tenantId as string) || null,
            isSuperAdmin
          };
        }

        // 2b. Check for Investor Auth Cookie
        const { cookies } = await import('next/headers')
        const cs = await cookies()
        const investorToken = cs.get('investor_auth_token')?.value
        if (investorToken) {
          console.log('[TENANT_CONTEXT] Investor token found in cookies')
          const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'fallback-secret-for-dev')
          try {
            const { payload } = await jwtVerify(investorToken, secret)
            if (payload && payload.tenantId) {
              console.log(`[TENANT_CONTEXT] Investor tenantId detected: ${payload.tenantId}`)
              return { 
                tenantId: payload.tenantId as string,
                isSuperAdmin: false 
              }
            }
          } catch (err) {
            console.error('[TENANT_CONTEXT] Investor token verification failed:', err instanceof Error ? err.message : err)
          }
        }
      } catch {
        // NextRequest or getToken failed (probably non-next context)
      }
    }
  } catch(_e) { 
    // Usually means it was called outside of a context
  }
  
  return { tenantId: null, isSuperAdmin: false };
}
