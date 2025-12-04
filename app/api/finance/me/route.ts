import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FinanceAuthService } from '@/lib/services/FinanceAuthService'

/**
 * Get current finance user data
 * Bisa diakses oleh user dengan role FINANCE atau ADMIN
 * 
 * @swagger
 * /api/finance/me:
 *   get:
 *     tags: [FinanceAuth]
 *     summary: Get current finance user
 *     description: Mendapatkan data user finance yang sedang login (FINANCE atau ADMIN)
 *     security:
 *       - FinanceToken: []
 *     responses:
 *       200:
 *         description: Data user finance
 *       401:
 *         description: Token tidak valid atau expired
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-finance-token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token tidak ditemukan' },
        { status: 401 }
      )
    }

    // Verify JWT token using FinanceAuthService
    try {
      const authResult = await FinanceAuthService.authenticate(token)

      console.log('[Finance Me] Auth result:', {
        success: authResult.success,
        error: authResult.error,
        userId: authResult.user?.id
      })

      if (!authResult.success || !authResult.user) {
        console.log('[Finance Me] Invalid token:', { success: authResult.success, error: authResult.error })
        return NextResponse.json(
          { error: authResult.error || 'Token tidak valid' },
          { status: 401 }
        )
      }

      // Cek role - FINANCE atau ADMIN bisa akses
      const allowedRoles = ['FINANCE', 'ADMIN'] as const
      if (!allowedRoles.includes(authResult.user.role as any)) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses ke portal finance' },
          { status: 403 }
        )
      }

      console.log('[Finance Me] User authenticated:', {
        id: authResult.user.id,
        email: authResult.user.email,
        role: authResult.user.role
      })

      // Return data user (tanpa passwordHash)
      const { passwordHash: _, ...userData } = authResult.user

      return NextResponse.json(userData)
    } catch (parseError) {
      console.error('Error parsing token:', parseError)
      return NextResponse.json(
        { error: 'Token tidak valid' },
        { status: 401 }
      )
    }
  } catch (error: any) {
    console.error('[Finance Me] Error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses request' },
      { status: 500 }
    )
  }
}

