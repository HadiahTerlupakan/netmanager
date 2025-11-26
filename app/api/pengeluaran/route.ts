import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository } from '@/lib/repositories'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * GET /api/pengeluaran
 * List semua pengeluaran (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const kategori = searchParams.get('kategori')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const pengeluaranRepo = getPengeluaranRepository()

    let pengeluarans
    if (kategori) {
      pengeluarans = await pengeluaranRepo.findByKategori(kategori)
    } else if (startDate && endDate) {
      pengeluarans = await pengeluaranRepo.findByDateRange(
        new Date(startDate),
        new Date(endDate),
      )
    } else {
      pengeluarans = await pengeluaranRepo.findAll()
    }

    return NextResponse.json(pengeluarans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error fetching pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/pengeluaran
 * Create pengeluaran baru (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tanggal, kategori, deskripsi, jumlah, metodeBayar, catatan } = body

    if (!tanggal || !kategori || !deskripsi || jumlah === undefined) {
      return NextResponse.json(
        { error: 'Tanggal, kategori, deskripsi, dan jumlah wajib diisi' },
        { status: 400 }
      )
    }

    const pengeluaranRepo = getPengeluaranRepository()
    const result = await pengeluaranRepo.create({
      tanggal,
      kategori,
      deskripsi,
      jumlah: parseInt(jumlah),
      metodeBayar: metodeBayar || null,
      catatan: catatan || null,
      createdBy: session.user.id,
    })

    // Revalidate cache
    revalidatePath('/admin/finance/cashflow')
    revalidatePath('/api/pengeluaran')
    revalidatePath('/api/finance/cashflow')

    return NextResponse.json({ id: result.id, message: 'Pengeluaran berhasil dibuat' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error creating pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

