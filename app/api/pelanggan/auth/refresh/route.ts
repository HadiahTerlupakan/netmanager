import { NextRequest, NextResponse } from 'next/server'
import { verifyPelangganRefreshToken, generatePelangganAccessToken } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

/**
 * Refresh access token pelanggan menggunakan refresh token
 * 
 * @swagger
 * /api/pelanggan/auth/refresh:
 *   post:
 *     tags: [PelangganAuth]
 *     summary: Refresh access token
 *     description: Mendapatkan access token baru menggunakan refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token yang valid
 *     responses:
 *       200:
 *         description: Access token baru berhasil dibuat
 *       401:
 *         description: Refresh token tidak valid atau expired
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token diperlukan' },
        { status: 400 }
      )
    }

    // Verify refresh token
    const { id: pelangganId, valid } = await verifyPelangganRefreshToken(refreshToken)
    
    if (!valid || !pelangganId) {
      return NextResponse.json(
        { error: 'Refresh token tidak valid atau expired' },
        { status: 401 }
      )
    }

    // Ambil data pelanggan terbaru
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        username: true,
        status: true,
      },
    })

    if (!pelanggan || pelanggan.status !== 'AKTIF') {
      return NextResponse.json(
        { error: 'Akun pelanggan tidak aktif' },
        { status: 403 }
      )
    }

    // Generate access token baru
    const accessToken = generatePelangganAccessToken(pelanggan)

    return NextResponse.json({
      accessToken,
      expiresIn: '15m',
      tokenType: 'Bearer',
    })
  } catch (error: any) {
    console.error('Error in refresh token API:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
