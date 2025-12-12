import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { compare } from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getEmployeePermissions } from '@/lib/utils/permissions'

/**
 * Login finance menggunakan email dan password
 * User dengan role FINANCE atau ADMIN bisa login
 * 
 * @swagger
 * /api/finance/auth/login:
 *   post:
 *     tags: [FinanceAuth]
 *     summary: Login finance
 *     description: Login menggunakan email dan password untuk user dengan role FINANCE atau ADMIN
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "finance@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login berhasil
 *       401:
 *         description: Email atau password salah
 *       403:
 *         description: User tidak memiliki akses finance
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi' },
        { status: 400 }
      )
    }

    // Rate limit percobaan login per email
    const allowed = await checkRateLimit(`finance-login:${email.toLowerCase()}`, 5, 300)
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Terlalu banyak percobaan login. Silakan tunggu 5 menit sebelum mencoba lagi.',
          errorType: 'RATE_LIMIT',
          retryAfter: 300
        },
        { status: 429 }
      )
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      })

      if (!user) {
        return NextResponse.json(
          { error: 'Email atau password salah' },
          { status: 401 }
        )
      }

      // Verifikasi password
      if (!user.passwordHash) {
        return NextResponse.json(
          { error: 'Email atau password salah' },
          { status: 401 }
        )
      }
      const passwordMatch = await compare(password, user.passwordHash)
      if (!passwordMatch) {
        return NextResponse.json(
          { error: 'Email atau password salah' },
          { status: 401 }
        )
      }

      // Cek permissions melalui custom role system
      const permissions = await getEmployeePermissions(user.id)

      // Cek apakah user memiliki akses finance atau admin
      const hasFinanceAccess = permissions?.allowedFeatures?.includes('FINANCE') ||
                              permissions?.allowedFeatures?.includes('ADMIN') ||
                              false

      if (!hasFinanceAccess) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses ke portal finance' },
          { status: 403 }
        )
      }

      // Validate that NEXTAUTH_SECRET is configured
      const jwtSecret = process.env.NEXTAUTH_SECRET
      if (!jwtSecret) {
        console.error('[Finance Login] CRITICAL: NEXTAUTH_SECRET is not configured')
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        )
      }

      // Generate proper JWT token compatible with FinanceAuthService
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        permissions: permissions?.allowedFeatures || [],
        type: 'FINANCE_ACCESS',
        timestamp: Date.now()
      }

      const token = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: '24h',
        issuer: 'netmanager-finance',
        audience: 'finance-api'
      })

      // Return data user (tanpa passwordHash)
      const { passwordHash: _, ...userData } = user

      return NextResponse.json({
        token,
        user: userData,
      })
    } catch (error: any) {
      console.error('[Finance Login] Error:', error)
      return NextResponse.json(
        { error: 'Terjadi kesalahan saat login' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[Finance Login] Error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses request' },
      { status: 500 }
    )
  }
}

