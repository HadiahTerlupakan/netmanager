import _NextAuth from 'next-auth'
import type { NextAuthOptions, Session } from 'next-auth'

// Fix for default import interop in tsx/ESM
const NextAuth = (_NextAuth as { default?: unknown }).default as typeof _NextAuth || _NextAuth
import _CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prismaAuth } from '@/lib/prisma'
import { getUserRepository } from '@/lib/repositories'
import { compare } from 'bcryptjs'
import { checkRateLimit } from '@/lib/redis'
import { redis } from '@/lib/redis'

// Fix for default import interop in tsx/ESM
const CredentialsProvider = (_CredentialsProvider as { default?: unknown }).default as typeof _CredentialsProvider || _CredentialsProvider

// Database connection validation
async function validateDatabaseConnection(): Promise<boolean> {
  try {
    console.log('[AUTH] Validating database connection...')
    console.log('[AUTH] ENV check:', {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN
    })
    await prismaAuth.$queryRaw`SELECT 1`
    console.log('[AUTH] Database connection: OK')
    return true
  } catch (error) {
    console.error('[AUTH] Database connection failed:', error)
    return false
  }
}

// Redis connection validation
async function validateRedisConnection(): Promise<boolean> {
  try {
    console.log('[AUTH] Validating Redis connection...')
    await redis.ping()
    console.log('[AUTH] Redis connection: OK')
    return true
  } catch (error) {
    console.error('[AUTH] Redis connection failed:', error)
    return false
  }
}

