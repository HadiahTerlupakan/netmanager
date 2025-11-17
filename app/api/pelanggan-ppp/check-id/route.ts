import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Cek apakah ID Pelanggan sudah ada (untuk validasi duplikat)
 * 
 * @swagger
 * /api/pelanggan-ppp/check-id:
 *   get:
 *     tags: [PelangganPPP]
 *     summary: Cek apakah ID pelanggan sudah digunakan
 *     description: Mengecek apakah ID pelanggan sudah ada di database untuk mencegah duplikat
 *     parameters:
 *       - in: query
 *         name: idPelanggan
 *         required: true
 *         schema:
 *           type: string
 *         description: ID pelanggan yang akan dicek
 *     responses:
 *       200:
 *         description: Status keberadaan ID pelanggan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   example: false
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const idPelanggan = searchParams.get('idPelanggan')

    if (!idPelanggan || idPelanggan.trim() === '') {
      return NextResponse.json({ error: 'ID Pelanggan harus diisi' }, { status: 400 })
    }

    // Validasi format (harus 8 digit angka)
    if (!/^\d{8}$/.test(idPelanggan.trim())) {
      return NextResponse.json({ error: 'ID Pelanggan harus 8 digit angka' }, { status: 400 })
    }

    // Cek apakah ID sudah ada di database
    try {
      const pelanggan = await prisma.pelanggan.findUnique({
        where: { idPelanggan: idPelanggan.trim() },
        select: { id: true }
      })
      return NextResponse.json({ exists: pelanggan !== null })
    } catch (error: any) {
      // Jika error (misalnya tabel belum ada), anggap ID belum ada
      console.warn('Error checking ID pelanggan (table mungkin belum ada):', error?.message)
      return NextResponse.json({ exists: false })
    }
  } catch (error: any) {
    console.error('Error checking pelanggan ID:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

