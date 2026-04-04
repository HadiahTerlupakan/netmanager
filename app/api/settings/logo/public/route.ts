import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/modules/database'

/**
 * GET /api/settings/logo/public
 * Mengambil pengaturan logo untuk public access (invoice)
 */
export async function GET(_req: NextRequest) {
  try {
    // Ambil pengaturan logo dari database (public access untuk invoice)
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: ['LOGO_INVOICE', 'LOGO_APLIKASI'],
        },
      },
    })

    // Convert ke object
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))

    const logoInvoice = settingsMap.get('LOGO_INVOICE') || null
    const logoAplikasi = settingsMap.get('LOGO_APLIKASI') || null

    // console.log('Public logo settings:', { logoInvoice, logoAplikasi })

    return NextResponse.json({
      logoInvoice,
      logoAplikasi,
    })
  } catch (error) {
    console.error('Error fetching logo settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