// Auth configuration with credentials provider only
export const authConfig: NextAuthOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(prismaAuth as any) as NextAuthOptions['adapter'],
  // IMPORTANT: Secret is required for JWT signing
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || '',
  // Enable debug mode in development
  debug: process.env.NODE_ENV === 'development',
  session: {
    strategy: 'jwt', // Use JWT for sessions
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '604800'), // 7 days (default)
    updateAge: parseInt(process.env.SESSION_UPDATE_AGE || '1800'), // 30 minutes (sliding expiration)
  },
  // Configure cookies for cross-subdomain support
  cookies: {
    sessionToken: {
      // Untuk HTTPS production, gunakan __Secure- prefix
      name: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://')
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://'),
        domain: process.env.COOKIE_DOMAIN === 'localhost' ? undefined : process.env.COOKIE_DOMAIN
      }
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://')
        ? `__Secure-next-auth.callback-url`
        : `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://'),
        domain: process.env.COOKIE_DOMAIN === 'localhost' ? undefined : process.env.COOKIE_DOMAIN
      }
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://')
        ? `__Host-next-auth.csrf-token`
        : `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://'),
        // CSRF token uses __Host- prefix which doesn't allow domain
      }
    }
  },
  pages: {
    signIn: '/admin/login',
    error: '/error',
  },
  providers: [
    // Credentials Provider (for email/password login)
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Email', type: 'text' },
        email: { label: 'Email', type: 'email' },
        identifier: { label: 'Identifier', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Record<string, string> | undefined) {
        try {
          // Support 'identifier', 'email', or 'username' fields
          const creds = credentials as Record<string, string> | undefined
          const identifier = (creds?.identifier || creds?.username || creds?.email)?.toLowerCase().trim()
          const password = creds?.password ?? ''

          console.log('[AUTH] Login attempt with identifier:', identifier?.substring(0, 3) + '***')

          if (!identifier || !password) {
            console.log('[AUTH] Missing identifier or password')
            return null
          }

          // Validate database connection before proceeding
          const dbConnected = await validateDatabaseConnection()
          if (!dbConnected) {
            console.error('[AUTH] Database connection failed during login attempt')
            throw new Error('Koneksi database gagal. Silakan coba lagi beberapa saat.')
          }

          // Validate Redis connection for rate limiting
          // Only apply rate limiting in production (opt-out via DISABLE_RATE_LIMIT=true)
          const rateLimitEnabled = process.env.NODE_ENV !== 'production' ? false : process.env.DISABLE_RATE_LIMIT !== 'true'
          if (rateLimitEnabled) {
            const redisConnected = await validateRedisConnection()
            if (redisConnected) {
              // Rate limit percobaan login per identifier (mis. 500x per 5 menit untuk dev)
              const allowed = await checkRateLimit(`login:${identifier}`, 500, 300)
              if (!allowed) {
                console.log('[AUTH] Rate limit exceeded for:', identifier)
                throw new Error('Terlalu banyak percobaan. Coba lagi nanti.')
              }
            }
          }

          const userRepository = getUserRepository()
          let user = null

          // Login with email
          console.log('[AUTH] Attempting email login')
          user = await userRepository.findByEmail(identifier)
          console.log('[AUTH] User found by email:', !!user)

          if (!user) {
            console.log('[AUTH] No user found for identifier:', identifier)
            return null
          }

          // Verify password
          console.log('[AUTH] Verifying password...')
          const ok = await compare(password, user.passwordHash ?? '')
          console.log('[AUTH] Password valid:', ok)

          if (!ok) {
            console.log('[AUTH] Password mismatch')
            return null
          }

          // Strict Portal Access Control
          const portal = creds?.portal
          if (portal) {
            console.log(`[AUTH] Checking access for portal: ${portal}`)
            const userWithRole = await prismaAuth.user.findUnique({
              where: { id: user.id },
              include: { role: true }
            })

            const role = userWithRole?.role

            // Super Admin bypass
            if (role?.name === 'SUPER_ADMIN' || role?.name === 'Super Admin') {
              console.log('[AUTH] SUPER_ADMIN access granted')
            } else {
              if (portal === 'admin' && !role?.accessAdminPanel) {
                console.warn('[AUTH] Access denied: User tried to access ADMIN portal without permission')
                throw new Error('Akses ditolak. Anda tidak memiliki izin untuk mengakses Portal Admin.')
              }

              if (portal === 'employee' && !role?.accessEmployeePanel) {
                console.warn('[AUTH] Access denied: User tried to access EMPLOYEE portal without permission')
                throw new Error('Akses ditolak. Anda tidak memiliki izin untuk mengakses Portal Karyawan.')
              }
            }
          }

          console.log('[AUTH] Login successful for:', user.email)

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          } as unknown as import('next-auth').User
        } catch (error) {
          console.error('[AUTH] Error in authorize:', error)
          throw error
        }
      },
    }),
  ],
  callbacks: {
    async signIn() {
      // Only credentials login is allowed
      return true
    },

    async jwt({ token, user, trigger, session: _session }) {
      // Initial sign in
      if (user) {
        token.id = user.id

        // Fetch role and permissions from DB
        try {
          const dbUser = await prismaAuth.user.findUnique({
            where: { id: user.id },
            include: {
              role: {
                include: {
                  permission: true
                }
              },
              departments: true, // Include department details
              userSites: {       // Multi-site support
                include: { site: true },
                orderBy: { isPrimary: 'desc' } // Primary site first
              },
              tenant: true // Include tenant details
            }
          })

          token.name = dbUser?.name
          token.email = dbUser?.email
          token.picture = dbUser?.image
          token.tokenVersion = dbUser?.tokenVersion ?? 0

          token.role = dbUser?.role?.name || 'USER'
          token.accessAdminPanel = dbUser?.role?.accessAdminPanel ?? false
          token.accessEmployeePanel = dbUser?.role?.accessEmployeePanel ?? false
          token.isSuperAdmin = dbUser?.role?.isSuperAdmin ?? false
          token.canApproveRab = (dbUser?.role as unknown as { canApproveRab?: boolean })?.canApproveRab ?? false
          // IMPORTANT: Don't store permissions in token to reduce cookie size
          // Permissions will be loaded at runtime when needed
          // token.permissions = dbUser?.role?.permission.map(p => `${p.resource}:${p.action}`) || []
          token.permissionsCount = dbUser?.role?.permission.length || 0

          // Store department detail
          token.departmentName = dbUser?.departments?.name
          token.isSales = dbUser?.isSales ?? false

          // Handle SUPER_ADMIN special case - they should have access to everything
          if (token.isSuperAdmin || token.role === 'SUPER_ADMIN' || token.role === 'Super Admin') {
            token.accessAdminPanel = true
            token.accessEmployeePanel = true
            token.isSuperAdmin = true
          }

          // Multi-site support
          const userSites = dbUser?.userSites || []
          token.siteIds = userSites.map(us => us.siteId)
          token.primarySiteId = userSites.find(us => us.isPrimary)?.siteId || userSites[0]?.siteId || null

          // Legacy support - keep siteId for backward compatibility
          token.departmentId = dbUser?.departmentId
          token.siteId = token.primarySiteId || dbUser?.siteId // Prefer primary site
          token.tenantId = dbUser?.tenantId || null
          token.tenantName = dbUser?.tenant?.name || null

          // Token version for force logout feature
          token.tokenVersion = dbUser?.tokenVersion ?? 0

          console.log('[AUTH JWT] Token initialized:', {
            id: token.id,
            role: token.role,
            department: token.departmentName,
            accessAdmin: token.accessAdminPanel,
            accessEmployee: token.accessEmployeePanel,
            permissionsCount: token.permissionsCount,
            siteCount: (token.siteIds as string[] | undefined)?.length || 0,
            primarySiteId: token.primarySiteId
          })
        } catch (error) {
          console.error('[AUTH JWT] Error fetching user role:', error)
          token.role = 'USER'
          token.accessAdminPanel = false
          token.accessEmployeePanel = false
          token.permissionsCount = 0
        }
      }

      // Handle session updates
      if (trigger === 'update') {
        const dbUser = await prismaAuth.user.findUnique({
          where: { id: token.id as string },
          include: {
            role: {
              include: {
                permission: true
              }
            },
            departments: true,
            userSites: {  // Multi-site support
              include: { site: true },
              orderBy: { isPrimary: 'desc' }
            },
            tenant: true
          }
        })

        if (dbUser) {
          token.siteId = token.primarySiteId || dbUser.siteId // Legacy: prefer primary site
          token.tenantId = dbUser.tenantId || null
          token.tenantName = dbUser.tenant?.name || null

          token.role = dbUser.role?.name || 'USER'
          token.accessAdminPanel = dbUser.role?.accessAdminPanel ?? false
          token.accessEmployeePanel = dbUser.role?.accessEmployeePanel ?? false
          token.isSuperAdmin = dbUser.role?.isSuperAdmin ?? false
          token.canApproveRab = (dbUser.role as unknown as { canApproveRab?: boolean })?.canApproveRab ?? false

          if (token.isSuperAdmin || token.role === 'SUPER_ADMIN' || token.role === 'Super Admin') {
            token.accessAdminPanel = true
            token.accessEmployeePanel = true
            // Ensure flag is set for legacy string roles
            token.isSuperAdmin = true
          }

          // Don't store permissions in token to reduce cookie size
          token.permissionsCount = dbUser.role?.permission.length || 0
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        // Validate tokenVersion against database (Force Logout feature)
        // OPTIMIZED: Cache session data in Redis to avoid DB query on every request
        try {
          const userId = token.id as string;
          const sessionCacheKey = `session:${userId}`;
          const SESSION_CACHE_TTL = 30; // 30 seconds - balance between freshness and performance

          // Try Redis cache first
          let dbUser: {
            tokenVersion: number;
            isActive: boolean;
            role: {
              name: string;
              accessAdminPanel: boolean;
              accessEmployeePanel: boolean;
              isSuperAdmin: boolean;
              canApproveRab?: boolean;
              permission: { id: string }[];
            } | null;
            departments: { name: string } | null;
            isSales: boolean;
            siteId: string | null;
            tenantId: string | null;
            tenant: { name: string } | null;
            userSites: { siteId: string }[];
          } | null = null;

          try {
            const cached = await redis.get(sessionCacheKey);
            if (cached) {
              dbUser = JSON.parse(cached);
            }
          } catch {
            // Cache read failed - continue to database (fail-open for performance)
          }

          // Cache miss - fetch from database
          if (!dbUser) {
            dbUser = await prismaAuth.user.findUnique({
              where: { id: userId },
              select: {
                tokenVersion: true,
                isActive: true,
                role: {
                  select: {
                    name: true,
                    accessAdminPanel: true,
                    accessEmployeePanel: true,
                    isSuperAdmin: true,
                    canApproveRab: true,
                    permission: { select: { id: true } } // Just count
                  }
                },
                departments: { select: { name: true } },
                isSales: true,
                siteId: true,
                tenantId: true,
                tenant: { select: { name: true } },
                userSites: {
                  where: { isPrimary: true },
                  select: { siteId: true },
                  take: 1
                }
              }
            }) as unknown as typeof dbUser;

            // Cache the result in Redis (non-blocking)
            if (dbUser) {
              try {
                await redis.setex(sessionCacheKey, SESSION_CACHE_TTL, JSON.stringify(dbUser));
              } catch {
                // Cache write failed - continue without caching
              }
            }
          }

          // If user doesn't exist, is inactive, or token version mismatch - invalidate session
          if (!dbUser || !dbUser.isActive) {
            console.log(`[AUTH SESSION] User ${token.id} not found or inactive. Invalidating session.`);
            return { ...session, user: undefined as unknown as Session['user'], expires: new Date(0).toISOString() };
          }

          const tokenVersion = (token.tokenVersion as number) ?? 0;
          if (dbUser.tokenVersion > tokenVersion) {
            console.log(`[AUTH SESSION] Token version mismatch for user ${token.id}. DB: ${dbUser.tokenVersion}, Token: ${tokenVersion}. Forcing logout.`);
            // Invalidate cache to ensure next check hits DB
            try { await redis.del(sessionCacheKey); } catch { /* ignore */ }
            return { ...session, user: undefined as unknown as Session['user'], expires: new Date(0).toISOString() };
          }

          // REFRESH SESSION DATA FROM DB (or cache)
          // This ensures that role changes take effect within SESSION_CACHE_TTL seconds
          const sessionUser = session.user as Record<string, unknown>;
          sessionUser.id = token.id;

          // Use fresh data from DB/cache
          const roleName = dbUser.role?.name || 'USER';
          const isSuperAdmin = dbUser.role?.isSuperAdmin || roleName === 'SUPER_ADMIN' || roleName === 'Super Admin';

          sessionUser.role = roleName;
          sessionUser.isSuperAdmin = isSuperAdmin;
          sessionUser.tenantId = dbUser.tenantId || null; // SINGLE SOURCE OF TRUTH

          // If Super Admin, force enable access
          if (isSuperAdmin) {
            sessionUser.accessAdminPanel = true;
            sessionUser.accessEmployeePanel = true;
            sessionUser.canApproveRab = true;
          } else {
            sessionUser.accessAdminPanel = dbUser.role?.accessAdminPanel ?? false;
            sessionUser.accessEmployeePanel = dbUser.role?.accessEmployeePanel ?? false;
            sessionUser.canApproveRab = dbUser.role?.canApproveRab ?? false;
          }

          // Don't include permissions in session - they will be loaded at runtime
          sessionUser.permissionsCount = dbUser.role?.permission.length || 0;
          sessionUser.departmentId = token.departmentId; // Keep from token
          sessionUser.departmentName = dbUser.departments?.name;

          // Handle Site ID
          const primarySiteId = dbUser.userSites?.[0]?.siteId || dbUser.siteId;
          sessionUser.siteId = primarySiteId;
          sessionUser.primarySiteId = primarySiteId;
          sessionUser.siteIds = token.siteIds; // Keep array from token
          sessionUser.tenantName = dbUser.tenant?.name || null;

          sessionUser.isSales = dbUser.isSales;

          // Debugging Session Creation
          if (process.env.NODE_ENV === 'development') {
            console.log(`[AUTH SESSION] Session created for ${sessionUser.email}. Tenant: ${sessionUser.tenantId}, isSuper: ${sessionUser.isSuperAdmin}`);
          }

        } catch (error) {
          console.error('[AUTH SESSION] Error validating tokenVersion:', error);
          // SECURITY: Fail-closed - invalidate session on validation error
          console.warn('[AUTH SESSION] SECURITY: Invalidating session due to validation error');
          return { ...session, user: undefined as unknown as Session['user'], expires: new Date(0).toISOString() };
        }
      }
      return session
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      // Dynamic import to avoid circular dependencies if necessary
      const { logger } = await import('@/lib/logger')

      // Fetch user role for more detailed logging
      let roleName = 'Unknown'
      let portal = 'Unknown'
      try {
        const dbUser = await prismaAuth.user.findUnique({
          where: { id: user.id },
          include: { role: true }
        })
        roleName = dbUser?.role?.name || 'No Role'
        portal = dbUser?.role?.accessAdminPanel ? 'Admin Portal' :
          dbUser?.role?.accessEmployeePanel ? 'Employee Portal' : 'Unknown'

        // Update lastLoginAt
        await prismaAuth.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })
      } catch (e) {
        console.error('[AUTH] Failed to fetch user role for logging:', e)
      }

      await logger.logAuth({
        action: 'LOGIN',
        userId: user.id,
        details: {
          email: user.email,
          name: user.name || 'N/A',
          role: roleName,
          portal: portal,
          provider: account?.provider || 'credentials',
          isNewUser: isNewUser || false,
          loginTime: new Date().toISOString()
        }
      })
    }
  },
}

