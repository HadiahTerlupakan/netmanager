import NextAuth from 'next-auth'
import type { NextAuthOptions } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import AzureADProvider from 'next-auth/providers/azure-ad'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { getUserRepository } from '@/lib/repositories'
import { compare } from 'bcryptjs'
import { checkRateLimit } from '@/lib/redis'
import { getAllOAuthProviders } from '@/lib/auth-dynamic'

// Fallback OAuth providers from environment variables
function getFallbackOAuthProviders() {
  const providers = []

  // Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      })
    )
  }

  // GitHub OAuth
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      })
    )
  }

  // Microsoft Azure AD OAuth
  if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID) {
    providers.push(
      AzureADProvider({
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        tenantId: process.env.AZURE_AD_TENANT_ID,
        allowDangerousEmailAccountLinking: true,
      })
    )
  }

  return providers
}

// Dynamic auth configuration that loads OAuth providers at runtime
export async function createAuthConfig(): Promise<NextAuthOptions> {
  // Load OAuth providers dynamically
  const oauthProviders = await getAllOAuthProviders()

  return {
    adapter: PrismaAdapter(prisma) as any,
    session: {
      strategy: 'jwt', // Use JWT for sessions (works for both OAuth and credentials)
    },
    // Configure cookies for cross-subdomain support if COOKIE_DOMAIN is set
    cookies: process.env.COOKIE_DOMAIN ? {
      sessionToken: {
        name: `next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
          domain: process.env.COOKIE_DOMAIN
        }
      }
    } : undefined,
    pages: {
      signIn: '/login',
      error: '/error',
    },
    providers: [
      // Dynamic OAuth providers
      ...oauthProviders,

      // Credentials Provider (for backward compatibility with email/employee ID login)
      Credentials({
        name: 'Credentials',
        credentials: {
          username: { label: 'Email or Employee ID', type: 'text' },
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          try {
            // Support both 'email' field (for admin) and 'username' field (for employees)
            const identifier = (credentials?.username || credentials?.email)?.toLowerCase().trim()
            const password = credentials?.password ?? ''

            console.log('[AUTH] Login attempt with identifier:', identifier?.substring(0, 3) + '***')

            if (!identifier || !password) {
              console.log('[AUTH] Missing identifier or password')
              return null
            }

            // Rate limit percobaan login per identifier (mis. 5x per 5 menit)
            const allowed = await checkRateLimit(`login:${identifier}`, 5, 300)
            if (!allowed) {
              console.log('[AUTH] Rate limit exceeded for:', identifier)
              throw new Error('Terlalu banyak percobaan. Coba lagi nanti.')
            }

            const userRepository = getUserRepository()
            let user = null
            let employee = null

            // Check if identifier is an email or Employee ID
            if (identifier.includes('@')) {
              console.log('[AUTH] Attempting email login')
              // Login dengan email
              user = await userRepository.findByEmail(identifier)
              console.log('[AUTH] User found by email:', !!user)
            } else {
              console.log('[AUTH] Attempting Employee ID login')
              // Login dengan Employee ID
              employee = await prisma.employee.findUnique({
                where: { employeeId: identifier.toUpperCase() }, // Ensure uppercase
                include: {
                  department: true,
                  position: true,
                },
              })
              console.log('[AUTH] Employee found:', !!employee)

              if (employee && employee.userId) {
                user = await prisma.user.findUnique({
                  where: { id: employee.userId },
                })
                console.log('[AUTH] User found via employee:', !!user)
              } else if (employee) {
                console.log('[AUTH] Employee found but no userId:', employee.employeeId)
              }
            }

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
              name: user.name ?? employee?.fullName ?? null,
              role: user.role,
              image: null,
              employeeId: employee?.employeeId,
              employee: employee ? {
                id: employee.id,
                employeeId: employee.employeeId,
                fullName: employee.fullName,
                department: employee.department,
                position: employee.position,
              } : null,
            } as any
          } catch (error) {
            console.error('[AUTH] Error in authorize:', error)
            throw error
          }
        },
      }),
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        // For OAuth providers, auto-provision users
        if (account?.provider !== 'credentials') {
          console.log('[AUTH] OAuth sign in:', account?.provider, user.email)

          // Check if user already exists
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          })

          // If user doesn't exist, the adapter will create it
          // We just need to ensure it has a proper role (default: USER)
          if (!existingUser && user.email) {
            // The Prisma adapter will create the user automatically
            // We'll assign proper role in the jwt callback
            console.log('[AUTH] New OAuth user will be created:', user.email)
          }
        }

        return true
      },

      async jwt({ token, user, account, trigger }) {
        // Initial sign in
        if (user) {
          token.id = user.id
          token.role = (user as any).role || 'USER' // Default to USER for OAuth users
          token.employeeId = (user as any).employeeId
          token.employee = (user as any).employee

          // For OAuth sign in, fetch role from database
          if (account?.provider !== 'credentials') {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
            })

            if (dbUser) {
              token.role = dbUser.role
            }
          }
        }

        // Handle session updates
        if (trigger === 'update') {
          // Refresh user data from database
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          })

          if (dbUser) {
            token.role = dbUser.role
            token.name = dbUser.name
            token.email = dbUser.email
            token.picture = dbUser.image
          }
        }

        return token
      },

      async session({ session, token }) {
        if (session.user) {
          (session.user as any).id = token.id;
          (session.user as any).role = token.role;
          (session.user as any).employeeId = token.employeeId;
          (session.user as any).employee = token.employee;
        }
        return session
      },
    },
    events: {
      async linkAccount({ user }) {
        // When OAuth account is linked, update emailVerified
        await prisma.user.update({
          where: { id: user.id! },
          data: { emailVerified: new Date() },
        })
      },
    },
  }
}

// Fallback static configuration for when dynamic loading fails
export const authConfig: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt', // Use JWT for sessions (works for both OAuth and credentials)
  },
  pages: {
    signIn: '/login',
    error: '/error',
  },
  providers: [
    // Fallback providers from environment variables
    ...getFallbackOAuthProviders(),

    // Credentials Provider (for backward compatibility with email/employee ID login)
    Credentials({
      name: 'Credentials',
      credentials: {
        username: { label: 'Email or Employee ID', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          // Support both 'email' field (for admin) and 'username' field (for employees)
          const identifier = (credentials?.username || credentials?.email)?.toLowerCase().trim()
          const password = credentials?.password ?? ''

          console.log('[AUTH] Login attempt with identifier:', identifier?.substring(0, 3) + '***')

          if (!identifier || !password) {
            console.log('[AUTH] Missing identifier or password')
            return null
          }

          // Rate limit percobaan login per identifier (mis. 5x per 5 menit)
          const allowed = await checkRateLimit(`login:${identifier}`, 5, 300)
          if (!allowed) {
            console.log('[AUTH] Rate limit exceeded for:', identifier)
            throw new Error('Terlalu banyak percobaan. Coba lagi nanti.')
          }

          const userRepository = getUserRepository()
          let user = null
          let employee = null

          // Check if identifier is an email or Employee ID
          if (identifier.includes('@')) {
            console.log('[AUTH] Attempting email login')
            // Login dengan email
            user = await userRepository.findByEmail(identifier)
            console.log('[AUTH] User found by email:', !!user)
          } else {
            console.log('[AUTH] Attempting Employee ID login')
            // Login dengan Employee ID
            employee = await prisma.employee.findUnique({
              where: { employeeId: identifier.toUpperCase() }, // Ensure uppercase
              include: {
                department: true,
                position: true,
              },
            })
            console.log('[AUTH] Employee found:', !!employee)

            if (employee && employee.userId) {
              user = await prisma.user.findUnique({
                where: { id: employee.userId },
              })
              console.log('[AUTH] User found via employee:', !!user)
            } else if (employee) {
              console.log('[AUTH] Employee found but no userId:', employee.employeeId)
            }
          }

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
            name: user.name ?? employee?.fullName ?? null,
            role: user.role,
            image: null,
            employeeId: employee?.employeeId,
            employee: employee ? {
              id: employee.id,
              employeeId: employee.employeeId,
              fullName: employee.fullName,
              department: employee.department,
              position: employee.position,
            } : null,
          } as any
        } catch (error) {
          console.error('[AUTH] Error in authorize:', error)
          throw error
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, auto-provision users
      if (account?.provider !== 'credentials') {
        console.log('[AUTH] OAuth sign in:', account?.provider, user.email)

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        // If user doesn't exist, the adapter will create it
        // We just need to ensure it has a proper role (default: USER)
        if (!existingUser && user.email) {
          // The Prisma adapter will create the user automatically
          // We'll assign proper role in the jwt callback
          console.log('[AUTH] New OAuth user will be created:', user.email)
        }
      }

      return true
    },

    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.role = (user as any).role || 'USER' // Default to USER for OAuth users
        token.employeeId = (user as any).employeeId
        token.employee = (user as any).employee

        // For OAuth sign in, fetch role from database
        if (account?.provider !== 'credentials') {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
          })

          if (dbUser) {
            token.role = dbUser.role
          }
        }
      }

      // Handle session updates
      if (trigger === 'update') {
        // Refresh user data from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
        })

        if (dbUser) {
          token.role = dbUser.role
          token.name = dbUser.name
          token.email = dbUser.email
          token.picture = dbUser.image
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).employeeId = token.employeeId;
        (session.user as any).employee = token.employee;
      }
      return session
    },
  },
  events: {
    async linkAccount({ user }) {
      // When OAuth account is linked, update emailVerified
      await prisma.user.update({
        where: { id: user.id! },
        data: { emailVerified: new Date() },
      })
    },
  },
}

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
      role: token.role as string,
    }
  } catch (error) {
    console.error('Error verifying auth:', error)
    return null
  }
}