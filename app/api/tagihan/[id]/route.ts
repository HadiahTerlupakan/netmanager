import { NextRequest, NextResponse } from 'next/server'
import { getTagihanRepository } from '@/lib/repositories'
import { updateStatusPembayaran } from '@/lib/services/tagihan-service'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * GET /api/tagihan/[id]
 * Detail tagihan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const tagihanRepo = getTagihanRepository()
    const tagihan = await tagihanRepo.findById(id)

    if (!tagihan) {
      return NextResponse.json({ error: 'Tagihan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(tagihan)
  } catch (error: any) {
    console.error('Error fetching tagihan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/tagihan/[id]
 * Update tagihan (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, tanggalBayar, metodePembayaran, catatan } = body

    const tagihanRepo = getTagihanRepository()
    await tagihanRepo.update(id, {
      status,
      tanggalBayar: tanggalBayar ? new Date(tanggalBayar) : null,
      metodePembayaran,
      catatan,
    })

    return NextResponse.json({ message: 'Tagihan berhasil diupdate' })
  } catch (error: any) {
    console.error('Error updating tagihan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

