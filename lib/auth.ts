import NextAuth from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { getUserRepository } from '@/lib/repositories'
import { compare } from 'bcryptjs'
import { checkRateLimit } from '@/lib/redis'
import { redis } from '@/lib/redis'

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
    signIn: '/login',
    error: '/error',
  },
  providers: [
    // Credentials Provider (for email/password login)
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Email', type: 'text' },
        email: { label: 'Email', type: 'email' },
        identifier: { label: 'Identifier', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          // Support 'identifier', 'email', or 'username' fields
          const identifier = (credentials?.identifier || credentials?.username || credentials?.email)?.toLowerCase().trim()
          const password = credentials?.password ?? ''

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

    async jwt({ token, user, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id

        // All authenticated users are now ADMIN
        token.role = 'ADMIN'

        console.log('[AUTH JWT] Token set:', {
          id: token.id,
          email: token.email,
          role: token.role,
        })
      }

      // Handle session updates
      if (trigger === 'update') {
        // Refresh user data from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        })

        if (dbUser) {
          token.name = dbUser.name
          token.email = dbUser.email
          token.picture = dbUser.image
          token.departmentId = dbUser.departmentId
          token.siteId = dbUser.siteId

          // All authenticated users are now ADMIN
          token.role = 'ADMIN'
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).departmentId = token.departmentId;
        (session.user as any).siteId = token.siteId;
      }
      return session
    },
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