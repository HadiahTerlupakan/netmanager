import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
import { compare } from 'bcryptjs'

/**
 * Login pelanggan menggunakan ID Pelanggan dan password
 * 
 * PENTING: Password yang digunakan adalah "Password Login Portal" (passwordLogin),
 * BUKAN "Password PPPoE" (password). Kedua password ini berbeda dan terpisah.
 * 
 * - Password PPPoE: untuk koneksi PPPoE ke router
 * - Password Login Portal: untuk login di portal pelanggan (/pelanggan/login)
 * 
 * @swagger
 * /api/pelanggan/auth/login:
 *   post:
 *     tags: [PelangganAuth]
 *     summary: Login pelanggan
 *     description: Login menggunakan ID Pelanggan dan Password Login Portal (bukan Password PPPoE)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idPelanggan
 *               - password
 *             properties:
 *               idPelanggan:
 *                 type: string
 *                 example: "12345678"
 *               password:
 *                 type: string
 *                 description: Password Login Portal (bukan Password PPPoE)
 *                 example: "12345"
 *     responses:
 *       200:
 *         description: Login berhasil
 *       401:
 *         description: ID Pelanggan atau password salah
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { idPelanggan, password } = body

    if (!idPelanggan || !password) {
      return NextResponse.json(
        { error: 'ID Pelanggan dan password harus diisi' },
        { status: 400 }
      )
    }

    // Validasi format ID Pelanggan (8 digit angka)
    if (!/^\d{8}$/.test(idPelanggan.trim())) {
      return NextResponse.json(
        { error: 'ID Pelanggan harus 8 digit angka' },
        { status: 400 }
      )
    }

    // Rate limit percobaan login per ID Pelanggan
    const allowed = await checkRateLimit(`pelanggan-login:${idPelanggan}`, 5, 300)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi nanti.' },
        { status: 429 }
      )
    }

    // Cari pelanggan berdasarkan ID Pelanggan
    try {
      const pelanggan = await prisma.pelanggan.findUnique({
        where: { idPelanggan: idPelanggan.trim() },
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
          { error: 'ID Pelanggan atau password salah' },
          { status: 401 }
        )
      }

      // Verifikasi password
      // PENTING: Password yang digunakan adalah "Password Login Portal" (passwordLogin)
      // BUKAN "Password PPPoE" (password). Kedua password ini berbeda dan terpisah.
      // 
      // - pelanggan.password = Password PPPoE (untuk koneksi PPPoE ke router)
      // - pelanggan.passwordLogin = Password Login Portal (untuk login di portal pelanggan)
      //
      // Untuk sementara, password disimpan plain text, jadi langsung compare
      // TODO: Jika ingin lebih secure, bisa hash password dengan bcrypt saat create pelanggan
      const passwordMatch = pelanggan.passwordLogin === password
      if (!passwordMatch) {
        return NextResponse.json(
          { error: 'ID Pelanggan atau password salah' },
          { status: 401 }
        )
      }

      // Cek status pelanggan
      if (pelanggan.status !== 'AKTIF') {
        return NextResponse.json(
          { error: 'Akun pelanggan tidak aktif' },
          { status: 403 }
        )
      }

      // Generate simple token (untuk sementara, bisa di-upgrade ke JWT nanti)
      // Token = base64(id + timestamp + secret)
      const timestamp = Date.now()
      const tokenData = `${pelanggan.id}:${timestamp}:${process.env.NEXTAUTH_SECRET || 'secret'}`
      const token = Buffer.from(tokenData).toString('base64')

      // Return data pelanggan (tanpa password)
      const { password: _, passwordLogin: __, ...pelangganData } = pelanggan

      return NextResponse.json({
        token,
        pelanggan: pelangganData,
      })
    } catch (error: any) {
      // Jika error (misalnya tabel belum ada), return error
      console.error('Error during pelanggan login:', error)
      return NextResponse.json(
        { error: 'ID Pelanggan atau password salah' },
        { status: 401 }
      )
    }
  } catch (error: any) {
    console.error('Error in pelanggan login API:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

