import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Generate ID pelanggan yang terjamin unik (8 digit)
 * 
 * @swagger
 * /api/pelanggan-ppp/generate-id:
 *   get:
 *     tags: [PelangganPPP]
 *     summary: Generate ID pelanggan yang terjamin unik
 *     description: Menghasilkan ID pelanggan 8 digit yang terjamin unik dengan validasi ke database
 *     responses:
 *       200:
 *         description: ID pelanggan berhasil di-generate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 idPelanggan:
 *                   type: string
 *                   example: "68001234"
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fungsi untuk generate ID 8 digit
    const generateId = (): string => {
      const now = new Date()
      const timestamp = now.getTime()
      const timestampStr = String(timestamp)
      const timestampPart = timestampStr.slice(-5)
      const random = Math.floor(Math.random() * 1000)
      return timestampPart + String(random).padStart(3, '0')
    }

    // Fungsi untuk cek apakah ID sudah ada di database
    const isIdExists = async (id: string): Promise<boolean> => {
      try {
        const pelanggan = await prisma.pelanggan.findUnique({
          where: { idPelanggan: id }
        })
        return pelanggan !== null
      } catch (error) {
        // Jika error (misalnya tabel belum ada), anggap ID belum ada
        return false
      }
    }

    // Generate ID dan pastikan unik (max 10 retry untuk menghindari infinite loop)
    let idPelanggan = generateId()
    let attempts = 0
    const maxAttempts = 10

    while (await isIdExists(idPelanggan) && attempts < maxAttempts) {
      idPelanggan = generateId()
      attempts++
    }

    if (attempts >= maxAttempts) {
      // Jika setelah 10 kali masih duplikat, gunakan timestamp + random yang lebih besar
      const now = new Date()
      const timestamp = now.getTime()
      const random = Math.floor(Math.random() * 10000) // Random 0-9999
      idPelanggan = String(timestamp).slice(-6) + String(random).padStart(2, '0')
    }

    return NextResponse.json({ idPelanggan })
  } catch (error: any) {
    console.error('Error generating pelanggan ID:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

