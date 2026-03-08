import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCustomerAuth } from '@/lib/customer-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireCustomerAuth(request)
    if (authResult.response) {
      return authResult.response
    }

    const { session } = authResult
    const { id: announcementId } = await params
    const body = await request.json().catch(() => ({}))
    const portal = body.portal || 'customer'

    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true },
    })

    if (!announcement) {
      return NextResponse.json({ error: 'Pengumuman tidak ditemukan' }, { status: 404 })
    }

    const read = await prisma.announcementRead.upsert({
      where: {
        announcementId_pelangganId: {
          announcementId,
          pelangganId: session.id,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        announcementId,
        pelangganId: session.id,
        portal,
      },
    })

    return NextResponse.json({ success: true, read })
  } catch (error) {
    console.error('Customer mark announcement read error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
