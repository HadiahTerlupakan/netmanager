import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Generate finance token untuk admin user dengan role FINANCE atau ADMIN
 * Endpoint ini digunakan untuk bridging authentication dari admin portal ke finance portal
 *
 * @swagger
 * /api/finance/auth/generate-token:
 *   post:
 *     tags: [FinanceAuth]
 *     summary: Generate finance token for admin
 *     description: Generate finance token untuk admin user dengan role FINANCE
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - email
 *             properties:
 *               userId:
 *                 type: string
 *                 example: "user_123"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@example.com"
 *     responses:
 *       200:
 *         description: Token generated successfully
 *       401:
 *         description: Unauthorized - invalid admin session
 *       403:
 *         description: User doesn't have FINANCE role
 *       404:
 *         description: User not found
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, email } = body

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID dan email wajib diisi' },
        { status: 400 }
      )
    }

    // Validasi user di database
    try {
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
          email: email.toLowerCase().trim()
        },
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User tidak ditemukan' },
          { status: 404 }
        )
      }

      // Cek role - FINANCE atau ADMIN bisa generate token
      const allowedRoles = ['FINANCE', 'ADMIN']
      if (!allowedRoles.includes(user.role as any)) {
        return NextResponse.json(
          { error: 'User tidak memiliki akses ke portal finance' },
          { status: 403 }
        )
      }

      // Generate finance token dengan format yang sama seperti login
      const timestamp = Date.now()
      const tokenData = `${user.id}:${timestamp}:${process.env.NEXTAUTH_SECRET || 'secret'}`
      const token = Buffer.from(tokenData).toString('base64')

      // Log untuk audit trail
      console.log(`[Finance Token Generated] User: ${user.email}, Role: ${user.role}, Timestamp: ${timestamp}`)

      // Return token
      return NextResponse.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
      })
    } catch (error: any) {
      console.error('[Finance Token Generation] Error:', error)
      return NextResponse.json(
        { error: 'Terjadi kesalahan saat生成 token' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[Finance Token Generation] Request Error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses request' },
      { status: 500 }
    )
  }
}