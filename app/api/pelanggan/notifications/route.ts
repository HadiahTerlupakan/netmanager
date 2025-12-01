import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTagihanRepository } from '@/lib/repositories'

interface Notification {
  id: string
  type: 'TAGIHAN' | 'STATUS' | 'PROMO'
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
}

/**
 * GET /api/pelanggan/notifications
 * Fetch notifications for logged-in pelanggan
 * Generates notifications dynamically from tagihan and status data
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('x-pelanggan-token')
    const pelangganData = req.headers.get('x-pelanggan-data')

    if (!token || !pelangganData) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    // Parse customer data from header
    let pelanggan
    try {
      pelanggan = JSON.parse(pelangganData)
    } catch (e) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Verify customer is active
    const dbPelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelanggan.id },
      include: {
        hargaPaket: true,
      },
    })

    if (!dbPelanggan || dbPelanggan.status !== 'AKTIF') {
      return NextResponse.json(
        { error: 'Unauthorized - Customer not active' },
        { status: 401 }
      )
    }

    const notifications: Notification[] = []
    const sekarang = new Date()

    // 1. Generate TAGIHAN notifications
    const tagihanRepo = getTagihanRepository()
    const tagihans = await tagihanRepo.findByPelangganId(pelanggan.id)

    // Tagihan yang belum lunas atau terlambat
    const tagihanBelumLunas = tagihans.filter(
      (t) => t.status === 'BELUM_LUNAS' || t.status === 'TERLAMBAT'
    )

    for (const tagihan of tagihanBelumLunas) {
      const jatuhTempo = new Date(tagihan.jatuhTempo)
      const daysUntilDue = Math.ceil(
        (jatuhTempo.getTime() - sekarang.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (tagihan.status === 'TERLAMBAT') {
        notifications.push({
          id: `tagihan-terlambat-${tagihan.id}`,
          type: 'TAGIHAN',
          title: '⚠️ Tagihan Sudah Jatuh Tempo!',
          message: `Tagihan Anda sebesar Rp ${tagihan.total.toLocaleString('id-ID')} sudah melewati jatuh tempo. Segera lakukan pembayaran untuk menghindari gangguan layanan.`,
          isRead: false,
          createdAt: jatuhTempo.toISOString(),
          link: `/pelanggan/tagihan/${tagihan.id}/bayar`,
        })
      } else if (daysUntilDue <= 3 && daysUntilDue > 0) {
        notifications.push({
          id: `tagihan-urgent-${tagihan.id}`,
          type: 'TAGIHAN',
          title: 'Tagihan Segera Jatuh Tempo!',
          message: `Tagihan Anda sebesar Rp ${tagihan.total.toLocaleString('id-ID')} akan jatuh tempo dalam ${daysUntilDue} hari. Segera lakukan pembayaran.`,
          isRead: false,
          createdAt: tagihan.createdAt.toISOString(),
          link: `/pelanggan/tagihan/${tagihan.id}/bayar`,
        })
      } else if (daysUntilDue <= 7 && daysUntilDue > 3) {
        notifications.push({
          id: `tagihan-reminder-${tagihan.id}`,
          type: 'TAGIHAN',
          title: 'Reminder Pembayaran',
          message: `Tagihan Anda sebesar Rp ${tagihan.total.toLocaleString('id-ID')} akan jatuh tempo dalam ${daysUntilDue} hari.`,
          isRead: false,
          createdAt: tagihan.createdAt.toISOString(),
          link: `/pelanggan/tagihan/${tagihan.id}/bayar`,
        })
      }
    }

    // 2. Generate STATUS notifications
    // Check if jatuh tempo pelanggan sudah lewat
    const jatuhTempoPelanggan = new Date(dbPelanggan.jatuhTempo)
    const daysUntilPelangganDue = Math.ceil(
      (jatuhTempoPelanggan.getTime() - sekarang.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysUntilPelangganDue <= 7 && daysUntilPelangganDue > 0) {
      notifications.push({
        id: `status-jatuh-tempo-${dbPelanggan.id}`,
        type: 'STATUS',
        title: 'Paket Internet Akan Berakhir',
        message: `Paket internet Anda akan berakhir dalam ${daysUntilPelangganDue} hari. Pastikan untuk memperpanjang paket agar layanan tidak terputus.`,
        isRead: false,
        createdAt: sekarang.toISOString(),
        link: '/pelanggan/profil',
      })
    }

    // 3. PROMO notifications (placeholder - bisa diisi dari database atau admin panel)
    // Untuk sekarang, kita skip promo notifications karena belum ada sistem admin untuk membuat promo

    // Sort notifications by createdAt (newest first)
    notifications.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json(
      {
        notifications,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  } catch (error: any) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

