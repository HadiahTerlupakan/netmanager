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
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Secure hanya jika production DAN URL diawali https
        secure: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://'),
        domain: process.env.COOKIE_DOMAIN === 'localhost' ? undefined : process.env.COOKIE_DOMAIN
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
            if (role?.name === 'SUPER_ADMIN') {
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
            image: null,
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
                  permissions: true
                }
              }
            }
          })

          token.role = dbUser?.role?.name || 'USER'
          token.accessAdminPanel = dbUser?.role?.accessAdminPanel ?? false
          token.accessEmployeePanel = dbUser?.role?.accessEmployeePanel ?? false
          token.permissions = dbUser?.role?.permissions.map(p => `${p.resource}:${p.action}`) || []

          // Handle SUPER_ADMIN special case - they should have access to everything
          if (token.role === 'SUPER_ADMIN') {
            token.accessAdminPanel = true
            token.accessEmployeePanel = true
          }

          // Legacy support (optional)
          token.departmentId = dbUser?.departmentId
          token.siteId = dbUser?.siteId

          console.log('[AUTH JWT] Token initialized:', {
            id: token.id,
            role: token.role,
            accessAdmin: token.accessAdminPanel,
            accessEmployee: token.accessEmployeePanel,
            permissionsCount: token.permissions?.length
          })
        } catch (error) {
          console.error('[AUTH JWT] Error fetching user role:', error)
          token.role = 'USER'
          token.accessAdminPanel = false
          token.accessEmployeePanel = false
          token.permissions = []
        }
      }

      // Handle session updates
      if (trigger === 'update') {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: {
            role: {
              include: {
                permissions: true
              }
            }
          }
        })

        if (dbUser) {
          token.name = dbUser.name
          token.email = dbUser.email
          token.picture = dbUser.image
          token.departmentId = dbUser.departmentId
          token.siteId = dbUser.siteId

          token.role = dbUser.role?.name || 'USER'
          token.accessAdminPanel = dbUser.role?.accessAdminPanel ?? false
          token.accessEmployeePanel = dbUser.role?.accessEmployeePanel ?? false

          if (token.role === 'SUPER_ADMIN') {
            token.accessAdminPanel = true
            token.accessEmployeePanel = true
          }

          token.permissions = dbUser.role?.permissions.map(p => `${p.resource}:${p.action}`) || []
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).accessAdminPanel = token.accessAdminPanel;
        (session.user as any).accessEmployeePanel = token.accessEmployeePanel;
        (session.user as any).permissions = token.permissions;
        (session.user as any).departmentId = token.departmentId;
        (session.user as any).siteId = token.siteId;
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
          isNewUser: isNewUser
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

export async function verifyAuth(request: NextRequest) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
    })

    if (!token) {
      return null
    }

    return {
      id: token.id as string,
      email: token.email as string,
      name: token.name as string | null,
    }
  } catch (error) {
    console.error('Error verifying auth:', error)
    return null
  }
}