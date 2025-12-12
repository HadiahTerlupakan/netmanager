import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import FinanceAuthService from '@/lib/services/FinanceAuthService'
import { getEmployeePermissions } from '@/lib/utils/permissions'

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

      // Cek permissions melalui custom role system
      const permissions = await getEmployeePermissions(user.id)

      // Cek apakah user memiliki akses finance atau admin
      const hasFinanceAccess = permissions?.allowedFeatures?.includes('FINANCE') ||
                              permissions?.allowedFeatures?.includes('ADMIN') ||
                              false

      if (!hasFinanceAccess) {
        return NextResponse.json(
          { error: 'User tidak memiliki akses ke portal finance' },
          { status: 403 }
        )
      }

      // Generate secure JWT token menggunakan FinanceAuthService
      const { token, expiresAt } = FinanceAuthService.generateFinanceToken({
        id: user.id,
        email: user.email,
        name: user.name,
        permissions: permissions?.allowedFeatures || []
      });

      // Log untuk audit trail (tanpa sensitive data)
      console.log(`[Finance Token Generated] User: ${user.email}, Permissions: [${permissions?.allowedFeatures?.join(', ')}], Expires: ${expiresAt.toISOString()}`);

      // Return token dengan informasi expiry
      return NextResponse.json({
        token,
        expiresAt: expiresAt.toISOString(),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          permissions: permissions?.allowedFeatures || []
        },
      });
    } catch (error: any) {
      console.error('[Finance Token Generation] Database Error:', error.message)
      return NextResponse.json(
        { error: 'Gagal memvalidasi user' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('[Finance Token Generation] Request Error:', error.message)
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    )
  }
}