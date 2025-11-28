import { NextRequest, NextResponse } from 'next/server'
import { getPemasukanRepository } from '@/lib/repositories'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * GET /api/pemasukan
 * List semua pemasukan (admin only)
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

    const pemasukanRepo = getPemasukanRepository()

    let pemasukans
    if (kategori) {
      pemasukans = await pemasukanRepo.findByKategori(kategori)
    } else if (startDate && endDate) {
      pemasukans = await pemasukanRepo.findByDateRange(
        new Date(startDate),
        new Date(endDate),
      )
    } else {
      pemasukans = await pemasukanRepo.findAll()
    }

    return NextResponse.json(pemasukans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error fetching pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/pemasukan
 * Create pemasukan baru (admin only)
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

    const pemasukanRepo = getPemasukanRepository()
    const result = await pemasukanRepo.create({
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
    revalidatePath('/api/pemasukan')
    revalidatePath('/api/finance/cashflow')

    return NextResponse.json({ id: result.id, message: 'Pemasukan berhasil dibuat' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error creating pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}




