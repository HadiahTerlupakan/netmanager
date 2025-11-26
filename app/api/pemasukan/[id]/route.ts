import { NextRequest, NextResponse } from 'next/server'
import { getPemasukanRepository } from '@/lib/repositories'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/**
 * GET /api/pemasukan/[id]
 * Get pemasukan by ID (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const pemasukanRepo = getPemasukanRepository()
    const pemasukan = await pemasukanRepo.findById(id)

    if (!pemasukan) {
      return NextResponse.json({ error: 'Pemasukan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(pemasukan)
  } catch (error: any) {
    console.error('Error fetching pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/pemasukan/[id]
 * Update pemasukan (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { tanggal, kategori, deskripsi, jumlah, metodeBayar, catatan } = body

    const pemasukanRepo = getPemasukanRepository()
    
    // Check if exists
    const existing = await pemasukanRepo.findById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Pemasukan tidak ditemukan' }, { status: 404 })
    }

    await pemasukanRepo.update(id, {
      tanggal,
      kategori,
      deskripsi,
      jumlah: jumlah !== undefined ? parseInt(jumlah) : undefined,
      metodeBayar: metodeBayar !== undefined ? metodeBayar : undefined,
      catatan: catatan !== undefined ? catatan : undefined,
      updatedBy: session.user.id,
    })

    // Revalidate cache
    revalidatePath('/admin/finance/cashflow')
    revalidatePath('/api/pemasukan')
    revalidatePath('/api/finance/cashflow')

    return NextResponse.json({ message: 'Pemasukan berhasil diupdate' })
  } catch (error: any) {
    console.error('Error updating pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/pemasukan/[id]
 * Delete pemasukan (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const pemasukanRepo = getPemasukanRepository()
    
    // Check if exists
    const existing = await pemasukanRepo.findById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Pemasukan tidak ditemukan' }, { status: 404 })
    }

    await pemasukanRepo.delete(id)

    // Revalidate cache
    revalidatePath('/admin/finance/cashflow')
    revalidatePath('/api/pemasukan')
    revalidatePath('/api/finance/cashflow')

    return NextResponse.json({ message: 'Pemasukan berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