// createAuthConfig is simplified - just returns authConfig
export async function createAuthConfig(): Promise<NextAuthOptions> {
  return authConfig
}

// Export authOptions for NextAuth API route
export const authOptions = authConfig

export const handler = NextAuth(authConfig)

// Helper function for API route authentication
import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { verifyMobileToken } from '@/lib/mobile-auth'

export interface UserSession {
  id: string
  email: string
  name: string | null
  tenantId: string | null
  role: string | undefined
  departmentId: string | undefined
  /** @deprecated Use siteIds for multi-site */
  siteId: string | undefined
  /** Multi-site: Array of site IDs */
  siteIds: string[]
  /** Multi-site: Primary site ID */
  primarySiteId: string | undefined
  permissions: string[] | undefined
  isSuperAdmin?: boolean
  canApproveRab?: boolean
}

export async function verifyAuth(request: NextRequest): Promise<UserSession | null> {
  try {
    // 1. Check for Bearer token (Mobile)
    const authHeader = request.headers.get('Authorization')
    console.log('[AUTH_VERIFY] Authorization header:', authHeader ? (authHeader.substring(0, 15) + '...') : 'Missing')

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      if (token === 'null' || !token) {
        console.warn('[AUTH_VERIFY] Bearer token is literal "null" or empty')
        return null
      }

      const mobilePayload = await verifyMobileToken(token)

      if (mobilePayload) {
        console.log('[AUTH_VERIFY] Mobile token verified for:', mobilePayload.email)
        const mp = mobilePayload as Record<string, unknown>
        return {
          id: mobilePayload.userId,
          email: mobilePayload.email as string,
          name: mobilePayload.name as string | null,
          tenantId: (mp.tenantId as string | null) || null,
          role: mobilePayload.role as string | undefined,
          departmentId: mp.departmentId as string | undefined,
          siteId: (mp.primarySiteId || mp.siteId) as string | undefined,
          siteIds: (mp.siteIds as string[]) || (mp.siteId ? [mp.siteId as string] : []),
          primarySiteId: mp.primarySiteId as string | undefined,
          permissions: mp.permissions as string[] | undefined,
          isSuperAdmin: mobilePayload.isSuperAdmin as boolean | undefined,
          canApproveRab: mobilePayload.canApproveRab as boolean | undefined
        }
      } else {
        console.warn('[AUTH_VERIFY] Mobile token verification failed')
      }
    }

    // 2. Check for NextAuth token (Web)
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ''
    })

    if (!token) {
      console.log('[AUTH_VERIFY] No valid session or Bearer token found')
      return null
    }

    return {
      id: (token.id as string) || '',
      email: (token.email as string) || '',
      name: (token.name as string) || null,
      tenantId: (token.tenantId as string | null) || null,
      role: token.role as string | undefined,
      departmentId: token.departmentId as string | undefined,
      siteId: token.siteId as string | undefined,
      siteIds: (token.siteIds as string[]) || (token.siteId ? [token.siteId as string] : []),
      primarySiteId: token.primarySiteId as string | undefined,
      permissions: token.permissions as string[] | undefined,
      isSuperAdmin: (token.isSuperAdmin as boolean) || false,
      canApproveRab: (token.canApproveRab as boolean) || false
    }
  } catch (error) {
    console.error('[AUTH_VERIFY] Error verifying auth:', error)
    return null
  }
}

