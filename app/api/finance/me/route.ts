import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Parse token untuk mendapatkan user ID dan timestamp
    // Token format: base64(id:timestamp:secret)
    try {
      const tokenData = Buffer.from(token, 'base64').toString('utf8')
      const [userId, timestamp] = tokenData.split(':')

      console.log('[Finance Me] Token data:', { userId, timestamp, fullTokenData: tokenData })

      if (!userId || !timestamp) {
        console.log('[Finance Me] Invalid token - missing userId or timestamp')
        return NextResponse.json(
          { error: 'Token tidak valid' },
          { status: 401 }
        )
      }

      // Check if token is expired (24 hours)
      const tokenTime = parseInt(timestamp)
      const now = Date.now()
      const tokenAge = now - tokenTime
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

      if (tokenAge > maxAge) {
        console.log('[Finance Me] Token expired:', { tokenAge, maxAge })
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        )
      }

      console.log('[Finance Me] Looking up user with ID:', userId)

      // Ambil data user dari database
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        console.log('[Finance Me] User not found for ID:', userId)
        return NextResponse.json(
          { error: 'User tidak ditemukan' },
          { status: 404 }
        )
      }

      console.log('[Finance Me] User found:', { id: user.id, email: user.email, role: user.role })

      // Cek role - FINANCE atau ADMIN bisa akses
      const allowedRoles = ['FINANCE', 'ADMIN'] as const
      if (!allowedRoles.includes(user.role as any)) {
        return NextResponse.json(
          { error: 'Anda tidak memiliki akses ke portal finance' },
          { status: 403 }
        )
      }

      // Return data user (tanpa passwordHash)
      const { passwordHash: _, ...userData } = user

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

