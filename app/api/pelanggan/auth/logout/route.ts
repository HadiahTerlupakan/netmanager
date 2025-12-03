import { NextRequest, NextResponse } from 'next/server'
import { verifyPelangganAccessToken, invalidatePelangganRefreshTokens } from '@/lib/jwt'

/**
 * Logout pelanggan dan invalidate refresh token
 * 
 * @swagger
 * /api/pelanggan/auth/logout:
 *   post:
 *     tags: [PelangganAuth]
 *     summary: Logout pelanggan
 *     description: Logout dan invalidate semua refresh token
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout berhasil
 *       401:
 *         description: Token tidak valid
 */
export async function POST(req: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token diperlukan' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify access token
    const decoded = verifyPelangganAccessToken(token)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token tidak valid' },
        { status: 401 }
      )
    }

    // Invalidate all refresh tokens for this pelanggan
    await invalidatePelangganRefreshTokens(decoded.id)

    return NextResponse.json({
      message: 'Logout berhasil',
    })
  } catch (error: any) {
    console.error('Error in logout API:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