// ============================================================================
// Permission Caching Configuration
// ============================================================================
const PERMISSION_CACHE_TTL = 300 // 5 minutes cache TTL
const PERMISSION_CACHE_PREFIX = 'permissions:'

// Helper function to load permissions from database at runtime
// This is used instead of storing permissions in JWT to reduce cookie size
// Includes Redis caching for performance optimization
export async function getUserPermissions(userId: string): Promise<string[]> {
  const cacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`
  const isDebug = process.env.NEXTAUTH_DEBUG === 'true'

  // Try cache first (skip if debug enabled to allow instant testing)
  if (!isDebug) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        const perms = JSON.parse(cached)
        if (perms.length > 0) {
          return perms
        }
      }
    } catch (e) {
      console.warn('[AUTH] Redis cache read error, falling back to DB:', e)
    }
  } else {
    // console.log('[AUTH] Debug mode enabled, skipping permission cache lookup', { userId })
  }

  // Load from database
  try {
    const user = await prismaAuth.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permission: true
          }
        }
      }
    })

    // console.log('[AUTH DB] Found user for permissions check:', { 
    //   id: userId, 
    //   email: user?.email, 
    //   role: user?.role?.name,
    //   permissionsInDb: user?.role?.permission?.length || 0 
    // })

    // Check for Super Admin status at the database level
    // This provides a failsafe if session flags are missing
    if (user?.role?.isSuperAdmin || user?.role?.name === 'SUPER_ADMIN' || user?.role?.name === 'Super Admin') {
      const allPermissions = ['*']; // Wildcard permission

      // Cache permissions (non-blocking)
      try {
        await redis.setex(cacheKey, PERMISSION_CACHE_TTL, JSON.stringify(allPermissions))
      } catch (e) {
        console.warn('[AUTH] Redis cache write error:', e)
      }
      return allPermissions;
    }

    if (!user?.role?.permission || user.role.permission.length === 0) {
      console.warn('[AUTH] User has no permissions in database', { userId, role: user?.role?.name })
      return []
    }

    const validPermissions = user.role.permission;

    const permissions = validPermissions.map(p => `${p.resource}:${p.action}`)

    // Cache permissions (non-blocking)
    try {
      await redis.setex(cacheKey, PERMISSION_CACHE_TTL, JSON.stringify(permissions))
      console.log('[AUTH] Permissions cached from database', { userId, count: permissions.length })
    } catch (e) {
      // Cache write failed - continue without caching
      console.warn('[AUTH] Redis cache write error:', e)
    }

    return permissions
  } catch (error) {
    console.error('[AUTH] Error loading permissions:', error)
    return []
  }
}

/**
 * Invalidate permission cache for a user
 * Should be called when:
 * - User's role is changed
 * - Role permissions are updated
 * - User is deactivated
 */
export async function invalidatePermissionCache(userId: string): Promise<void> {
  const permCacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`
  const sessionCacheKey = `session:${userId}`
  try {
    await redis.del(permCacheKey, sessionCacheKey)
    console.debug('[AUTH] Permission + session cache invalidated', { userId })
  } catch (e) {
    console.warn('[AUTH] Failed to invalidate caches:', e)
  }
}

