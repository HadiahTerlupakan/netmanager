import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const token = req.headers.get('x-pelanggan-token')

    console.log('DEBUG API: Token received:', !!token)

    if (!token) {
      console.log('DEBUG API: No token found')
      return NextResponse.json(
        { error: 'Token tidak ditemukan' },
        { status: 401 }
      )
    }

    // Parse token untuk mendapatkan pelanggan ID dan timestamp
    // Token format: base64(id:timestamp:secret)
    try {
      const tokenData = Buffer.from(token, 'base64').toString('utf8')
      console.log('DEBUG API: Token data after decode:', tokenData)
      const [pelangganId, timestamp] = tokenData.split(':')
      console.log('DEBUG API: Parsed ID:', pelangganId, 'Timestamp:', timestamp)

      if (!pelangganId || !timestamp) {
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

      console.log('DEBUG API: Token time:', tokenTime)
      console.log('DEBUG API: Current time:', now)
      console.log('DEBUG API: Token age:', tokenAge)
      console.log('DEBUG API: Max age:', maxAge)
      console.log('DEBUG API: Is expired:', tokenAge > maxAge)

      if (tokenAge > maxAge) {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        )
      }

      // Ambil data pelanggan dari database
      const pelanggan = await prisma.pelanggan.findUnique({
        where: { id: pelangganId },
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
      const { password: _, passwordLogin: __, ...pelangganData } = pelanggan

      console.log('DEBUG API: Returning pelanggan data:', pelangganData)
      return NextResponse.json(pelangganData)
    } catch (parseError) {
      console.error('Error parsing token:', parseError)
      return NextResponse.json(
        { error: 'Token tidak valid' },
        { status: 401 }
      )
    }
  } catch (error: any) {
    console.error('Error in pelanggan me API:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}