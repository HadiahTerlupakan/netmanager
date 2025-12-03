import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPelangganAccessToken } from '@/lib/jwt'

/**
 * Mendapatkan data pelanggan yang sedang login berdasarkan token
 *
 * @swagger
 * /api/pelanggan/me:
 *   get:
 *     tags: [PelangganAuth]
 *     summary: Get current pelanggan data
 *     description: Mendapatkan data pelanggan yang sedang login
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Data pelanggan berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 idPelanggan:
 *                   type: string
 *                 nama:
 *                   type: string
 *                 username:
 *                   type: string
 *                 status:
 *                   type: string
 *                 hargaPaket:
 *                   type: object
 *       401:
 *         description: Token tidak valid atau expired
 */
export async function GET(req: NextRequest) {
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

    // Verify JWT token
    const decoded = verifyPelangganAccessToken(token)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token tidak valid atau expired' },
        { status: 401 }
      )
    }

    // Ambil data pelanggan dari database
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: decoded.id },
      include: {
        hargaPaket: {
          include: {
            profilePPP: true,
            bandwidth: true,
          },
        },
      },
    })

    if (!pelanggan) {
      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Cek status pelanggan
    if (pelanggan.status !== 'AKTIF') {
      return NextResponse.json(
        { error: 'Akun pelanggan tidak aktif' },
        { status: 403 }
      )
    }

    // Return data pelanggan (tanpa password)
    const { password: _, passwordLogin: __, ...pelangganData } = pelanggan as any

    return NextResponse.json(pelangganData, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=59',
      },
    })
  } catch (error: any) {
    console.error('Error in pelanggan me API:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}