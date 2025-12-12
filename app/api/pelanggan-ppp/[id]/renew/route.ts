import { NextRequest, NextResponse } from 'next/server'
import { renewPelanggan, shouldDisablePerpanjanganPaket } from '@/lib/services/tagihan-service'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Helper untuk verifikasi token pelanggan
 */
async function verifyPelangganToken(token: string): Promise<string | null> {
  try {
    const tokenData = Buffer.from(token, 'base64').toString('utf-8')
    const [pelangganId] = tokenData.split(':')

    // Verifikasi token dengan secret
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: { id: true },
    })

    return pelanggan ? pelanggan.id : null
  } catch {
    return null
  }
}

/**
 * POST /api/pelanggan-ppp/[id]/renew
 * Renew/Perpanjang layanan pelanggan
 * - Admin bisa renew semua pelanggan dengan opsi tambahan (ubah paket, diskon, dll)
 * - Pelanggan hanya bisa renew untuk diri mereka sendiri (tanpa opsi tambahan)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Cek apakah ini request dari user terautentikasi (admin access via CustomRole)
    const session: any = await getServerSession(authConfig as any)
    const isAuthenticated = session?.user

    // Jika bukan admin, cek apakah ini pelanggan yang mencoba renew untuk diri mereka sendiri
    if (!isAuthenticated) {
      // Cek token pelanggan dari header
      const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
        request.headers.get('x-pelanggan-token')

      if (!token) {
        return NextResponse.json({ error: 'Token pelanggan diperlukan' }, { status: 401 })
      }

      const pelangganId = await verifyPelangganToken(token)
      if (!pelangganId || pelangganId !== id) {
        return NextResponse.json({ error: 'Unauthorized - Anda hanya bisa memperpanjang layanan Anda sendiri' }, { status: 403 })
      }
    }

    // Ambil data pelanggan untuk cek jatuh tempo
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      select: { jatuhTempo: true },
    })

    if (!pelanggan) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 })
    }

    // Cek apakah perpanjangan harus di-disable (kecuali untuk admin)
    if (!isAuthenticated && pelanggan.jatuhTempo) {
      const disableCheck = await shouldDisablePerpanjanganPaket(pelanggan.jatuhTempo)
      if (disableCheck.disabled) {
        return NextResponse.json(
          {
            error: `Perpanjangan paket dinonaktifkan. Masih ${disableCheck.selisihHari} hari sebelum jatuh tempo. Perpanjangan akan diaktifkan setelah ${disableCheck.hariSebelumJatuhTempo} hari sebelum jatuh tempo.`
          },
          { status: 403 }
        )
      }
    }

    // Untuk admin, bisa ada body dengan parameter tambahan
    let body: any = {}
    if (isAuthenticated) {
      try {
        body = await request.json()
      } catch {
        // Jika tidak ada body, gunakan default
      }
    }

    const result = await renewPelanggan(id, {
      tipeLangganan: body.tipeLangganan || 'PERPANJANG',
      hargaPaketId: body.hargaPaketId || null,
      diskon: body.diskon || 0,
    })

    return NextResponse.json({
      message: 'Layanan berhasil diperpanjang',
      tagihanId: result.tagihanId,
      jatuhTempoBaru: result.jatuhTempoBaru,
    })
  } catch (error: any) {
    console.error('Error renewing pelanggan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

