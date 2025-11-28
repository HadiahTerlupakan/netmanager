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
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim()
        const password = credentials?.password ?? ''
        if (!email || !password) return null

        // Rate limit percobaan login per email (mis. 5x per 5 menit)
        const allowed = await checkRateLimit(`login:${email}`, 5, 300)
        if (!allowed) {
          throw new Error('Terlalu banyak percobaan. Coba lagi nanti.')
        }

        const userRepository = getUserRepository()
        const user = await userRepository.findByEmail(email)
        if (!user) return null
        const ok = await compare(password, user.passwordHash)
        if (!ok) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          role: user.role,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session
    },
  },
}

export const handler = NextAuth(authConfig)
