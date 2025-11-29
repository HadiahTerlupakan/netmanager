import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { getUserRepository } from '@/lib/repositories'
import { compare } from 'bcryptjs'
import { checkRateLimit } from '@/lib/redis'

export const authConfig = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt' as const,
  },
  pages: {
    signIn: '/login',
    error: '/error', // Halaman error khusus untuk NextAuth (akan di-handle oleh app/(auth)/error/page.tsx)
  },
  providers: [
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
          const ok = await compare(password, user.passwordHash)
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
    async jwt({ token, user }: any) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
        token.employeeId = (user as any).employeeId
        token.employee = (user as any).employee
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).employeeId = token.employeeId;
        (session.user as any).employee = token.employee;
      }
      return session
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
      secret: process.env.NEXTAUTH_SECRET
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
