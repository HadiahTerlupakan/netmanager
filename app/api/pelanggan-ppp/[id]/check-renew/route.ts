import { NextRequest, NextResponse } from 'next/server'
import { shouldDisablePerpanjanganPaket } from '@/lib/services/tagihan-service'
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
 * GET /api/pelanggan-ppp/[id]/check-renew
 * Mengecek apakah perpanjangan paket harus di-disable
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    // Cek apakah ini request dari user terautentikasi (admin access via CustomRole)
    const session: any = await getServerSession(authConfig as any)
    const isAuthenticated = session?.user

    // Jika bukan user terautentikasi, cek apakah ini pelanggan yang mencoba cek untuk diri mereka sendiri
    if (!isAuthenticated) {
      // Cek token pelanggan dari header
      const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
        request.headers.get('x-pelanggan-token')

      if (!token) {
        return NextResponse.json({ error: 'Token pelanggan diperlukan' }, { status: 401 })
      }

      const pelangganId = await verifyPelangganToken(token)
      if (!pelangganId || pelangganId !== id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Ambil data pelanggan
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      select: { jatuhTempo: true },
    })

    if (!pelanggan) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 })
    }

    if (!pelanggan.jatuhTempo) {
      return NextResponse.json({
        disabled: false,
        message: 'Jatuh tempo tidak ditemukan',
      })
    }

    // Cek apakah perpanjangan harus di-disable
    const disableCheck = await shouldDisablePerpanjanganPaket(pelanggan.jatuhTempo)

    return NextResponse.json({
      disabled: disableCheck.disabled,
      hariSebelumJatuhTempo: disableCheck.hariSebelumJatuhTempo,
      selisihHari: disableCheck.selisihHari,
      message: disableCheck.disabled
        ? `Perpanjangan paket dinonaktifkan. Masih ${disableCheck.selisihHari} hari sebelum jatuh tempo. Perpanjangan akan diaktifkan setelah ${disableCheck.hariSebelumJatuhTempo} hari sebelum jatuh tempo.`
        : 'Perpanjangan paket dapat dilakukan',
    })
  } catch (error: any) {
    console.error('Error checking renew status:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}