/**
 * Invalidate permission cache for all users with a specific role
 * Should be called when role permissions are updated
 */
export async function invalidateRolePermissionCache(roleId: string): Promise<void> {
  try {
    // Find all users with this role and invalidate their cache
    const users = await prismaAuth.user.findMany({
      where: { roleId },
      select: { id: true }
    })

    const invalidationPromises = users.map(user =>
      invalidatePermissionCache(user.id)
    )

    await Promise.all(invalidationPromises)
    console.debug('[AUTH] Role permission cache invalidated', { roleId, userCount: users.length })
  } catch (e) {
    console.warn('[AUTH] Failed to invalidate role permission cache:', e)
  }
}

// Check if user has specific permission
export async function hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  
  // Support wildcard for Super Admin
  if (permissions.includes('*')) return true
  
  const permissionKey = `${resource}:${action}`
  return permissions.includes(permissionKey)
}

/**
 * Check if a user role is SUPER_ADMIN
 * Centralized logic to prevent hardcoded string issues
 */
export function isSuperAdmin(user: { role?: string | null; isSuperAdmin?: boolean } | undefined | null): boolean {
  if (!user) return false
  // Check the boolean flag first (new schema)
  if (user.isSuperAdmin === true) return true

  // Fallback to legacy string check
  if (!user.role) return false
  return user.role === 'SUPER_ADMIN' || user.role === 'Super Admin'
}