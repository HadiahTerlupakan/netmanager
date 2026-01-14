import _NextAuth from 'next-auth'
import type { NextAuthOptions } from 'next-auth'

// Fix for default import interop in tsx/ESM
const NextAuth = (_NextAuth as any).default || _NextAuth
import _CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { getUserRepository } from '@/lib/repositories'
import { compare } from 'bcryptjs'
import { checkRateLimit } from '@/lib/redis'
import { redis } from '@/lib/redis'

// Fix for default import interop in tsx/ESM
const CredentialsProvider = (_CredentialsProvider as any).default || _CredentialsProvider

// Database connection validation
async function validateDatabaseConnection(): Promise<boolean> {
  try {
    console.log('[AUTH] Validating database connection...')
    console.log('[AUTH] ENV check:', {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN
    })
    await prisma.$queryRaw`SELECT 1`
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
  adapter: PrismaAdapter(prisma) as any,
  // IMPORTANT: Secret is required for JWT signing
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
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
            throw new Error('Database connection error. Please try again later.')
          }

          // Validate Redis connection for rate limiting
          const redisConnected = await validateRedisConnection()
          if (!redisConnected) {
            console.warn('[AUTH] Redis connection failed, proceeding without rate limiting')
          } else {
            // Rate limit percobaan login per identifier (mis. 500x per 5 menit untuk dev)
            const allowed = await checkRateLimit(`login:${identifier}`, 500, 300)
            if (!allowed) {
              console.log('[AUTH] Rate limit exceeded for:', identifier)
              throw new Error('Terlalu banyak percobaan. Coba lagi nanti.')
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
            const userWithRole = await prisma.user.findUnique({
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
          } as any
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

    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id

        // Fetch role and permissions from DB
        try {
          const dbUser = await prisma.user.findUnique({
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
              }
            }
          })

          token.role = dbUser?.role?.name || 'USER'
          token.accessAdminPanel = dbUser?.role?.accessAdminPanel ?? false
          token.accessEmployeePanel = dbUser?.role?.accessEmployeePanel ?? false
          // IMPORTANT: Don't store permissions in token to reduce cookie size
          // Permissions will be loaded at runtime when needed
          // token.permissions = dbUser?.role?.permission.map(p => `${p.resource}:${p.action}`) || []
          token.permissionsCount = dbUser?.role?.permission.length || 0
          
          // Store department detail
          token.departmentName = dbUser?.departments?.name
          token.isSales = dbUser?.isSales ?? false

          // Handle SUPER_ADMIN special case - they should have access to everything
          if (token.role === 'SUPER_ADMIN' || token.role === 'Super Admin') {
            token.accessAdminPanel = true
            token.accessEmployeePanel = true
          }

          // Multi-site support
          const userSites = dbUser?.userSites || []
          token.siteIds = userSites.map(us => us.siteId)
          token.primarySiteId = userSites.find(us => us.isPrimary)?.siteId || userSites[0]?.siteId || null
          
          // Legacy support - keep siteId for backward compatibility
          token.departmentId = dbUser?.departmentId
          token.siteId = token.primarySiteId || dbUser?.siteId // Prefer primary site
          
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
        const dbUser = await prisma.user.findUnique({
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
            }
          }
        })

        if (dbUser) {
          token.name = dbUser.name
          token.email = dbUser.email
          token.picture = dbUser.image
          token.departmentId = dbUser.departmentId
          token.departmentName = dbUser.departments?.name
          token.tokenVersion = dbUser.tokenVersion ?? 0
          token.isSales = dbUser.isSales ?? false

          // Multi-site support
          const userSites = dbUser.userSites || []
          token.siteIds = userSites.map(us => us.siteId)
          token.primarySiteId = userSites.find(us => us.isPrimary)?.siteId || userSites[0]?.siteId || null
          token.siteId = token.primarySiteId || dbUser.siteId // Legacy: prefer primary site

          token.role = dbUser.role?.name || 'USER'
          token.accessAdminPanel = dbUser.role?.accessAdminPanel ?? false
          token.accessEmployeePanel = dbUser.role?.accessEmployeePanel ?? false

          if (token.role === 'SUPER_ADMIN' || token.role === 'Super Admin') {
            token.accessAdminPanel = true
            token.accessEmployeePanel = true
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
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { tokenVersion: true, isActive: true }
          });

          // If user doesn't exist, is inactive, or token version mismatch - invalidate session
          if (!dbUser || !dbUser.isActive) {
            console.log(`[AUTH SESSION] User ${token.id} not found or inactive. Invalidating session.`);
            return { ...session, user: undefined, expires: new Date(0).toISOString() };
          }

          const tokenVersion = (token.tokenVersion as number) ?? 0;
          if (dbUser.tokenVersion > tokenVersion) {
            console.log(`[AUTH SESSION] Token version mismatch for user ${token.id}. DB: ${dbUser.tokenVersion}, Token: ${tokenVersion}. Forcing logout.`);
            return { ...session, user: undefined, expires: new Date(0).toISOString() };
          }
        } catch (error) {
          console.error('[AUTH SESSION] Error validating tokenVersion:', error);
          // SECURITY: Fail-closed - invalidate session on validation error
          console.warn('[AUTH SESSION] SECURITY: Invalidating session due to validation error');
          return { ...session, user: undefined, expires: new Date(0).toISOString() };
        }

        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).accessAdminPanel = token.accessAdminPanel;
        (session.user as any).accessEmployeePanel = token.accessEmployeePanel;
        // Don't include permissions in session - they will be loaded at runtime
        (session.user as any).permissionsCount = token.permissionsCount;
        (session.user as any).departmentId = token.departmentId;
        (session.user as any).departmentName = token.departmentName;
        (session.user as any).siteId = token.siteId; // Legacy: primary site
        (session.user as any).siteIds = token.siteIds; // Multi-site: all site IDs
        (session.user as any).primarySiteId = token.primarySiteId; // Multi-site: primary
        (session.user as any).isSales = token.isSales;
      }
      return session
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      // Dynamic import to avoid circular dependencies if necessary
      const { logger } = await import('@/lib/logger')

      await logger.logAuth({
        action: 'LOGIN',
        userId: user.id,
        details: {
          provider: account?.provider,
          isNewuser: isNewUser
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
  role: string | undefined
  departmentId: string | undefined
  /** @deprecated Use siteIds for multi-site */
  siteId: string | undefined
  /** Multi-site: Array of site IDs */
  siteIds: string[]
  /** Multi-site: Primary site ID */
  primarySiteId: string | undefined
  permissions: string[] | undefined
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
        const mp = mobilePayload as any
        return {
          id: mobilePayload.userId,
          email: mobilePayload.email as string,
          name: mobilePayload.name as string | null,
          role: mobilePayload.role as string | undefined,
          departmentId: mp.departmentId as string | undefined,
          siteId: mp.primarySiteId || mp.siteId as string | undefined,
          siteIds: mp.siteIds || (mp.siteId ? [mp.siteId] : []),
          primarySiteId: mp.primarySiteId as string | undefined,
          permissions: mp.permissions as string[] | undefined,
        }
      } else {
        console.warn('[AUTH_VERIFY] Mobile token verification failed')
      }
    }

    // 2. Check for NextAuth token (Web)
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
    })

    if (!token) {
      console.log('[AUTH_VERIFY] No valid session or Bearer token found')
      return null
    }

    return {
      id: token.id as string,
      email: token.email as string,
      name: token.name as string | null,
      role: token.role as string | undefined,
      departmentId: token.departmentId as string | undefined,
      siteId: token.siteId as string | undefined,
      siteIds: (token.siteIds as string[]) || (token.siteId ? [token.siteId as string] : []),
      primarySiteId: token.primarySiteId as string | undefined,
      permissions: token.permissions as string[] | undefined,
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
  
  // Try cache first
  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      console.debug('[AUTH] Permissions loaded from cache', { userId })
      return JSON.parse(cached)
    }
  } catch (e) {
    // Cache read failed - continue to database (fail-open for performance)
    console.warn('[AUTH] Redis cache read error, falling back to DB:', e)
  }

  // Load from database
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!user?.role?.permission) {
      return []
    }

    const permissions = user.role.permission.map(p => `${p.resource}:${p.action}`)
    
    // Cache permissions (non-blocking)
    try {
      await redis.setex(cacheKey, PERMISSION_CACHE_TTL, JSON.stringify(permissions))
      console.debug('[AUTH] Permissions cached', { userId, count: permissions.length })
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
  const cacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`
  try {
    await redis.del(cacheKey)
    console.debug('[AUTH] Permission cache invalidated', { userId })
  } catch (e) {
    console.warn('[AUTH] Failed to invalidate permission cache:', e)
  }
}

/**
 * Invalidate permission cache for all users with a specific role
 * Should be called when role permissions are updated
 */
export async function invalidateRolePermissionCache(roleId: string): Promise<void> {
  try {
    // Find all users with this role and invalidate their cache
    const users = await prisma.user.findMany({
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
  const permissionKey = `${resource}:${action}`
  return permissions.includes(permissionKey)
}