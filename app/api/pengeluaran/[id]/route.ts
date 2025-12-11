import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository } from '@/lib/repositories'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * GET /api/pengeluaran/[id]
 * Get detail pengeluaran (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const pengeluaranRepo = getPengeluaranRepository()
    const pengeluaran = await pengeluaranRepo.findById(id)

    if (!pengeluaran) {
      return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(pengeluaran, {
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
 * PUT /api/pengeluaran/[id]
 * Update pengeluaran (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { tanggal, tipePengeluaran, kategori, deskripsi, jumlah, metodeBayar, catatan } = body

    if (tipePengeluaran && tipePengeluaran !== 'CAPEX' && tipePengeluaran !== 'OPEX') {
      return NextResponse.json(
        { error: 'Tipe pengeluaran harus CAPEX atau OPEX' },
        { status: 400 }
      )
    }

    const pengeluaranRepo = getPengeluaranRepository()
    
    // Cek apakah pengeluaran ada
    const pengeluaran = await pengeluaranRepo.findById(id)
    if (!pengeluaran) {
      return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
    }

    await pengeluaranRepo.update(id, {
      tanggal,
      tipePengeluaran,
      kategori,
      deskripsi,
      jumlah: jumlah !== undefined ? parseInt(jumlah) : undefined,
      metodeBayar,
      catatan,
      updatedBy: session.user.id,
    })

    // Revalidate cache
    revalidatePath('/admin/finance/cashflow')
    revalidatePath('/api/pengeluaran')
    revalidatePath(`/api/pengeluaran/${id}`)
    revalidatePath('/api/finance/cashflow')

    return NextResponse.json({ message: 'Pengeluaran berhasil diupdate' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error updating pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/pengeluaran/[id]
 * Hapus pengeluaran (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const pengeluaranRepo = getPengeluaranRepository()
    
    // Cek apakah pengeluaran ada
    const pengeluaran = await pengeluaranRepo.findById(id)
    if (!pengeluaran) {
      return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
    }

    // Hapus pengeluaran
    await pengeluaranRepo.delete(id)

    // Revalidate cache
    revalidatePath('/admin/finance/cashflow')
    revalidatePath('/api/pengeluaran')
    revalidatePath(`/api/pengeluaran/${id}`)
    revalidatePath('/api/finance/cashflow')

    return NextResponse.json({ message: 'Pengeluaran berhasil dihapus' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error deleting pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

